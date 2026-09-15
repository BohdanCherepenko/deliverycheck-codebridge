# DeliveryCheck delivery notes

Snapshot date: 2026-09-15 (Europe/Dublin / IST, UTC+01:00)

## Submission form summary

The paragraph below is a concise, copy-ready version of these notes for the
Codebridge submission form. The detailed evidence and caveats remain in the
sections that follow.

> DeliveryCheck is a Next.js/TypeScript prototype that compares one one-page text
> order PDF (1–5 rows) with 1–3 delivery photos. The repository includes generated
> PDF/label samples plus pre-registered A/B/C and held-out expectations. Google
> Gemini 3.5 Flash-Lite returns structured visual observations only; deterministic
> TypeScript validates the schema and boxes, exact-matches presentation-normalized
> SKUs, counts only distinct Photo 1 objects, and links every supported result to
> its PDF row and photo region. An unseen item is never reported as missing.
> Verification: 8
> Vitest files / 68 tests, TypeScript, ESLint, local and deployment production
> builds, public page/health checks, and exercised upload/error/reset flows passed.
> A screenshot-reviewed physical request completed in 14.2 s (12.7 s server,
> 5.2 s AI; 1 attempt; 3,810 input and 1,626 output tokens). It exposed a leading
> `SKU:` normalization defect, which was fixed and deployed. Controlled A/B/C
> recognition accuracy and manual real-photo box alignment remain not measured.
> AI tools: Gemini at runtime; OpenAI Codex for implementation, testing, review,
> documentation, and deployment support. Cost: USD 0 actual Gemini API charge on
> the active Free Tier; known retained development usage had a minimum paid-
> Standard equivalent of USD 0.0465663. Exact paid-equivalent usage and incremental
> hosting cost are unknown. No OCR, voice service, or AI middleware was used. Time
> spent: focused active time was not independently tracked; `WORKLOG.md` preserves
> timestamped observable windows. The walkthrough video URL is supplied separately.

## Outcome

DeliveryCheck has a single-page Next.js/TypeScript implementation for uploading an
order PDF and labelled-item photos, extracting visual observations with one Google
Gemini model, validating the evidence, and reconciling it with deterministic
rules. The project folder also contains synthetic unit tests, a reproducible
PDF/label generator, pre-registered fixture expectations, a held-out input, a
real-photo protocol, and a video script.

This snapshot does **not** claim that image recognition works on the intended
physical fixtures. A user submitted repeated three-photo physical runs through the
browser: one failed local validation and later requests completed the route. One
successful result was subsequently reviewed from user screenshots: its model
observations found four real regions, but the then-deployed code failed to remove
the printed `SKU:` caption and therefore rejected three otherwise exact SKU values.
That generic comparison defect is now fixed and deployed. The reviewed input used
the wrong order PDF and lacked Test A's fifth physical object/hidden label, while
the evidence drawers were not opened; therefore no revised A/B/C, held-out, or
real-box-alignment finding is claimed. A
dedicated Gemini key is installed in the root-owned production environment. The
one-use phone setup route was removed after successful installation and now
returns 404.

The current Photo-1-only application revision is deployed at
<https://fridayfunded.com/codebridge>. Before the physical fixture was updated to
the user's available objects, the same code path used the then-current puzzle-led
order PDF and an explicitly synthetic blank JPEG and safely returned four `Needs another photo`
rows, zero observations, zero confirmed lines, zero mismatches,
`captureComplete=false`, and no missing-item claim. That verifies the current
end-to-end path and uncertainty behavior, not physical recognition quality or
real box alignment. Later physical-input routes exercised the correction, but their
visible line outcomes and boxes were not preserved for independent review. The
walkthrough recording and URL are supplied separately from this repository.

## Implemented in source

- One calm workflow for capture rules, one PDF, one to three photo previews,
  replace/add/remove, processing and error states, results, rerun, and **New
  delivery** reset.
- One-page text-layer PDF extraction without OCR, with the reconstructed source
  row, PDF page, line number, exact SKU, product, and quantity retained. PDF layout
  whitespace is normalized during row reconstruction.
