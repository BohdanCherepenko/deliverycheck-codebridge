# Actual test results

Initial pre-run status recorded 2026-09-14: **live recognition not run**.

No user-supplied physical fixture photos were present when the expectations were
registered, and configured multimodal API access was not available at that time.
Later in the session, a dedicated Gemini key was installed securely and the
current Photo-1-roster revision was deployed. Its public path completed a live
check with an explicitly synthetic blank JPEG. A later three-photo physical attempt
reached the model but failed validation before producing a result; it is recorded
below. Revised Tests A, B, C, and the new-input validation still await completed
physical results; no real bounding-box review exists. The walkthrough recording is
supplied separately and is not recognition evidence.

Keep this file separate from `EXPECTED_RESULTS.md`: expectations are fixed
before execution; observations from actual runs are appended here without
rewriting the expectations to fit model output.

## Synthetic unit tests (no live recognition)

Synthetic observations test deterministic validation, deduplication, counting,
and verdict rules. They do **not** establish real image-recognition quality or
bounding-box accuracy.

| Test area | Status | Command / evidence | Notes |
| --- | --- | --- | --- |
| Same overview object in several frames | **Passed** | current `pnpm test` | One internal Photo 1 reference counts once across safely linked details |
| Two separate Photo 1 objects with one SKU | **Passed** | same run | Two non-overlapping overview regions count separately and can prove overage |
| Similar but different exact SKUs | **Passed** | same run | `TEA-B200` remains distinct from `TEA-B100`; no missing claim |
| Obscured label / incomplete overview | **Passed** | same run | Identity stays uncertain and quantity a lower bound, never missing |
| Conflicting object labels or links | **Passed** | same run | Conflicts remain unverified and cannot add quantity |
| Duplicated detail region assigned to two objects | **Passed** | same run | Overlapping cross-object detail links are quarantined and cannot fabricate two units |
| Invalid AI structure / coordinates / sources | **Passed** | same run | Invalid response is rejected before reconciliation |
| Exact visible SKU token validation | **Passed** | same run | An asserted SKU absent from `label_text`, or only a prefix of a longer SKU, is rejected |
| Generated PDF + synthetic PNG route boundary | **Passed** | same run | Direct route test reaches `503 AI_NOT_CONFIGURED`, not a fabricated result |
| Gemini Interactions adapter boundaries | **Passed** | same run | Mocked REST tests cover request shape, native boxes, validation retry, usage, timeout, and provider errors; no provider request is sent by this test |

The current overview-first revision passed **8 test files, 68 tests**, TypeScript,
ESLint, and a production build locally. The deployment host independently passed
the same 68 tests, TypeScript, and production build before switching the latest
release. All observation/image data used in the automated suite is explicitly
synthetic; these passes do not establish physical recognition accuracy.

## Live multimodal integration runs

| Fixture | Photos | API/model | Status | Result summary |
| --- | --- | --- | --- | --- |
| Revised Test A | User took photos, but originals are not retained in this repo | Google Gemini / `gemini-3.5-flash-lite`; current source is deployed | **No recorded finding** | Five unclassified physical-input routes completed after the initial failure, but visible outcomes and box review were not retained |
| Revised Test B | Pending real photos | Google Gemini / `gemini-3.5-flash-lite`; current source is deployed | **Not run** | Unknown |
| Revised Test C | Pending real photos | Google Gemini / `gemini-3.5-flash-lite`; current source is deployed | **Not run** | Unknown |
| Revised new-input validation | Generated PDF/labels inspected; real photos pending | Google Gemini / `gemini-3.5-flash-lite`; current source is deployed | **Not run** | Unknown |

### Overview-first live synthetic probe before fixture substitution — not a physical fixture result

Recorded 2026-09-14 at approximately 20:05 IST after the final overview-first
deployment but before the physical fixture was changed to the user's available
deodorant, drink can, puzzle boxes, and pie box. Input was the then-current order
beginning with `PUZ-001 | Jigsaw Puzzle`, plus the visually inspected blank
pale-green JPEG used only for integration QA. The current generated order is
different, so these metrics have not been attributed to the new fixture.

