# Pre-registered new-input validation

Status: **specified before fixture generation, photography, or recognition**

Recorded: 2026-09-14 13:58 IST (UTC+01:00)

Photos: **pending user-provided physical photos**
Recognition runs: **none**

This input is intentionally separate from Tests A–C and must not be used while
tuning prompts or deterministic rules. Its hidden setup and expected results
must not be loaded by runtime code or included in any model request.

## New one-page order

Generate a different text-based PDF containing:

```text
Line | SKU      | Product       | Quantity
1    | NOTE-A5  | A5 Notebook   | 2
2    | PEN-BLK  | Black Pen     | 1
```

The PDF must have an extractable text layer. It is not an OCR test.

## Hidden physical setup (fixture preparation only)

Prepare three real, visually separate objects or plain packages with printed
labels:

```text
NOTE-A5  A5 Notebook
NOTE-A5  A5 Notebook
PEN-BLK  Black Pen
```

Take a first overview containing all three objects as separate, non-overlapping
regions. This is the sole count source. Take one optional contextual label photo;
never exceed three photos. Keep the layout fixed and move only the camera. Each
detail must retain enough package and surrounding scene to link safely to one
Photo 1 object. Use neutral filenames such as `N_01_overview.jpg` and
`N_02_labels.jpg`.

## Expected observable conclusions

- Line 1 is **Confirmed match** with two distinct Photo 1 notebook regions,
  visible confirmed quantity 2. It requires the source row plus separate
  inspectable overview evidence for both units.
- Line 2 is **Confirmed match** with one Photo 1 pen region, visible confirmed
  quantity 1. It requires the source row plus an inspectable label region.
- Repeated appearances in the detail photo do not increase counts.
- With a complete overview, readable labels, safe detail links, and no unresolved
  objects, the two order rows match within the declared capture rule.
- Any unreadable label, invalid region, unlinked detail, or inconsistent observation must
  degrade the relevant conclusion to uncertainty rather than being repaired
  from this file.

## Isolation and recording

Run this fixture only after the implementation and Tests A–C have stopped
changing. Do not add its SKUs or product names to prompts, special cases,
parsers, or source code. Record the first run—even if it fails—in
`ACTUAL_RESULTS.md` before making any adjustment. The generated order,
product-label PDFs are prepared under `../output/pdf/`;
physical photos and recognition remain pending. No pass is claimed.