- Server-side image decoding, format/pixel/byte limits, EXIF auto-orientation,
  maximum-dimension normalization, and matching normalized previews.
- A direct Google Gemini Interactions REST adapter, implemented with the Node.js
  runtime's built-in `fetch` and no Google SDK dependency, that asks for
  observations rather than an order verdict and does not send order rows, answer
  keys, or filenames.
- Strict response validation for structure, photo references, required uncertainty
  fields, and normalized 0–1000 bounding boxes. If the model supplies a null or
  blank explanation for an already-null SKU or unlinked detail, a conservative
  process-level explanation keeps that region unverified instead of discarding valid
  sibling evidence. A positive SKU accompanied by uncertainty or unsupported by
  its own visible label text is now downgraded to an unverified region rather than
  aborting valid siblings; malformed sources and coordinates still fail closed.
- Deterministic exact-SKU comparison and an overview-first roster: Photo 1 alone
  establishes countable physical objects; contextual details can add identity only
  when safely linked. Duplicate references, overlapping overview regions,
  conflicting labels, and detail-only objects are quarantined. A duplicated or
  overlapping detail link is always ignored; it no longer cancels an identity that
  already has independent exact-SKU evidence in Photo 1. Separate Photo 1 regions
  can prove visible overage without physical instance tags.
- Separate `Confirmed match`, `Visible mismatch`, and `Needs another photo` states.
  Explanations distinguish a visible lower bound from proof of complete quantity
  and avoid unsupported missing-item claims.
- Evidence inspection with the PDF source row and photo region; overage evidence is
  retained for each distinct counted Photo 1 object. Reviewed photos appear without a
  fabricated region when no candidate is visible.
- Server/AI duration and provider-usage fields in the API, per-attempt
  metadata-only JSONL logging, one optional retry, no-store HTTP responses, and a
  simple in-memory per-network demo throttle. The customer-facing result screen
  deliberately omits this developer telemetry; measured values are reported in
  these delivery notes.
- Generated one-page order and product/SKU label PDFs for A/B/C and a held-out example;
  expected and actual result records remain separate.
- A standalone production service at the `/codebridge` base path, with a loopback
  listener, separate systemd unit/environment file, and a narrow Caddy route that
  preserves the existing Friday application routes.

## Verification ledger

The entries below distinguish source implementation from executed verification.
Synthetic observations cannot establish real recognition or correct visual boxes.