- Public request: HTTP 200 in 1.975855 seconds.
- Model/API: `gemini-3.5-flash-lite`, Gemini Interactions API, `store: false`.
- Server / AI: 1,631 ms / 1,352 ms; one attempt, no retry.
- Usage: 1,644 input, 74 output, 1,718 total, 0 reasoning tokens.
- Result: four `Needs another photo` rows, zero confirmed matches, zero visible
  mismatches, zero observations, and `captureComplete=false`.
- Evidence boundary: every row preserved its then-current PDF source line; with no
  candidate region, the result did not invent a box or describe an item as absent.
- Actual Free Tier provider charge: USD 0. Paid Standard reference equivalent at
  the official 2026-09-14 rates is $0.0004932 input + $0.0001850 output =
  **USD 0.0006782**.
- Real label recognition and box accuracy: not measured because the image contains
  no physical item.

### Historical live synthetic probes — not physical fixture results

Recorded 2026-09-14 at approximately 17:13–17:16 IST on the superseded
printed-instance deployment. Input was the generated
`deliverycheck-order.pdf` plus a visually inspected, blank pale-green JPEG created
only for integration QA. It was never presented as a photo of real objects.

- Model: `gemini-3.5-flash-lite`, Gemini Interactions API, `store: false`.
- Command-line public run: HTTP 200 in 1.885298 s; server 1,604 ms; AI 1,341 ms;
  one 1,339 ms attempt; 1,392 input, 73 output, 1,465 total, 0 thought tokens.
- Public in-app-browser run at 390 × 844: useful result in about 1,435 ms; server
  1,288 ms; AI 1,255 ms; one 1,253 ms attempt; the same reported token usage.
- Post-deployment public API smoke: HTTP 200 in 1.907957 s; server 1,628 ms; AI
  1,398 ms; one attempt; 1,392 input / 76 output / 1,468 total / 0 thought tokens;
  again four `Needs another photo` rows and no `missing` wording.
- Parsed document: the then-current four source rows had line numbers, SKUs,
  products, and quantities preserved. This was not the revised puzzle fixture.
- Result: zero observations; zero confirmed lines; zero visible mismatches; four
  `Needs another photo` rows; `captureComplete=false`.
- Limitations: photo 1 was not accepted as an overview and was described as blank.
- False-claim check: passed. The UI said each zero count was a visible lower bound,
  explicitly said this was not evidence of non-delivery, and made no missing-item
  or replacement claim.
- Evidence check: line 1's dialog showed page 1 / line 1 and the reviewed normalized
  photo, explicitly drew no box because no candidate existed.
- Reset check: **New delivery** removed the document, photo, results, and prior
  evidence state and disabled **Check delivery** again.
- Real label/box accuracy: not measured; the blank image contains no physical item.
- Provider charge: USD 0 on the active Standard Free Tier. At the official
  2026-09-14 paid Standard reference rates ($0.30/M multimodal input + $2.50/M
  output), the two 1,392-input/73-output requests are **USD 0.0006001 each** and
  the 1,392-input/76-output smoke is **USD 0.0006076**; all three total
  **USD 0.0018078**. Diagnostic-success usage was not retained, so the full
  development paid-equivalent total remains unknown.

Earlier failed and diagnostic provider calls, including the unstable
`gemini-3.8-flash` attempts and the strict-schema compatibility check, are listed
without omission in `DELIVERY_NOTES.md`.

### User-initiated browser attempt — failed safely, fixture not classified

Recorded 2026-09-14 at approximately 17:58 IST from request
`b2313b2d-ad36-46de-8623-a9ee1785e733`. The original upload was not retained and
was not independently available for visual review, so this entry is **not**
classified as Test A, B, C, or the held-out input.

- Both provider calls completed, but both responses failed local bounding-box
  validation. Attempt 1 took 3,276 ms and reported 1,394 input / 374 output /
  1,768 total / 0 thought tokens. Attempt 2 took 2,000 ms and reported 1,394 /
  366 / 1,760 / 0.
- The route returned `INVALID_AI_RESPONSE` after 6,279 ms AI and 8,608 ms server
  time. It produced no order result, SKU claim, or evidence box.
- Provider charge was USD 0 on the active Free Tier. Paid Standard reference
  equivalent for the two reported attempts is **USD 0.0026864**.
- Root cause: the older provider contract asked for `x`, `y`, `width`, and
  `height`, and the model supplied geometry consistent with treating a lower
  edge as a height. No coordinate was clamped or guessed.
