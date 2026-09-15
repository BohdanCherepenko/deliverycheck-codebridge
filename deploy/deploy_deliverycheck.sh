#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "$#" -ne 4 ]]; then
  echo "usage: $0 DEPLOY_HOST DEPLOY_USER APP_DIR SSH_KEY" >&2
  exit 2
fi

DEPLOY_HOST="$1"
DEPLOY_USER="$2"
APP_DIR="$3"
DEPLOY_KEY="$4"

NODE_VERSION="v24.21.0"
NODE_ARCHIVE="node-${NODE_VERSION}-linux-x64.tar.xz"
NODE_SHA256="fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6"
SERVICE_NAME="fridayfunded-deliverycheck"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REMOTE_STAGE="/tmp/deliverycheck-${STAMP}"
BACKUP_DIR="${APP_DIR}/.hotfix-backups/${STAMP}-deliverycheck"
SOURCE_ARCHIVE="$(mktemp -t deliverycheck-source.XXXXXX.tar.gz)"
CONTROL_DIR="$(mktemp -d /tmp/deliverycheck-ssh.XXXXXX)"
CONTROL_SOCKET="${CONTROL_DIR}/socket"
SSH_ARGS=(-i "${DEPLOY_KEY}" -o BatchMode=yes -o ConnectTimeout=10)

cleanup() {
  ssh "${SSH_ARGS[@]}" -S "${CONTROL_SOCKET}" -O exit \
    "${DEPLOY_USER}@${DEPLOY_HOST}" >/dev/null 2>&1 || true
  rm -f "${SOURCE_ARCHIVE}"
  rmdir "${CONTROL_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for required in \
  "${PROJECT_DIR}/package.json" \
  "${PROJECT_DIR}/pnpm-lock.yaml" \
  "${SCRIPT_DIR}/merge_deliverycheck_caddy.py" \
  "${SCRIPT_DIR}/fridayfunded-deliverycheck.service" \
  "${SCRIPT_DIR}/deliverycheck.env.example"; do
  if [[ ! -f "${required}" ]]; then
    echo "Required deployment file is missing: ${required}" >&2
    exit 1
  fi
done

if [[ ! -f "${DEPLOY_KEY}" ]]; then
  echo "SSH identity file is missing: ${DEPLOY_KEY}" >&2
  exit 1
fi

COPYFILE_DISABLE=1 tar -C "${PROJECT_DIR}" \
  --no-xattrs \
  --exclude='._*' \
  --exclude='.DS_Store' \
  --exclude='./.env*' \
  --exclude='./.next' \
  --exclude='./.venv' \
  --exclude='./logs' \
  --exclude='./node_modules' \
  --exclude='./tmp' \
  --exclude='./tsconfig.tsbuildinfo' \
  -czf "${SOURCE_ARCHIVE}" .

ssh "${SSH_ARGS[@]}" -M -S "${CONTROL_SOCKET}" -o ControlPersist=5m -fnNT \
  "${DEPLOY_USER}@${DEPLOY_HOST}"
ssh "${SSH_ARGS[@]}" -S "${CONTROL_SOCKET}" \
  "${DEPLOY_USER}@${DEPLOY_HOST}" "install -d -m 0700 '${REMOTE_STAGE}'"
scp "${SSH_ARGS[@]}" -o ControlPath="${CONTROL_SOCKET}" \
  "${SOURCE_ARCHIVE}" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_STAGE}/source.tar.gz"
scp "${SSH_ARGS[@]}" -o ControlPath="${CONTROL_SOCKET}" \
  "${SCRIPT_DIR}/merge_deliverycheck_caddy.py" \
  "${SCRIPT_DIR}/fridayfunded-deliverycheck.service" \
  "${SCRIPT_DIR}/deliverycheck.env.example" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_STAGE}/"

ssh "${SSH_ARGS[@]}" -S "${CONTROL_SOCKET}" \
  "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s -- \
  "${APP_DIR}" \
  "${REMOTE_STAGE}" \
  "${BACKUP_DIR}" \
  "${NODE_VERSION}" \
  "${NODE_ARCHIVE}" \
  "${NODE_SHA256}" \
  "${SERVICE_NAME}" <<'REMOTE'
set -euo pipefail
umask 077