| Check | Status at this snapshot | Evidence / note |
| --- | --- | --- |
| Current-revision automated gate | **Passed** | Local and deployment host: 8 files / 68 tests, TypeScript, and Next.js production build; local ESLint also passed. The isolated submission tree was freshly rechecked on 2026-09-15: the same gates passed and `pnpm audit --prod` found no known vulnerabilities. |
| Revised test-asset generation and inspection | **Passed** | Six final PDFs exist: the current deodorant/drink/puzzle/pie order, A/B labels, C labels, held-out order/labels, and the fictional Tesco-labelled note. The three current physical-fixture PDFs were regenerated, confirmed as one-page A4 documents with extractable text, rendered, and visually inspected. This is document QA, not a vision test. |
| Browser upload/error/add/replace/remove/reset flow | **Passed for the exercised states** | Earlier local production QA covered wrong type, four-photo rejection, previews, capture confirmation, add/replace/remove, and reset. Final public QA at 390 × 844 additionally completed a live result, opened a source/evidence dialog with no fabricated box, and verified **New delivery** cleared files/results. |
| Pre-key production API boundary smoke | **Passed historically** | Generated PDF plus synthetic JPEG reached `503 AI_NOT_CONFIGURED` in 0.533535 s total; the metadata log recorded 262 ms server time, null AI duration, and no AI attempt. This was before secure key installation. |
| Overview-first blank-image integration before the fixture substitution | **Passed safely** | Public API check completed in 1.975855 s. Server 1,631 ms; AI 1,352 ms; one attempt; 1,644 input / 74 output / 1,718 total / 0 thought tokens. The then-current puzzle-led order produced four `Needs another photo` rows; no object, match, mismatch, or missing claim was fabricated. This timing has not been remeasured with the new physical-fixture PDF. |
| User three-photo physical attempts | **One result reviewed; not an A/B/C pass** | The initial request `9984f130-a38d-4626-af30-417cdad0f9a1` failed safely on uncertainty metadata. Later checks completed. Screenshots for request `78d43368-d5e3-417b-9a0f-4943f7e81c4f` exposed the now-fixed `SKU:` caption defect and a nonconforming four-object input; bounding boxes were not opened. See `test-data/ACTUAL_RESULTS.md`. |
| Live Test A | **No recorded finding** | Several unclassified three-photo checks completed server-side, but the originals, visible line outcomes, and manual box review are not retained in the repository. |
| Live Test B | **Not run** | Same blocker; no claim that the fifth covered label becomes readable. |
| Live Test C | **Not run** | Same blocker; no normal-case recognition claim. |
| Held-out changed input | **Not run** | Must run only after tuning is frozen. |
| Manual photo-box comparison | **Not run** | There are no physical fixture photos/model boxes to inspect. |
| Current public deployment smoke test | **Passed** | After the SKU/evidence fix, `https://fridayfunded.com/codebridge`, `/codebridge/api/health`, and the existing Friday health route returned 200. The public hashed client asset contains the revised `Visible mismatch lines` summary label. |
| Existing Friday route regression | **Passed** | `/`, `/api/health`, and `/terminal/health` remained 200; `/kukukuku` retained its 303 redirect after adding the narrow Caddy route. |
| Walkthrough recording | **Provided separately** | The project owner reports the recording complete and supplies its URL in the submission form; `WALKTHROUGH.md` preserves the script and checklist. |

Actual live results belong in `test-data/ACTUAL_RESULTS.md`; do not convert this
table or pre-registered expectations into recognition results.

### Live provider integration chronology

Every genuine generation request made during integration is accounted for below.
Direct diagnostics used neutral text or the explicitly synthetic blank image; none
received the fixture answer key or physical hidden composition.