- Correction deployed at approximately 18:05 IST: request the documented Gemini
  `box_2d` order `[y_min, x_min, y_max, x_max]`, validate ordered 0–1000 edges,
  convert only validated edges to UI dimensions, and give a fixed correction on
  the one allowed validation retry. A second invalid response still fails closed.
- Post-fix result for the same selected input: **pending user rerun**.

### User-initiated three-photo physical attempt — uncertainty-metadata failure

Recorded 2026-09-14 at 23:24:46 IST from request
`9984f130-a38d-4626-af30-417cdad0f9a1`. The browser showed one text PDF, three
photos, and the capture confirmation. The original uploads were intentionally not
retained by the service and are not present in this repository, so this run is
not classified as Test A, B, C, or the held-out input and no line-level recognition
result is claimed.

- Model/API: Google Gemini Interactions API, `gemini-3.5-flash-lite`, `store: false`.
- Attempt 1 returned in 5,886 ms but failed local evidence validation: 3,810 input,
  1,746 output, 5,556 total, and 0 reasoning tokens.
- Attempt 2 returned in 4,374 ms and terminated with
  `INVALID_AI_UNCERTAINTY`: 3,968 input, 1,506 output, 5,474 total, and 0 reasoning
  tokens. The first invalid response is not stored, so its exact failed invariant
  is unknown; the terminal response omitted an explanation required for a null SKU
  or an unlinked detail region.
- Server / AI durations were 19,612 ms / 11,263 ms. Browser elapsed time was not
  independently measured.
- Result: error; no delivery conclusion, confirmed SKU, mismatch, quantity claim,
  or evidence box was returned to the user. The red error was fail-safe but too
  coarse because one missing explanatory string discarded otherwise potentially
  usable evidence.
- Provider charge was USD 0 on the active Free Tier. At the official 2026-09-14
  paid Standard reference rates, 7,778 input tokens and 3,252 output tokens equal
  **USD 0.0104634**; the retry is included exactly once.
- Correction deployed at approximately 23:39 IST: a null/blank explanation now
  receives only a neutral process-level reason derived from the null fields. The
  affected object remains unverified with its validated region and cannot count;
  valid sibling observations survive. Bad JSON, boxes, photo references, object
  rosters, associations, and unsupported SKU claims still fail closed. The retry
  prompt now repeats the non-empty explanation rule explicitly.
- Local and deployment-host gates passed 8 files / 63 tests, TypeScript, and a
  Next.js production build; local ESLint also passed. The public page and health
  endpoint returned HTTP 200 after deployment.
- Post-fix processing reran successfully five times according to route metrics;
  line-level outcomes and manual box review remain **not recorded / pending**.

### Repeated user three-photo checks — completed processing, one slow retry, then demo limit

Recorded from sanitized server metrics on 2026-09-15 between 00:07 and 00:36 IST.
The service intentionally did not retain the PDF, photos, model payload, or
line-level result, so `OK` below proves only that validated reconciliation completed;
it does not establish that the product classifications or boxes were correct.

| Request | Attempts | Server / AI | Reported usage (input / output / total / reasoning) | Route result |
| --- | ---: | ---: | ---: | --- |
| `8f6ce6e0-8464-4181-826e-b98564b0d8a0` | 1 | 17,407 / 5,216 ms | 3,810 / 1,491 / 5,301 / 0 | `OK` |
| `2d42ec8d-25c3-4d5e-bbd2-92b957a20715` | 1 | 13,230 / 5,890 ms | 3,810 / 1,742 / 5,552 / 0 | `OK` |
| `fe6278e5-4221-4609-81b7-19dde0b23b46` | 2 | 58,474 / 46,140 ms | attempt 1 unknown; attempt 2: 3,810 / 1,484 / 5,294 / 0 | `OK` |
| `d5f5c3e8-c0c2-45d8-8016-cba6d41140b3` | 1 | 19,313 / 5,692 ms | 3,810 / 1,639 / 5,449 / 0 | `OK` |
| `31f4205e-4a81-4b31-b0c3-1838269eda8b` | 1 | 15,539 / 6,166 ms | 3,810 / 1,647 / 5,457 / 0 | `OK` |
| `69b4a4b8-e924-491a-b8af-612a5f26ca8d` | 0 | 0 / not started | none | `DEMO_RATE_LIMIT` |
| `75828ccf-4963-4623-a8cc-513f251de058` | 0 | 0 / not started | none | `DEMO_RATE_LIMIT` |

