# DeliveryCheck walkthrough script

**Status:** the project owner has prepared the walkthrough recording and supplies
its share URL separately. This file preserves the reproducible script and recording
checklist; the media file itself is intentionally not stored in the repository.

The current Photo-1-only revision is deployed at
<https://fridayfunded.com/codebridge>. Its server-only Gemini key and end-to-end
provider path were checked with an explicitly synthetic blank image. That probe
returned a safe inconclusive result, but physical-item recognition and real
bounding boxes remain unverified because no final A/B/C photos have been supplied.

The final physical fixture uses a deodorant container, one drink can, two separate
jigsaw-puzzle boxes, and one Bramley apple-pie box. Its names and SKUs are test
data only; they are not hard-coded runtime cases.

Target duration: 2:45–2:55. For any rerun, record only after the final PDFs and
physical photos have been checked in the live environment. Do not substitute
synthetic observations, generated images, prepared answers, or this script for a
live run.

## Before recording

- Follow `test-data/PHOTO_INSTRUCTIONS.md` exactly and use neutral filenames.
- Check that `deliverycheck-order.pdf` has selectable text and contains the final
  `DEO-FRESH`, `DRK-LEM500`, `PUZ-001`, and `PIE-BRAM-01` order rows.
- Cover original retail names, identifiers, and barcodes on every object so the
  controlled product/SKU labels are the only identity evidence.
- Keep Test A to three photos or fewer. All pie identity—including its controlled
  label and original retail text—must remain opaque and unreadable in Test A.
- Photo 1 is the sole count source. Keep all five Test A objects separate and
  fixed; later images are contextual label views only.
- Keep Test C separate: four objects, exact correct labels, one puzzle box, and an
  uncovered pie label. Select **New delivery** before uploading it.
- The configured provider is Google Gemini `gemini-3.5-flash-lite` through the
  direct Interactions REST API. On Google's free tier, use only shareable,
  non-personal fixtures; `store: false` is stateless interaction handling, not a
  no-training guarantee.
- Preserve the first real outputs in `test-data/ACTUAL_RESULTS.md`, including any
  failure. Do not alter expectations after seeing a model result.
- Hide API keys, dashboards, private paths, email, and personal data from the
  recording. State measured latency rather than promising an untested speed.

## Timed script

### 0:00–0:18 — Scope and capture rule

**Action:** Show the empty DeliveryCheck screen and its capture instructions.

**Say:**

> DeliveryCheck checks a small labelled delivery against a one-page text PDF.
> Photo one is the sole source of quantity. Later photos can clarify labels but
> cannot add units, and the goods stay fixed. Users attach only product and SKU
> labels—there are no physical instance tags. Not visible never means not
> delivered.

### 0:18–0:42 — Upload Test A

**Action:** Upload the final `deliverycheck-order.pdf`, `A_01_overview.jpg`,
`A_02_labels.jpg`, and `A_03_labels.jpg`. Show the previews, confirm the capture
rule, and select **Check delivery**.

**Say:**

> The PDF has four order rows. The five photographed objects show one correct
> deodorant, a similarly named but different drink, two puzzle boxes with the same
> SKU, and one object whose identity is covered. The server extracts PDF text in
> code. The model receives only normalized photos and returns observations; it
> never receives the order or expected-answer file.

### 0:42–1:07 — Confirmed exact item

**Action:** Open line 1. Show requested and observed `DEO-FRESH`, expected 1,
confirmed 1, and **Confirmed match**. Open the evidence for the deodorant.

**Say:**

> This deodorant is a separate Photo 1 object and its controlled DEO-FRESH label
> is readable. The evidence view keeps PDF line 1 and the corresponding photo
> region together. Because another object is unresolved, this one confirmed item
> does not make the entire delivery complete.

### 1:07–1:34 — Different SKU without claiming absence