| Model / request | Attempts and result | Usage record |
| --- | --- | --- |
| `gemini-3.8-flash`, first public full check, 16:57 IST | 2 immediate API-error attempts (4,261 ms and 3,568 ms); app returned safe `AI_REQUEST_FAILED` | No response ID or usage reported |
| `gemini-3.8-flash`, direct minimal text probe | 1 attempt; HTTP 429 | No usage reported |
| `gemini-3.8-flash`, second public full check | Attempt 1 HTTP 500 in 3,305 ms; attempt 2 timed out at 40,005 ms; app returned safe `AI_TIMEOUT` | No response ID or usage reported |
| `gemini-3.5-flash-lite`, two public strict-schema checks | 1 attempt each; HTTP 400. The second logged `invalid_request` | No usage reported |
| `gemini-3.5-flash-lite`, direct contract diagnostics | 2 minimal-text calls succeeded; 1 image/simple-schema call succeeded; 1 image/full-constraint-schema call returned HTTP 400; 2 image/constraint-stripped-schema calls succeeded. Each script made one attempt. | Success responses contained usage, but numeric values were not retained; exact diagnostic cost is therefore not reconstructed |
| `gemini-3.5-flash-lite`, final public API check | 1 attempt, HTTP 200; safe inconclusive result | 1,392 input; 73 output; 1,465 total; 0 thought tokens |
| `gemini-3.5-flash-lite`, final public browser check | 1 attempt, HTTP 200; same safe result and evidence behavior | 1,392 input; 73 output; 1,465 total; 0 thought tokens |
| `gemini-3.5-flash-lite`, post-deployment public API smoke | 1 attempt, HTTP 200; four safe inconclusive rows | 1,392 input; 76 output; 1,468 total; 0 thought tokens |
| `gemini-3.5-flash-lite`, user-initiated browser attempt, 17:58 IST | 2 completed provider responses failed local coordinate validation; the route returned `INVALID_AI_RESPONSE` and no delivery conclusion | Attempt 1: 3,276 ms, 1,394 input / 374 output / 1,768 total / 0 thought; attempt 2: 2,000 ms, 1,394 / 366 / 1,760 / 0 thought |
| `gemini-3.5-flash-lite`, overview-first blank-image check before the physical-fixture substitution, 20:05 IST | 1 attempt, HTTP 200 in 1.975855 s; four safe inconclusive rows from the then-current puzzle-led order | 1,644 input; 74 output; 1,718 total; 0 thought tokens |
| `gemini-3.5-flash-lite`, user physical three-photo request `9984…f9a1`, 23:24 IST | 2 completed responses failed local validation; terminal error `INVALID_AI_UNCERTAINTY`; 5,886 ms + 4,374 ms attempts; 19,612 ms server / 11,263 ms AI; no conclusion | Attempt 1: 3,810 input / 1,746 output / 5,556 total / 0 thought; attempt 2: 3,968 / 1,506 / 5,474 / 0 thought |
| `gemini-3.5-flash-lite`, five repeated user three-photo checks, 00:07–00:29 IST | All five routes completed `OK`; four took 13,230–19,313 ms server / 5,216–6,166 ms AI. One took 58,474 ms because attempt 1 hit the old 40,004-ms timeout and attempt 2 succeeded in 5,132 ms. No line results/uploads were logged. | Four one-attempt usages plus the successful second attempt are retained: 19,050 input / 8,003 output / 27,053 total / 0 thought. Timed-out attempt usage unknown, so the aggregate is incomplete. |
| Local demo guard, two subsequent requests, 00:33 and 00:36 IST | Immediate `DEMO_RATE_LIMIT`; no provider attempt | No model usage |
| `gemini-3.5-flash-lite`, screenshot-reviewed user request `78d4…1c4f`, 01:42 IST | 1 valid attempt; 14.2 s browser / 12,706 ms server / 5,247 ms AI. UI returned a result, but the old comparator retained the printed `SKU:` caption; three exact identities became unmatched. Selected PDF and four-object composition did not match the pre-registered fixture. | 3,810 input / 1,626 output / 5,436 total / 0 thought. Free-tier charge USD 0; paid Standard reference equivalent USD 0.005208. |

The integration exposed four real contract issues. Stateless successful responses
can omit the interaction ID, so it is now nullable in metadata. The full nested
constraint schema was rejected as `invalid_request`; the provider-facing schema
now retains types, required fields, and descriptions, while the complete strict
Zod validation still rejects bad coordinates, counts, sources, nullability, and
extra fields before reconciliation. The 17:58 browser attempt showed that asking
for `x`, `y`, `width`, and `height` led the model to use a bottom edge as a height.
The adapter now requests Google's documented `box_2d` order
`[y_min, x_min, y_max, x_max]`, validates all four edges, and converts them to the
UI shape deterministically. A retry after validation failure receives fixed
coordinate guidance; a second invalid response still fails closed.

The 23:24 physical run exposed a separate metadata edge: a response can establish
an explicitly uncertain region (`sku:null` or an unlinked detail) yet omit the
human-readable reason. Discarding all sibling evidence was safe but unnecessarily
coarse. The validator now derives only a neutral explanation from those null fields,
keeps the affected region unverified and non-counting, and preserves other validated
observations. Missing fields and unsupported evidence still fail closed.

The first production browser attempt found and recorded a genuine integration
bug: Turbopack had bundled PDF.js without a colocated `pdf.worker.mjs`, so a valid
generated text PDF returned `PDF_READ_FAILED`. Keeping `pdfjs-dist` external and
including the worker in internal `/api/check` output tracing fixed the failure. A
direct route regression now verifies that this PDF and a synthetic image reach the
no-key AI boundary. No recognition claim was inferred from that fix.