The 58-second request did not fail: its first provider call reached the old
40,000-ms local timeout with no status or usage, then the retry returned valid
evidence in 5,132 ms. The last two errors were the separate five-check hourly demo
guard and sent nothing to Gemini. Browser upload/response-transfer time and the
visible line outcomes were not logged.

The known paid-Standard reference equivalent for the successful response usage is
at least **USD 0.0257225** at the pricing assumptions already recorded in
`DELIVERY_NOTES.md`; the exact equivalent is unknown because the timed-out provider
attempt reported no usage. Actual provider charge was USD 0 on the active Free
Tier. Rate-limited requests incurred no model usage.

Operational correction: default per-attempt timeout reduced from 40 to 15 seconds,
the bounded public demo allowance increased from 5 to 20 checks per network per
hour, and rate-limit/timeout errors receive specific English titles. One retry is
still allowed, so a transient stalled first attempt can recover without the prior
approximately 80-second AI worst case. Post-change physical timing remains to be
measured.

### User screenshot review — successful but incorrect four-object result

Recorded from the browser screenshots and sanitized metrics for request
`78d43368-d5e3-417b-9a0f-4943f7e81c4f`, completed 2026-09-15 at 01:42:42 IST.
This was a real three-photo recognition request, but it was **not** Test A, B, or
C: the selected `check.pdf` visibly contained `DRK-SPR-01` rather than the
pre-registered `DRK-LEM500`, and the photographs did not show the required
five-object Test A composition.

- Model/API: Google Gemini Interactions API, `gemini-3.5-flash-lite`, `store: false`.
- Browser / server / AI durations: 14.2 s / 12.7 s / 5.2 s; one valid attempt.
- Usage: 3,810 input, 1,626 output, 5,436 total, 0 reasoning tokens.
- Route result: HTTP/provider success. The UI returned 0 confirmed lines, 0
  line-level visible mismatches, 4 `Needs another photo` lines, and 5 unresolved
  cards.
- The model established four Photo 1 objects and transcribed
  `SKU: PIE-BRAM-01`, `SKU: PUZ-001`, `SKU: DRK-LEM330`, and
  `SKU: DEO-FRESH`. The identifier values and relevant digits were readable, but
  the provider copied the printed `SKU:` field caption into every structured SKU.
  The then-deployed comparator treated that caption as part of the identifier, so
  the three otherwise exact observations were incorrectly kept outside the
  document rows. This also produced duplicated titles such as `SKU SKU: ...`.
- The fifth unresolved card was not a fifth physical item. It was an
  `Ambiguous detail links` warning after overlapping regions in one detail photo
  were linked to Photo 1 items 2 and 4.
- `DRK-LEM330` was read correctly in this run. It could not be safely related to
  the selected document's `DRK-SPR-01`: their SKU families differ and the
  handwritten physical label showed no full product-name text. No fuzzy relation
  was invented.
- The screenshot previews show one PUZ-labelled box, one PIE-labelled object,
  one drink can, and one deodorant container. They do not establish two separate
  PUZ-labelled objects, and the PIE label is visibly readable in Photo 2. This
  input therefore cannot demonstrate Test A's extra puzzle unit or obscured fifth
  identity.
- No unsupported missing-item claim appeared. Source rows were visible, but the
  evidence-explorer boxes were not opened in the supplied screenshots, so box
  alignment remains **not checked**. Original image files are not retained by the
  server and were not supplied separately to the repository.
- Actual provider charge: USD 0 on the active Free Tier. Paid Standard reference
  equivalent at the already recorded 2026-09-14 rates is **USD 0.005208**
  (`3,810 × $0.30/M + 1,626 × $2.50/M`), with no retry to add.
- The generic correction was subsequently implemented and deployed: strip only a leading printed
  field caption and documented dash typography before exact comparison; never
  alter letters or digits. Ambiguous detail links remain excluded, but they do
  not cancel an independently readable Photo 1 identity. The intended fixture
  must still be rerun before any recognition success is claimed.

