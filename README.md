# DeliveryCheck

DeliveryCheck is a small, evidence-backed web prototype for checking one labelled
delivery against one order PDF. The user uploads the PDF and one to three photos;
the app reports exact visible matches, visible mismatches, and cases that need a
better photo. Every line-bound positive or mismatch claim links back to the
extracted PDF row and a bounded region of a reviewed photo. A readable SKU with no
safe document relationship is shown separately with its photo region and an
explicit “no exact order line” source state.

This is deliberately not a warehouse system or a general product-recognition
system. In particular, failure to see an ordered item is **not** treated as proof
that it was not delivered. The model extracts visual observations; deterministic
TypeScript validates identities, compares exact SKUs, anchors quantity to separate
regions in Photo 1, and prevents detail photos from adding units.

## Current handoff status

The overview-first revision is deployed at
<https://fridayfunded.com/codebridge>. The public page and health route were
checked after deployment, and the server-side gate passed 8 test files / 68 tests,
TypeScript, and a production build. It uses a Photo-1-only count roster and does
not require physical instance tags. A dedicated Gemini key is installed only in
the root-owned production environment; it is not committed or returned by the
application. The one-use HTTPS setup route used to transfer it from a phone was
removed immediately and now returns 404.

An end-to-end live integration check of this revision succeeded with the
then-current puzzle/tea/cup/sugar order PDF and an explicitly synthetic blank
JPEG. That physical fixture has since been superseded by the final fixture
documented below. The historical probe returned four **Needs another photo**
rows, zero matches/mismatches, `captureComplete=false`, and no invented object or
missing-item claim. It verifies the PDF, image, Gemini, validation, deterministic
reconciliation, and public API path, but it does **not** validate the final fixture,
physical recognition quality, or bounding-box accuracy. Repeated user-submitted
three-photo requests later completed the validated route, but the privacy-preserving
service retained neither their uploads nor line results, so A/B/C and the held-out
input still have no independently reviewed recognition findings. One old-timeout
outlier took 58 seconds; the deployed cap is now 15 seconds per AI attempt and the
public demo allowance is 20 checks per network per hour. The walkthrough recording
and its share URL are supplied separately through the submission form.
See `DELIVERY_NOTES.md` for the verification ledger and remaining work. This
repository is intentionally rooted at the self-contained DeliveryCheck project;
it contains no source from the parent Friday Funded application. The included
`deploy/` files are only the isolated service and route assets used by this demo.

## Supported input

One check accepts:

- English only;
- exactly one valid, one-page PDF, at most 2 MiB, with an extractable text layer;
- one to five order rows with the columns `Line`, `SKU`, `Product`, and `Quantity`;
- a unique positive line number and unique SKU per row, quantity 1–99;
- one to three JPEG, PNG, or WebP photos, at most 8 MiB each;
- decoded photos up to 40 million input pixels; photos are auto-oriented,
  downscaled to fit within 1800 × 1800 pixels, flattened on white, and encoded as
  JPEG before analysis; and
- a multipart request no larger than 26.5 MiB (27,787,264 bytes), including a
  512 KiB allowance for form overhead. The application rejects a known oversized
  `Content-Length` before parsing and always enforces file count/per-file limits
  after parsing. The Friday deployment also enforces the exact total at Caddy,
  including chunked or missing-length requests; direct local deployments should
  provide an equivalent proxy guard.

Pipe-separated rows and simple whitespace-separated table rows are supported. A
scan with no text layer, OCR, multiple pages, arbitrary invoice layouts, duplicate
SKUs, and more than five product types are outside the prototype. Product labels
must carry readable English names and printed SKUs; recognising an unlabelled shop
product from appearance is also outside scope.

## Capture contract: one count-bearing overview

Users do **not** print or attach `U01`, `U02`, or any other instance number. The
only required labels are a readable product name and SKU; these may already be on
the box or may be printed for the controlled fixture.

1. Photo 1 must be a complete overview of every unpacked item. Put separate units
   apart, keep each whole object visible, and avoid overlaps or cropped edges.
2. Photo 1 is the **only source of quantity**. Two separate boxes in Photo 1 can
   count as two units; the same box repeated in Photos 2 and 3 cannot add quantity.
3. Photos 2 and 3 are optional identity/label views of the same fixed layout. Move
   the camera, not the goods. Keep enough of the object, label placement, nearby
   objects, and background visible to link the detail safely to one Photo 1 object.
4. Do not add, remove, replace, reorder, or relabel goods between photos. Removing
   an opaque label cover for a clarification run changes visibility, not the set.