The first `/codebridge` deployment attempt stopped before mutation because macOS
AppleDouble files had entered the source archive. The second built successfully,
but the service could not traverse the portable runtime parent created with mode
`0700`; rollback restored the prior Friday state. The third attempt excluded the
metadata and made the runtime path traversable with mode `0755`, then completed.
Both failed attempts were recorded as failures and left the existing Friday routes
unchanged.

One earlier tooling issue was observed during fixture QA: bundled Poppler initially
hung while initialising fontconfig. For the final six revised PDFs, a task-local
fontconfig cache/config allowed Poppler rendering to complete; `pdfplumber` verified
the text layer and every rendered page was visually inspected. This did not
exercise image recognition.

## AI implementation used

- Provider: Google Gemini Developer API, called with a direct REST `fetch`; no
  Google SDK or AI-provider client package is installed.
- API: Interactions API at the Google `v1beta/interactions` endpoint.
- Model setting: server variable `GEMINI_VISION_MODEL`, default
  `gemini-3.5-flash-lite`. It was exercised through both the public API and browser.
- Image mode: normalized JPEG bytes encoded inline as base64 with high resolution.
- Generation controls: low thinking, no thinking summaries,
  `max_output_tokens: 4000`, JSON Schema response format, `store: false`, and at
  most 15 seconds per attempt so a stalled call cannot consume the earlier
  40-second wait; two attempts remain well below the route's 90-second budget.
- Retry policy: zero or one application retry; default one, with a bounded
  one-second delay before retrying a transient failure. The final successful
  public checks each needed one attempt. Earlier `gemini-3.8-flash` failures used
  two attempts and are listed above.
- Other AI providers/model routers: **not used**.
- AI middleware or broker service: **not used**.
- Voice, speech-to-text, and text-to-speech services: **not used**.
- OCR service/pipeline: **not used**; scanned PDFs are rejected.
- Development assistant: OpenAI Codex supported implementation, testing, review,
  documentation, and deployment work. It is not part of the runtime decision path;
  source changes were checked with the automated gates and recorded live checks.

Official references used for this implementation:

- [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)

## A concrete evidence-validation example

Suppose the model returns this otherwise plausible observation:

```json
{
  "photo_number": 1,
  "overview_item_id": "O01",
  "sku": "PUZ-001",
  "label_text": "SKU: PUZ-001 Jigsaw Puzzle",
  "object_description": "labelled puzzle box",
  "box_2d": [120, 900, 520, 850],
  "association_reason": null,
  "uncertainty_reason": null
}
```

`O01` in this example is response-local analysis metadata assigned to a Photo 1
region. It is not text printed on the box and is not supplied by the user.

In Gemini's documented `[y_min, x_min, y_max, x_max]` order, `x_max` is 850 while
`x_min` is 900, so this is an inverted box rather than trustworthy evidence. The Zod
validator in `lib/vision-schema.ts` rejects the complete AI response with
`INVALID_AI_RESPONSE`; the route produces no reconciliation result. There is also
a second defensive check in `lib/reconcile.ts`: if an invalid observation ever
bypassed the adapter boundary, it would be ignored, capture would be marked
incomplete, and that SKU would not be counted. A readable string without a valid
source region therefore cannot become confirmed evidence.

The same boundary rejects extra/missing fields, duplicate or missing photo
assessments, and references to photos that were not uploaded. A SKU assertion that
is not a complete token in the visible `label_text`, or that arrives with an
uncertainty reason, is quarantined as `sku:null`: the validated region survives but
cannot establish identity or quantity. A structurally present but null or blank
uncertainty explanation receives only a neutral process-level explanation. Neither
case invents a visual cause or repairs an identifier from the order.

## Measurements

These are measured observations, not speed promises. Synthetic and physical-input
route measurements are labelled separately; line-level physical findings were not
retained for independent review.