APP_DIR="$1"
REMOTE_STAGE="$2"
BACKUP_DIR="$3"
NODE_VERSION="$4"
NODE_ARCHIVE="$5"
NODE_SHA256="$6"
SERVICE_NAME="$7"

TARGET_DIR="${APP_DIR}/deliverycheck"
RUNTIME_ROOT="${APP_DIR}/.runtimes"
NODE_HOME="${RUNTIME_ROOT}/node-${NODE_VERSION}-linux-x64"
ENV_DIR="/etc/fridayfunded"
ENV_FILE="${ENV_DIR}/deliverycheck.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SOURCE_DIR="${REMOTE_STAGE}/source"
RELEASE_DIR="${REMOTE_STAGE}/release"

mkdir -p "${SOURCE_DIR}" "${RELEASE_DIR}" "${BACKUP_DIR}"
install -d -o root -g root -m 0755 "${RUNTIME_ROOT}"
tar -C "${SOURCE_DIR}" -xzf "${REMOTE_STAGE}/source.tar.gz"

if [[ ! -x "${NODE_HOME}/bin/node" ]]; then
  curl --connect-timeout 5 --max-time 120 -fsSLo "${REMOTE_STAGE}/${NODE_ARCHIVE}" \
    "https://nodejs.org/dist/${NODE_VERSION}/${NODE_ARCHIVE}"
  (
    cd "${REMOTE_STAGE}"
    printf '%s  %s\n' "${NODE_SHA256}" "${NODE_ARCHIVE}" | sha256sum -c -
  )
  tar -C "${RUNTIME_ROOT}" -xJf "${REMOTE_STAGE}/${NODE_ARCHIVE}"
  chown -R root:root "${NODE_HOME}"
fi

if [[ "$("${NODE_HOME}/bin/node" --version)" != "${NODE_VERSION}" ]]; then
  echo "Portable Node version does not match ${NODE_VERSION}." >&2
  exit 1
fi

export PATH="${NODE_HOME}/bin:${PATH}"
export NEXT_TELEMETRY_DISABLED=1
cd "${SOURCE_DIR}"
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build

cp -a .next/standalone/. "${RELEASE_DIR}/"
mkdir -p "${RELEASE_DIR}/.next/static" "${RELEASE_DIR}/.next/cache" "${RELEASE_DIR}/logs"
cp -a .next/static/. "${RELEASE_DIR}/.next/static/"
if [[ -d public ]]; then
  mkdir -p "${RELEASE_DIR}/public"
  cp -a public/. "${RELEASE_DIR}/public/"
fi

python3 "${REMOTE_STAGE}/merge_deliverycheck_caddy.py" \
  /etc/caddy/Caddyfile "${REMOTE_STAGE}/Caddyfile.candidate"
caddy validate --adapter caddyfile --config "${REMOTE_STAGE}/Caddyfile.candidate"

HAD_TARGET=0
HAD_SERVICE=0
WAS_ACTIVE=0
WAS_ENABLED=0
MUTATED=0
CADDY_REPLACED=0

rollback() {
  local status=$?
  trap - ERR
  set +e
  echo "Deployment failed; restoring the previous /codebridge state." >&2

  if [[ "${CADDY_REPLACED}" -eq 1 && -f "${BACKUP_DIR}/Caddyfile" ]]; then
    install -o root -g root -m 0644 "${BACKUP_DIR}/Caddyfile" /etc/caddy/Caddyfile
    caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1
    systemctl reload caddy
  fi

  if [[ "${MUTATED}" -eq 1 ]]; then
    systemctl stop "${SERVICE_NAME}" >/dev/null 2>&1
    if [[ -d "${TARGET_DIR}" ]]; then
      mv "${TARGET_DIR}" "${BACKUP_DIR}/failed-release"
    fi
    if [[ "${HAD_TARGET}" -eq 1 && -d "${BACKUP_DIR}/deliverycheck" ]]; then
      mv "${BACKUP_DIR}/deliverycheck" "${TARGET_DIR}"
    fi

    if [[ "${HAD_SERVICE}" -eq 1 && -f "${BACKUP_DIR}/${SERVICE_NAME}.service" ]]; then
      install -o root -g root -m 0644 \
        "${BACKUP_DIR}/${SERVICE_NAME}.service" "${SERVICE_FILE}"
    elif [[ -f "${SERVICE_FILE}" ]]; then
      systemctl disable "${SERVICE_NAME}" >/dev/null 2>&1
      mv "${SERVICE_FILE}" "${BACKUP_DIR}/failed-${SERVICE_NAME}.service"
    fi
    systemctl daemon-reload
    if [[ "${HAD_SERVICE}" -eq 1 ]]; then
      if [[ "${WAS_ENABLED}" -eq 1 ]]; then
        systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1
      else
        systemctl disable "${SERVICE_NAME}" >/dev/null 2>&1
      fi
      if [[ "${WAS_ACTIVE}" -eq 1 ]]; then
        systemctl start "${SERVICE_NAME}" >/dev/null 2>&1
      fi
    fi
  fi

  exit "${status}"
}
trap rollback ERR