5. If a detail view cannot be linked safely to exactly one Photo 1 object, it stays
   unverified even when its SKU is readable. It cannot introduce an item or change
   the count.
6. A physically corrected delivery is a new check. Use **New delivery** first so
   earlier files, results, and analysis references are cleared.

During analysis the model assigns response-local references `O01`, `O02`, and so
on to separate objects found in Photo 1. These are internal evidence handles,
shown to the user as “Photo 1 item 1”, “Photo 1 item 2”, etc. They are not printed
text, are not SKUs, and are never supplied by the user. The confirmation checkbox
records the operator's assertion that the fixed-layout convention was followed;
the software cannot independently prove that an object was not exchanged between
shots.

## Final physical A/B/C fixture

The reproducible fixture uses these four one-page order rows:

| Line | SKU | Product | Quantity |
| ---: | --- | --- | ---: |
| 1 | `DEO-FRESH` | Fresh Deodorant | 1 |
| 2 | `DRK-LEM500` | Sparkling Lemon Drink 500ml | 1 |
| 3 | `PUZ-001` | Jigsaw Puzzle | 1 |
| 4 | `PIE-BRAM-01` | Bramley Apple Pie | 1 |

Test A photographs five separate objects: a correct `DEO-FRESH` deodorant; a can
labelled `DRK-LEM330` / `Sparkling Lemon Drink 330ml`, which is similar but not
equal to order line 2; two separate `PUZ-001` puzzle boxes, proving one visible excess
unit against quantity 1; and a pie box whose controlled label and original retail
identity are fully covered. Test B keeps the same objects fixed and reveals only
the controlled pie label. Test C begins with **New delivery** and photographs the
correct deodorant, `DRK-LEM500` drink, one puzzle box, and visible pie label.

Original retail product names, identifiers, and barcodes on every physical object
must be covered so the controlled English product/SKU labels are the only identity
evidence. These specific products and SKUs are fixture data only. They are not
special cases in code or prompts; the application must process new valid PDFs and
labels within the same input contract. See `test-data/PHOTO_INSTRUCTIONS.md` for
the exact labels and photo sequence and `test-data/EXPECTED_RESULTS.md` for the
pre-registered claims and prohibited overclaims.

## How to read the result

- **Confirmed match** means the displayed count contains distinct Photo 1 objects
  with a readable exact SKU, either in the overview or a safely linked detail. It
  may still be marked as a lower bound when the overview is incomplete or another
  object is unresolved.
- **Visible mismatch** means there is positive visible evidence: either more
  distinct exact-SKU instances than the PDF quantity, or a visibly different SKU
  that can be conservatively related to one document row. It does not assert that
  the different item replaced the ordered item or that the ordered item is absent.
- **Needs another photo** means the available evidence cannot establish the
  remaining identity or quantity. Zero confirmed instances is not a missing-item
  claim.

An unknown SKU is retained as a separate observation instead of being assigned to
an arbitrary row. SKU equality is exact after documented presentation-only
normalization: Unicode NFKC, outer trim, uppercase, removal of a leading printed
field caption such as `SKU:`, conversion of common typographic dash glyphs to the
ASCII hyphen, and removal of spaces immediately around that hyphen. Letters,
digits, slashes, dots, underscores, other punctuation, internal spaces, sizes,
and lookalike characters are preserved. There is no fuzzy SKU match and a value
such as `DRK-LEM330` is never repaired to an expected `DRK-LEM500`.

## Architecture and data flow

DeliveryCheck is one Next.js application with a client page and a Node.js route;
there are no microservices, user accounts, or database.

1. `app/page.tsx` previews selected files with browser object URLs, enforces the
   capture confirmation, and posts multipart form data to
   `POST /codebridge/api/check`.
2. `lib/pdf.ts` checks the PDF header, requires one page, reconstructs lines from
   positioned `pdfjs-dist` text fragments, parses supported rows, and preserves
   each reconstructed source row plus page and line number. Layout whitespace is
   normalized during reconstruction; no model sees the PDF. The package remains
   external in the production server bundle and its worker is explicitly included
   in route tracing so PDF extraction also works after `next build`.
3. `lib/images.ts` decodes each image with `sharp`, applies EXIF orientation,
   constrains dimensions, and creates the same normalized JPEG used for model
   analysis and evidence display. This keeps 0–1000 model coordinates aligned with
   the rendered preview.