### Run record template — copy once per real check

```text
Fixture/run ID:
Run date/time and timezone:
PDF file (neutral name):
Photo files (neutral names, 1–3):
First ever run for this fixture? yes/no

Exact configured provider/model:
Request attempts and retry reasons:
Provider request IDs, if safe/available:
Input usage reported by provider:
Output/reasoning usage reported by provider:
Image accounting reported or assumed:

Browser elapsed time, Check delivery -> useful result:
Server processing duration:
AI request duration per attempt:
Result: success / safe inconclusive / error

Line outcomes and confirmed Photo 1 objects/internal references:
Unmatched/ambiguous observations:
Any missing-item wording shown? (expected: no unsupported claim)
PDF source-line links correct? yes/no + details
Boxes manually compared with original labels? yes/no
Box/EXIF/preview findings per selected Photo 1 object:

Pricing source URL and access date:
Pricing assumptions:
Estimated marginal cost for this check:
Retries included exactly once? yes/no
Unknown or unmeasured fields:

Deviations from pre-registered expectation:
Raw errors/limitations (with secrets and personal data removed):
```

Use `not measured` for durations or usage that were not captured, and `unknown`
for a price that cannot be verified. If a request is actually served within the
Gemini free tier, record its provider API charge as USD 0 and separately record
the account-specific tier/quota state; do not extend that claim to a paid tier or
unknown quota. Use the run-date
[official pricing page](https://ai.google.dev/gemini-api/docs/pricing) as the
source. Do not include API keys, full private uploads, or personal data here.

## Browser workflow checks

Observed 2026-09-14 in the Codex in-app browser. Early checks used local production;
the final success/reset/evidence checks used the public demo at
<https://fridayfunded.com/codebridge>:

- **Passed:** calm empty state and rule text rendered at the default desktop
  viewport and at 390 × 844; the mobile viewport showed no visible horizontal
  clipping in the inspected screen.
- **Passed:** a wrong document type produced **Unsupported document**; choosing
  four photos produced **Too many photos** and retained zero selected photos.
- **Passed:** the generated text PDF and one explicitly synthetic browser-only
  JPEG showed previews, rule confirmation enabled **Check delivery**, a second
  angle could be added, a selected photo could be replaced, and removal
  renumbered the remaining photo.
- **Passed:** **New delivery** removed the selected PDF/photo, cleared the error
  state and local analysis references, removed its own header action, and disabled the
  check button again.
- **Passed after a discovered fix:** the first production browser attempt exposed
  `PDF_READ_FAILED` because Turbopack had relocated PDF.js without its worker.
  `serverExternalPackages` plus route `outputFileTracingIncludes` fixed the
  production bundle. The same generated PDF then reached the expected
  `AI_NOT_CONFIGURED` boundary. The final post-Gemini command-line production
  smoke took 0.533535 seconds to that error boundary; its metadata log recorded 262 ms of
  server work, no AI duration, and no AI attempt. This is **not** a useful
  recognition result or speed measurement.
- **Passed in the final public run:** live result rendering, four safe
  `Needs another photo` rows, processing metrics, source-line evidence dialog with
  a reviewed photo and no invented region, and reset after a live result.
- **Passed on the current public source:** the empty 390 × 844 view contained the
  count-bearing-overview rule, had no horizontal overflow (`scrollWidth=390`),
  left the capture confirmation unchecked, and kept **Check delivery** disabled.
  The current live multipart/API path was verified separately by the public HTTP
  probe above. The in-app browser's automated file chooser timed out, so a current
  browser-submit duration was not recorded.
- **Attempted but no result on the revised source:** one three-photo physical run;
  it failed on uncertainty metadata before reconciliation and awaits a post-fix rerun.
- **Not completed:** physical A/B/C, held-out physical input, real overview/detail
  linking, and manual source-region comparison.
- **Also not run:** scanned-only PDF, oversize PDF/photo after the final provider change,
  a deliberate network timeout in the browser, rerun with a replacement photo,
  real model boxes, Tests A/B/C, and the held-out physical input.

The blank synthetic browser photo was sent to Google only for the clearly labelled
integration probe above. It was not represented as a real delivery photograph or
recognition success. No physical recognition result or video exists at this
snapshot.
