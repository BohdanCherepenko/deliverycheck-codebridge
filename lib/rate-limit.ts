import { AppError } from "@/lib/errors";

interface RateEntry {
  startedAt: number;
  count: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_TRACKED_CLIENTS = 10_000;
const rateEntries = new Map<string, RateEntry>();
let lastCleanupAt = 0;

export function clientKeyFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local-or-unknown";
}

export function consumeCheckAllowance(clientKey: string, limit: number, now = Date.now()) {
  if (limit === 0) return;

  if (now - lastCleanupAt >= ONE_HOUR_MS || rateEntries.size >= MAX_TRACKED_CLIENTS) {
    for (const [key, entry] of rateEntries) {
      if (now - entry.startedAt >= ONE_HOUR_MS) {
        rateEntries.delete(key);
      }
    }
    while (rateEntries.size >= MAX_TRACKED_CLIENTS) {
      const oldestKey = rateEntries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      rateEntries.delete(oldestKey);
    }
    lastCleanupAt = now;
  }

  const current = rateEntries.get(clientKey);
  if (!current || now - current.startedAt >= ONE_HOUR_MS) {
    rateEntries.set(clientKey, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= limit) {
    const minutes = Math.max(1, Math.ceil((ONE_HOUR_MS - (now - current.startedAt)) / 60_000));
    throw new AppError(
      "DEMO_RATE_LIMIT",
      `This demo allows ${limit} checks per hour from one network address. Try again in about ${minutes} minutes.`,
      429,
    );
  }
  current.count += 1;
}

export function resetRateLimitForTests() {
  rateEntries.clear();
  lastCleanupAt = 0;
}