**Action:** Open line 2. Show requested `DRK-LEM500` / `Sparkling Lemon Drink
500ml` and the visible can label `DRK-LEM330` / `Sparkling Lemon Drink 330ml`.
Open its source line and photo region.

**Say:**

> The can visibly reads DRK-LEM330, not the requested exact SKU DRK-LEM500. The
> similar controlled product name supports a visible identity mismatch. The app
> does not claim that the visible can was a definite replacement for the ordered drink, and it does
> not claim the ordered drink is missing.

Say this only if the live result actually relates the visible can to line 2 and
shows the required evidence. Otherwise show the real unmatched observation and
record the deviation instead of narrating the expected result.

### 1:34–1:59 — Proven excess from two overview objects

**Action:** Open line 3. Show expected 1 and confirmed 2 for `PUZ-001`. Select
each counted puzzle so two separate Photo 1 evidence regions are visible.

**Say:**

> These two puzzle boxes have the same exact SKU but occupy separate regions in
> the count-bearing overview. Later detail photos cannot increase the count. Two
> separately evidenced units against quantity one prove one visible excess unit.

### 1:59–2:22 — Honest ambiguity

**Action:** Open line 4 and the unresolved fifth-object evidence. Show **Needs
another photo**, PDF line 4, and the real region containing the fully covered pie
box without exposing its hidden identity.

**Say:**

> A fifth object is visible, but its product name, SKU, and original retail clues
> are covered. DeliveryCheck asks for another photo. It does not call the object a
> Bramley apple pie just because that row remains unconfirmed, and it does not
> claim a shortage.

### 2:22–2:47 — Corrected delivery is a new check

**Action:** Select **New delivery** and show that the prior files and results are
cleared. Upload the separate Test C overview and label view, confirm the rules,
and run it. Show the four result rows and open one source-row/photo-region pair.

**Say:**

> A changed physical delivery is a new check, never another angle. This corrected
> fixture has DEO-FRESH, the requested DRK-LEM500 drink, one PUZ-001 puzzle, and a
> visible PIE-BRAM-01 label. New delivery cleared the previous evidence and
> temporary object references. The live result shows four confirmed rows within
> the declared capture rule.

Use the final sentence only if the actual Test C run and manual region review
support it. Otherwise show and name the actual safe failure.

### 2:47–2:58 — Close with the boundary

**Action:** Return to the result summary or evidence explorer.

**Say:**

> AI extracts what is visible, strict validation rejects unsupported evidence,
> and deterministic code decides exact SKU identity and count. DeliveryCheck
> reports what the photos prove and asks for better evidence when they do not.

## Optional Test B appendix

If time permits outside the main three-minute cut, rerun the unchanged Test A
layout using `A_01_overview.jpg`, `A_02_labels.jpg`, and
`B_03_revealed_detail.jpg`. Remove only the pie label's opaque flap; do not move
or change any goods. Show that `PIE-BRAM-01` becomes confirmed while the
`DRK-LEM330` drink mismatch and two-puzzle excess remain. Do not claim this result
unless the actual live rerun produces it.

## Recording checklist

- [ ] Final video is no longer than 3:00.
- [ ] The environment is truthfully identified as public demo or local run.
- [ ] Only real physical photos are shown as recognition evidence.
- [ ] `DEO-FRESH` includes PDF line 1 and a correct deodorant region.
- [ ] `DRK-LEM330` is shown against `DRK-LEM500` without “missing” or definite
      “replacement” language.
- [ ] The two `PUZ-001` puzzle boxes have separately inspectable Photo 1 regions.
- [ ] The covered object remains unnamed and appears as **Needs another photo**.
- [ ] **New delivery** visibly clears the old check before Test C.
- [ ] Every narrated live conclusion matches the screen and its evidence.
- [ ] Processing cuts preserve an honestly reported measured duration.
- [ ] No API key, private email, personal data, or expected-answer file is visible.
- [ ] The exported video is opened and checked before submission.