4. `lib/gemini-vision.ts` calls the Google Gemini Interactions REST API directly
   with the platform `fetch`; there is no Google SDK dependency. It sends only
   generic inspection instructions, photo numbers/dimensions, and normalized
   photos—not the order rows, expected-answer files, fixture composition, or
   filenames. The request uses `store: false`, inline base64 JPEGs at high
   resolution, low thinking, a 4,000 output-token ceiling, and a JSON Schema
   response format. The provider schema retains types, required fields, and field
   descriptions; strict ranges/cardinality and extra-property checks are applied
   locally because the live endpoint rejected the combined constraint-heavy schema.
5. The model returns photo completeness assessments and visual observations:
   photo number, response-local Photo 1 object reference, SKU, visible label text,
   object description, optional detail-link reason, uncertainty reason when
   applicable, and a normalized `box_2d` in Gemini's documented
   `[y_min, x_min, y_max, x_max]` order.
6. `lib/vision-schema.ts` parses the JSON and validates its exact structure,
   supplied-photo references, required uncertainty reasons, complete visible-SKU
   tokens in `label_text`, and ordered in-bounds box edges before deterministically
   converting them to UI width/height. An
   invalid response produces no delivery conclusion. At most one configured retry
   is allowed, with fixed coordinate guidance after a validation failure.
7. `lib/reconcile.ts` establishes its count roster only from separate Photo 1
   regions, joins safely linked detail views to those objects, rejects duplicate,
   overlapping, unlinked, or conflicting observations—including one detail region
   assigned to different overview objects—exact-matches SKUs, and counts the
   resulting overview objects. A detail-only observation can never add quantity.
   Its result is ordinary deterministic data, not a model verdict.
8. The UI lists each PDF row and opens an evidence view containing the reconstructed
   source row and the selected normalized photo with its bounding box. Overages
   retain evidence for every counted instance. If no candidate was seen, the UI
   shows the reviewed photos without inventing a box.

The UI measures browser elapsed time. The API returns server/AI durations and
reported token usage with the result. Attempt-level and request-level metadata can
also be appended to a local JSONL file; see “Data handling and demo protection.”

## Google Gemini configuration

The only AI provider adapter uses a direct REST `POST` to the Google Gemini
Interactions API; it relies on the runtime's built-in `fetch` and installs no
Google client SDK. The default configured model is `gemini-3.5-flash-lite`; the exact
runtime model name is controlled server-side by `GEMINI_VISION_MODEL`.

Reference documentation:

- [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API key documentation](https://ai.google.dev/gemini-api/docs/api-key)

Current Google documentation distinguishes newer authorization keys from legacy
standard keys. The application therefore treats the key as an opaque server-only
secret and does not hard-code an `AIza` prefix; REST authentication uses the
documented `x-goog-api-key` header.

The current Google AI Studio project is labelled **Free tier**. The latest
successful current-revision live request reported 1,644 input tokens, 74 output
tokens, and zero thought tokens.
The official Standard Free Tier lists input/output as free of charge, so that
specific request's provider charge is USD 0. At the paid Standard reference rates
checked on 2026-09-14 ($0.30/M multimodal input and $2.50/M output including
thinking), the same measured request would be about USD 0.0006782. Exact quota and
rate limits remain project/model-specific. The
[official pricing page](https://ai.google.dev/gemini-api/docs/pricing) also states
that free-tier content may be used by Google to improve its products. Use only the
prepared, non-personal test fixtures unless the deployer has reviewed and accepted
the applicable terms.

Create local configuration without putting a secret in source control or a public
chat:

```bash
cp .env.example .env.local
```

Edit `.env.local` for local development:

```dotenv
GEMINI_API_KEY=your_server_side_key
GEMINI_VISION_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=15000
GEMINI_MAX_RETRIES=1
DELIVERYCHECK_RATE_LIMIT_PER_HOUR=20
DELIVERYCHECK_METRICS_LOG=request-metrics.jsonl
```

`GEMINI_TIMEOUT_MS` accepts 5,000–40,000 milliseconds. `GEMINI_MAX_RETRIES` accepts
0 or 1, so the default permits at most two 15-second attempts with a bounded one-second
delay before the retry and stays well below the route's 90-second wall-clock limit. A key is required only
for an actual check, not for deterministic unit tests. None of these variables may
use a `NEXT_PUBLIC_` prefix. `.env.local`, metrics logs, build output, and local tool
environments are excluded by `.gitignore`.

The Friday deployment reads the same server-only names from
`/etc/fridayfunded/deliverycheck.env`, not from the public web root. That file was
created as `root:root` with mode `0600`; its dedicated key is installed and the
service has been restarted successfully. The value was never committed, printed,
or returned to a browser. Rotate or replace it only through a secure server-side
mechanism, then rerun the physical-fixture protocol.

On the Friday host, edit that root-owned file in an interactive server session;
do not pass the key as a shell argument or commit it. Then run:

```bash
systemctl restart fridayfunded-deliverycheck
curl -fsS http://127.0.0.1:3100/codebridge/api/health
```

## Local setup

Requirements:

- Node.js 22.13 or later (required by the pinned `pdfjs-dist` release);
- pnpm 11.19.0 (declared by `packageManager`); and
- a Gemini Developer API key for live photo analysis.

From this directory:

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

After adding the server-side key, open
<http://localhost:3000/codebridge>. The app is deliberately built with the
`/codebridge` base path. A localhost address is a local run, not a public demo.

For a production-mode local run:

```bash
pnpm build
pnpm start
```

## Checks and test assets

The project exposes these commands:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Unit tests use synthetic observation objects. They cover one overview object
repeated in detail photos, two separate Photo 1 objects with one SKU,
similar-but-distinct SKUs, covered labels, incomplete overview, unlinked details,
conflicting links, overlapping Photo 1 detections, malformed model responses,
duplicated cross-object detail regions, complete-token visible SKU validation,
wrong photo references, invalid coordinates, and the in-memory demo limit. A
route-boundary regression also submits the generated PDF and an explicitly
synthetic one-pixel PNG and verifies that parsing reaches `AI_NOT_CONFIGURED` when
no key is set. These tests do not validate real vision recognition or box
placement.

The current overview-first source passed **8 test files / 68 tests**, TypeScript,
ESLint, and a Next.js production build locally. The same 68 tests, TypeScript, and
production build passed on the deployment host before the final release was
switched. The Gemini HTTP tests use mocked responses and the route regression
stops at the no-key boundary; those automated checks are not live-recognition
results. Separately, the current public API submitted the then-current,
now-superseded puzzle/tea/cup/sugar order plus an explicitly synthetic blank JPEG
to the live model and received a safe, useful inconclusive result in 1.975855
seconds. That remains a historical path/fail-safe measurement, not a recognition
result for the final deodorant/drink/puzzles/pie fixture. Physical recognition
remains unverified.

The generated fixture kit is under `output/pdf/`, while the capture protocol and
separate expected/actual records are under `test-data/`. To regenerate the PDFs:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-tools.txt
pnpm generate:test-data
```

The optional tooling dependencies are pinned in `requirements-tools.txt`.
`deliverycheck-order.pdf` is the shared one-page text order; separate sheets
provide the controlled product/SKU labels for Tests A/B and C. The final fixture
is `DEO-FRESH`, `DRK-LEM500`, `PUZ-001`, and `PIE-BRAM-01`; Test A replaces the
requested drink with visible `DRK-LEM330`, includes two separate puzzle boxes,
and covers all pie identity. There are no physical instance cards. The held-out
PDF and labels must be used only after tuning is frozen. The generator creates
documents and labels, never fake physical-item photographs, runtime special
cases, or stored AI answers.

Before a first real run, read `test-data/PHOTO_INSTRUCTIONS.md` and the already
registered expectations. Append the first result—including a failure—to
`test-data/ACTUAL_RESULTS.md`; never rewrite expected results to fit model output.

## Exact pinned dependencies

Application dependencies from `package.json`:

| Package | Version | Purpose |
| --- | ---: | --- |
| `next` | 16.3.5 | Full-stack application and route runtime |
| `react`, `react-dom` | 19.3.0 | Browser UI |
| `pdfjs-dist` | 6.3.289 | PDF text extraction |
| `sharp` | 0.35.4 | Decode, orient, resize, and normalize photos |
| `zod` | 4.6.5 | Runtime model-response validation |

Gemini is called with the Node.js runtime's built-in `fetch`; there is no Google
SDK or other provider-client package in the dependency list.

Development dependencies:

| Package | Version |
| --- | ---: |
| `typescript` | 5.9.3 |
| `vitest` | 5.0.0 |
| `eslint` | 9.39.5 |
| `eslint-config-next` | 16.3.5 |
| `@types/node` | 26.5.1 |
| `@types/react`, `@types/react-dom` | 19.3.0 |

Optional PDF-fixture tooling: `reportlab==5.0.1`, `pypdf==6.18.1`, and
`pdfplumber==0.11.10`. The pnpm lockfile is included for reproducible JavaScript
installation.

## Data handling and demo protection

- The API key is read only in server code.
- The application has no upload directory, object store, database, or user history.
  PDF bytes and decoded photos exist in request/process memory; normalized photo
  data URLs return to the requesting browser for evidence display.
- The Gemini Interactions request explicitly sets `store: false`, opting out of
  stored Interaction state. This is **not** a no-training or no-improvement
  guarantee. Google's free-tier terms allow submitted content and responses to be
  used to improve products; `store: false` does not override those terms. Review
  the [Interactions documentation](https://ai.google.dev/gemini-api/docs/interactions-overview)
  and [pricing/data-use table](https://ai.google.dev/gemini-api/docs/pricing)
  before using anything beyond non-personal test fixtures.
- Successful and failed HTTP responses set `Cache-Control: no-store`.
- `logs/request-metrics.jsonl` contains operational metadata only: timestamp,
  request/response identifiers, configured model, attempt counts, durations,
  outcome codes, bounded upstream HTTP/code diagnostics, and provider-reported
  token usage. It does not log PDF/image
  bytes, filenames, labels, extracted order rows, or model output. File mode is
  requested as `0600`; log-write failure does not fail the check.
- PDF and image contents are explicitly framed as untrusted data, not instructions
  to the model. The model is not given the order or answer keys.
- File counts, byte sizes, decoded pixel count, request/model timeouts, model output
  size, and retries are bounded.

The default check-attempt guard allows twenty requests per hour for one derived
network address and runs before multipart parsing, so malformed attempts count too.
It is intentionally a **demo throttle, not security**: it lives in one process,
resets on restart/cold start, is not shared by replicas, has no account or durable
quota, and depends on correctly configured proxy IP headers. Its map removes
expired records and is capped at 10,000 client keys. Setting the limit to `0`
disables it and is appropriate only for trusted local development. A public or
costly deployment should pair it with provider-side quota/budget controls and a
durable, trusted rate limiter before sharing broadly.

Local JSONL metrics have similar limits. They are ephemeral on many serverless
hosts and are not aggregated across replicas. For durability on a single service,
mount a protected persistent volume at the project `logs/` directory. The current
adapter does not send metrics to an external logging service. Do not add upload
content or personal data to those records.

## Friday `/codebridge` deployment

The public URL is <https://fridayfunded.com/codebridge>. The current verified build
uses the Photo-1-only count convention and no physical instance tags. The service
layout is isolated from the existing Friday application as a Next.js standalone
service:

- systemd unit `fridayfunded-deliverycheck`, enabled and active;
- loopback listener `127.0.0.1:3100` (not directly internet-exposed);
- a narrow Caddy matcher for `/codebridge` and `/codebridge/*`, inserted before the
  existing Friday fallback without replacing the other routes;
- a Caddy request-body ceiling of 27,787,264 bytes, independently verified to
  return HTTP 413 for oversized known-length and chunked multipart requests; and
- server-only configuration in `/etc/fridayfunded/deliverycheck.env`.

From the repository root, the repeatable deployment command is:

```bash
bash deploy/deploy_deliverycheck.sh DEPLOY_HOST DEPLOY_USER APP_DIR SSH_KEY
```

The deployment target and SSH identity are supplied explicitly and are not stored
in this repository. The script stages the source, excludes macOS metadata and
local secrets, downloads
the [official portable Node.js v24.21.0 Linux archive](https://nodejs.org/dist/v24.21.0/)
when needed, verifies SHA-256
`fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`, runs the
current remote test suite, typecheck, and build before mutation, validates Caddy,
backs up the prior state, and rolls back on failure. The latest release passed
**8 files / 68 tests**, typecheck, and a production build on the deployment host
before activation. The script does not
provision or buy an external hosting service.

Post-release smoke checks returned HTTP 200 for the DeliveryCheck page and
`/codebridge/api/health`; a deliberately invalid public POST returned
415, and the [Caddy request-body guard](https://caddyserver.com/docs/caddyfile/directives/request_body)
returned 413 for both known-length and chunked multipart probes one byte above its
exact limit. The pre-existing Friday `/`,
`/api/health`, and `/terminal/health` routes
remained healthy. These checks prove routing and service health. The current live
blank-image check additionally proved the complete processing path and fail-safe
result behavior. Supply the final deodorant/drink/puzzles/pie photos, run A/B/C
and the held-out set, inspect every claimed region, and record the real deviations
before presenting recognition quality as verified.