if [[ -f "${SERVICE_FILE}" ]]; then
  HAD_SERVICE=1
  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    WAS_ACTIVE=1
  fi
  if systemctl is-enabled --quiet "${SERVICE_NAME}"; then
    WAS_ENABLED=1
  fi
  cp "${SERVICE_FILE}" "${BACKUP_DIR}/${SERVICE_NAME}.service"
fi
if [[ -d "${TARGET_DIR}" ]]; then
  HAD_TARGET=1
  if [[ -d "${TARGET_DIR}/logs" ]]; then
    cp -a "${TARGET_DIR}/logs/." "${RELEASE_DIR}/logs/"
  fi
  systemctl stop "${SERVICE_NAME}" >/dev/null 2>&1 || true
  mv "${TARGET_DIR}" "${BACKUP_DIR}/deliverycheck"
fi

MUTATED=1
mv "${RELEASE_DIR}" "${TARGET_DIR}"
chown -R fridayfunded:fridayfunded "${TARGET_DIR}"
mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  install -o root -g root -m 0600 "${REMOTE_STAGE}/deliverycheck.env.example" "${ENV_FILE}"
fi
install -o root -g root -m 0644 \
  "${REMOTE_STAGE}/fridayfunded-deliverycheck.service" "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}" >/dev/null
systemctl restart "${SERVICE_NAME}"

for attempt in 1 2 3 4 5 6 7 8; do
  if curl --connect-timeout 2 --max-time 5 -fsS \
    "http://127.0.0.1:3100/codebridge/api/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl --connect-timeout 2 --max-time 5 -fsS \
  "http://127.0.0.1:3100/codebridge/api/health" >/dev/null

cp /etc/caddy/Caddyfile "${BACKUP_DIR}/Caddyfile"
LIVE_CADDY_SHA="$(sha256sum /etc/caddy/Caddyfile | awk '{print $1}')"
python3 "${REMOTE_STAGE}/merge_deliverycheck_caddy.py" \
  /etc/caddy/Caddyfile "${REMOTE_STAGE}/Caddyfile.final"
caddy validate --adapter caddyfile --config "${REMOTE_STAGE}/Caddyfile.final"
if [[ "$(sha256sum /etc/caddy/Caddyfile | awk '{print $1}')" != "${LIVE_CADDY_SHA}" ]]; then
  echo "Caddy changed during deployment; refusing to overwrite the newer configuration." >&2
  exit 1
fi
CADDY_REPLACED=1
install -o root -g root -m 0644 "${REMOTE_STAGE}/Caddyfile.final" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

curl --connect-timeout 5 --max-time 15 -fsS "https://fridayfunded.com/" >/dev/null
curl --connect-timeout 5 --max-time 15 -fsS "https://fridayfunded.com/api/health" >/dev/null
curl --connect-timeout 5 --max-time 15 -fsS "https://fridayfunded.com/terminal/health" >/dev/null
curl --connect-timeout 5 --max-time 15 -fsS \
  "https://fridayfunded.com/codebridge/api/health" >/dev/null

rm -rf "${REMOTE_STAGE}"
trap - ERR
echo "DeliveryCheck deployed: https://fridayfunded.com/codebridge"
echo "Backup: ${BACKUP_DIR}"
REMOTE

echo "DeliveryCheck deployed: https://fridayfunded.com/codebridge"