| Measurement | Actual value |
| --- | --- |
| Public HTTP time to useful result | **1.975855 s** on the current overview-first synthetic check; current browser-submit time was not remeasured |
| Total server duration | **1,631 ms** on that current check |
| AI duration by attempt | **1,352 ms AI total, 1 attempt** |
| Number of live attempts/retries | **1 attempt / 0 retries** on the current check |
| Input tokens, including image input | **1,644 reported** |
| Output tokens | **74 reported** |
| Reasoning tokens within output usage | **0 reported** |
| Recognition accuracy on A/B/C | **not measured** |
| Bounding-box alignment after orientation/scaling | **not measured on real photos** |
| Four normal repeated physical-input routes | **13,230–19,313 ms server / 5,216–6,166 ms AI / 1 attempt; route `OK`** |
| Slow physical-input outlier under old timeout | **58,474 ms server / 46,140 ms AI / 2 attempts; route `OK`, line outcome not retained** |
| Screenshot-reviewed physical-input request | **14.2 s browser / 12,706 ms server / 5,247 ms AI / 1 attempt**; result was visible but incorrect because of the now-fixed `SKU:` caption defect; not a conforming A/B/C input |
| Latest two errors before throttle change | **0 ms server / no AI request; `DEMO_RATE_LIMIT`** |
| Local production no-key boundary | **0.784002 s total / 648 ms server** — null AI duration, no AI attempt; not a useful result |
| Public service/routing smoke | **page transfer 0.153001 s in one curl sample** — page, asset, and health returned 200; invalid POST returned 415; known-length and chunked multipart oversize probes returned 413; no AI attempt. This is transport timing, not time to a useful result. |

The historical browser run on the superseded revision measured about 1.435
seconds; it remains useful integration history but is not substituted for a
current browser-submit measurement. The implementation exposes browser elapsed
time and returns server/AI durations and provider usage. It writes attempt/request
metadata to the configured JSONL path for each future check.

## Cost

Google's [official pricing page](https://ai.google.dev/gemini-api/docs/pricing)
was checked on 2026-09-14. The Google AI Studio project shown during setup was
labelled **Free tier**. Exact requests/tokens per period remain account/project-
specific. Standard Free Tier input/output for `gemini-3.5-flash-lite` is listed as
free of charge, and no paid tier was configured or purchased, so the measured
successful checks and the failed two-attempt coordinate-validation check had a
**USD 0 provider API charge**. At the published paid
Standard reference rates ($0.30/M multimodal input and $2.50/M output including
thinking), each of the two 1,392-input/73-output requests would be $0.0004176 +
$0.0001825 = **$0.0006001**; the 1,392-input/76-output smoke would be $0.0004176 +
$0.0001900 = **$0.0006076**. Their combined paid-tier equivalent is **$0.0018078**.
The failed user-initiated check reported 2,788 input and 740 output tokens across
its two attempts, a paid Standard equivalent of **$0.0026864**. Together with the
three earlier successful blank probes, known reported usage had a **$0.0044942**
paid-tier equivalent. The current 1,644-input/74-output check adds $0.0004932 +
$0.0001850 = **$0.0006782**, bringing known reported development usage to
**$0.0051724** at paid Standard reference rates. These calculations include the
actual retry exactly once and all reported reasoning tokens.

The later three-photo physical attempt reported 7,778 input and 3,252 output tokens
across two attempts, or **USD 0.0104634** at the same paid Standard reference rates.
Its actual provider charge was USD 0 on the active Free Tier. Known retained usage
therefore has a **USD 0.0156358** paid-tier reference equivalent; the complete
development equivalent remains unknown because earlier successful diagnostics did
not retain numeric usage.

Five subsequent completed three-photo routes retained at least 19,050 input and
8,003 output tokens. Their known paid-Standard equivalent is **USD 0.0257225**;
the exact equivalent is unknown because the first attempt of the 58-second run
timed out locally without reporting usage. Adding the known values brings retained
development usage to a **USD 0.0413583 minimum paid-tier reference equivalent**.
The active Free Tier provider charge remained USD 0. The two demo-limit responses
made no provider request and added no model usage.

The later screenshot-reviewed request reported 3,810 input and 1,626 output
tokens, a paid-Standard reference equivalent of **USD 0.005208**. Adding this
known request brings retained development usage to a **USD 0.0465663 minimum
paid-tier reference equivalent**. This is a reference calculation, not the actual
free-tier charge, and the total remains a minimum because a timed-out attempt has
unknown usage.

| Cost area | Actual status |
| --- | --- |
| Marginal Gemini provider charge for the current blank-image check | **USD 0 on the active Free Tier**; paid Standard equivalent **USD 0.0006782** from reported usage |
| Failed user check with one retry | **USD 0 on the active Free Tier**; paid Standard equivalent **USD 0.0026864** from reported usage; no conclusion was produced |
| Latest physical check with one retry | **USD 0 on the active Free Tier**; paid Standard equivalent **USD 0.0104634** from reported usage; no conclusion was produced |
| Five repeated physical-input route completions | **USD 0 on the active Free Tier**; known paid Standard equivalent **at least USD 0.0257225**; exact value unknown because one timed-out attempt reported no usage |
| Screenshot-reviewed physical-input request | **USD 0 on the active Free Tier**; paid Standard equivalent **USD 0.005208** from reported usage; one attempt |
| Development API spend | **USD 0 provider charge on the active Free Tier**; a complete paid-equivalent total is unknown because diagnostic-success token counts were not retained |
| Development labour/time cost | **unknown** — no rate was supplied; see work-log caveat below |
| Hosting | **deployed on the existing Friday host; incremental cost not measured / unknown** |
| OSS dependencies | No license fee paid by this work session; their licenses still apply |
| Voice services | **not used** |
| AI middleware/router | **not used** |

The free-tier statement above is not a paid-tier estimate and does not assign a
monetary value to exhausted or unavailable quota. No paid service or subscription
was purchased as part of this work. The checked-in deployment script
uses a checksum-verified portable Node.js v24.21.0 archive rather than a paid build
service.

## Privacy, security, and operational limits

- Secrets stay in server environment variables; `.env.local` is ignored.
- Production secrets belong in root-owned
  `/etc/fridayfunded/deliverycheck.env`; the key is installed, the file is
  `root:root` mode `0600`, and the value was not committed or returned to a
  browser. The temporary one-use setup route/helper were removed. The service
  listens only on `127.0.0.1:3100` behind Caddy.
- Caddy caps body bytes read for `/codebridge` at 27,787,264 bytes before Next.js;
  known-length and chunked multipart probes of 27,787,265 bytes returned 413.
  Application-level file, aggregate-known-length, and decoded-pixel checks remain
  in place.
- The application creates no persistent upload storage or user database. PDF and
  image data are held in memory for the request, and normalized image data returns
  to the requesting browser for evidence display.
- Gemini Interactions calls set `store: false`, which opts out of stored
  Interaction state. It is not a no-training or no-improvement guarantee. The
  [official pricing/data-use table](https://ai.google.dev/gemini-api/docs/pricing)
  says free-tier content may be used by Google to improve products, so the free
  tier should be limited to prepared non-personal fixtures unless the deployer has
  reviewed and accepted the applicable terms.
- Local JSONL contains metrics only, not uploads, filenames, label text, PDF rows,
  model output, or personal data. On serverless/ephemeral storage it may disappear;
  on multiple replicas it is fragmented.
- The default twenty-checks-per-hour limiter runs before multipart parsing and is
  keyed from proxy/IP headers. It resets on restart, does not coordinate replicas,
  can group users behind one address, and is not sufficient against deliberate
  abuse. Its local key map evicts expired records and is capped at 10,000 entries.
  A public demo needs provider-side quota/budget controls plus a durable trusted
  rate limiter.
- The PDF/image size and format checks, 40-megapixel decode ceiling, AI timeout,
  output ceiling, and at-most-one retry bound accidental cost; they are not a full
  malware-scanning or adversarial-upload system.

## Known limitations and errors still to evaluate

- Recognition and model-supplied boxes are probabilistic and unvalidated on real
  fixture photos.
- Photo 1 must show every separate object clearly. It is the sole count source;
  an item visible only in a detail photo cannot be counted.
- Contextual detail-to-overview linking remains probabilistic. An unlinked detail
  stays unverified even when its SKU is readable, and a detail never adds quantity.
- Composition stability and fixed object positions between photos are capture
  promises. The model cannot prove that the physical set never changed.
- PDF parsing intentionally supports a narrow table format. There is no OCR,
  handwriting, multi-page, spreadsheet, rotated-table, or arbitrary invoice
  pipeline.
- A wrong SKU is attached to a row only when a narrow SKU-family pattern and full
  visible product-name tokens identify one unique candidate. Otherwise it remains
  unmatched. This is intentionally conservative and will miss some human-obvious
  relationships.
- Exact SKU comparison removes only a leading printed field caption such as
  `SKU:` and documented typography differences (Unicode normalization, case,
  common dash glyphs, and spaces around a dash). Letters, digits, sizes, and
  other meaningful identifier symbols are preserved; no expected SKU is guessed.
- There is no authentication, history, durable audit trail, inventory integration,
  complaint workflow, or concurrency-grade usage quota.
- Returning normalized photos as data URLs is acceptable for the bounded prototype
  but increases response size and memory use.
- Outside the checked Friday deployment, the application can reject the total
  multipart size before buffering only when the client supplies a valid
  `Content-Length`. Independent file count, per-file size, and decoded-pixel
  limits still apply after parsing. Other public deployments must reproduce the
  verified Caddy body-size guard or an equivalent edge limit.

## Work-log caveat

`WORKLOG.md` is the authoritative record of timestamps and durations actually
observed during DeliveryCheck sessions. It explicitly does not reconstruct or
estimate the owner's work before, after, or outside those sessions. The assignment's
suggested eight-hour budget is not evidence of time spent. Any unrecorded time is
**unknown**, and the owner should append only measurements they actually made.

## Borrowed components and original work

No existing product, third-party UI kit, copied component, starter template, or
generated fixture photograph is presented as DeliveryCheck. No Friday Funded
application source was adapted into this subproject; only a new, narrowly scoped
Caddy route and separate service configuration were added for hosting.

The project uses the open-source dependencies pinned in `package.json`,
`pnpm-lock.yaml`, and `requirements-tools.txt`: Next.js/React, PDF.js, Sharp, Zod,
Vitest, ESLint/TypeScript, ReportLab, pypdf, and pdfplumber. Gemini is called with
the Node.js runtime's built-in `fetch`; no Google SDK is installed. Those libraries
provide framework, decoding, validation, test, and PDF
primitives. The DeliveryCheck interaction, visual evidence contract, prompt/schema,
PDF row parser, deterministic reconciliation rules, evidence presentation, tests,
fixture definitions/generator, and submission documentation were written for this
project.

## Remaining validation work

1. Preserve the original shareable photos used for each run under the documented
   test-data layout. Complete any still-unshot A/B/C fixtures exactly as described
   in `test-data/PHOTO_INSTRUCTIONS.md`, with neutral filenames.
2. Retry the current three-photo set after the deployed validator fix, then run A,
   B, and C through the public browser flow. Record the first real output,
   usage, retries, browser/server/AI timings, and any errors without changing the
   expected answer file.
3. Manually compare each selected region with the original photo, including both
   puzzle-box regions in Photo 1 separately; verify that no unsupported missing-item
   statement appears.
4. Freeze tuning, then run the held-out changed PDF/input once and record its first
   outcome.
5. After one physical provider-backed run succeeds, recheck the exact URL, error
   states, and unaffected Friday routes. Do not use the blank-image result as a
   claim of physical recognition accuracy.

The walkthrough recording is handled separately by the project owner and is not a
repository blocker.

## One concrete next improvement

After collecting the first real fixture results, improve detail-to-overview linking
with a deterministic visual fingerprint or a short guided capture step that asks
the user to keep one neighbouring object in frame. The count should remain anchored
to Photo 1, and any link below a measured confidence threshold should remain
unverified rather than transferring an SKU between identical units.
