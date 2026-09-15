# DeliveryCheck physical fixture and photo instructions

These instructions define the reproducible **real-photo** fixtures for Tests A,
B, and C. The final fixture uses a deodorant container, one drink can, two
separate jigsaw-puzzle boxes, and one Bramley apple-pie box. DeliveryCheck does
not need to recognise their retail packaging from appearance: the controlled
English product name and exact printed SKU are the identity evidence.

Do not make or attach `U01`, `U02`, or any other physical instance-number label.
Quantity comes only from separate object regions in Photo 1. The software assigns
temporary internal references during analysis; the user never prints or enters
them.

The product names and SKUs below are fixture data only. They are never special
cases in runtime code or prompts; any new valid order within the documented input
limits must follow the same generic processing path.

## Shared order for Tests A, B, and C

The one-page text PDF must contain:

```text
Line | SKU          | Product             | Quantity
1    | DEO-FRESH    | Fresh Deodorant     | 1
2    | DRK-LEM500   | Sparkling Lemon Drink 500ml | 1
3    | PUZ-001      | Jigsaw Puzzle       | 1
4    | PIE-BRAM-01  | Bramley Apple Pie   | 1
```

## Print and prepare the controlled labels

Print at 100% scale. Keep every hyphen, digit, and unit exactly as written. Make
each controlled label large, flat, high contrast, and readable from the intended
camera distance.

### Test A/B labels

Attach these five labels to five separate physical objects:

```text
FRESH DEODORANT
SKU: DEO-FRESH
```

```text
SPARKLING LEMON DRINK 330ML
SKU: DRK-LEM330
```

```text
JIGSAW PUZZLE
SKU: PUZ-001
```

```text
JIGSAW PUZZLE
SKU: PUZ-001
```

```text
BRAMLEY APPLE PIE
SKU: PIE-BRAM-01
```

Use the correct deodorant label on the deodorant container, the deliberately
wrong 330ml lemon-drink label on the can, one identical puzzle label on each of the two
puzzle boxes, and the pie label on the pie box.

Cover every original retail product name, identifier, SKU, product code, and
barcode on all five objects. The controlled labels above must be the only readable
identity evidence. In particular:

- cover the can's original drink identity so the controlled 330ml lemon-drink label is the
  only readable product identity in Test A/B;
- cover all original `Bramley Apple Pie` wording and other identifying retail text
  on the pie box with plain opaque paper;
- place the controlled pie label on top of that plain wrap; and
- prepare a second removable opaque flap that hides the complete controlled pie
  label in Test A. Removing this flap in Test B must reveal only the controlled
  label, not previously visible retail clues.

The objects' shapes and non-identifying graphics may remain visible, but no
original retail text or code may compete with a controlled label.

## Rules for every check

- Upload one one-page text PDF and one to three JPEG, PNG, or WebP photographs.
- Photo 1 is a complete overview of **all unpacked items** in that check and is
  the only source of quantity. Keep each whole object visible, with clear gaps and
  no overlaps or cropped edges.
- Photos 2 and 3 are optional identity-only contextual label views of objects
  already established in Photo 1. They may improve readability but cannot add a
  unit.
- Move only the camera. Do not add, remove, substitute, reorder, rotate, or
  relabel goods between photos of one check. Test B may remove only the pie's
  removable opaque flap while all objects stay in exactly the same positions.
- A detail must include enough package shape, label placement, neighbouring
  objects, and background to associate it with exactly one Photo 1 object. A
  tight label-only crop is unsafe, especially for the two similar puzzle boxes.
- Keep the two puzzle boxes well separated. A useful fixed layout is one puzzle
  next to the deodorant and the other next to the covered pie box. Preserve those
  positions and orientations in every angle.
- Avoid fingers, glare, shadows, blur, folds across the SKU, and steep perspective.
- Photograph in the device's normal orientation. Ordinary EXIF rotation is fine;
  do not rotate or crop pixels in an editor afterward.
- Use neutral filenames. A filename must not disclose the hidden identity or
  expected result.
- Review every preview before selecting **Check delivery**. If any object is
  missing, overlapping, or cropped in Photo 1, reshoot the overview.
- A corrected physical delivery is a new check. Select **New delivery** first so
  earlier files, results, and internal object references are cleared.

## Test A — correct item, wrong similar item, extra unit, obscured label

Arrange these five objects in one layer with clear gaps:

```text
DEO-FRESH    Fresh Deodorant
DRK-LEM330   Sparkling Lemon Drink 330ml
PUZ-001      Jigsaw Puzzle — box A
PUZ-001      Jigsaw Puzzle — box B
pie box      all product identity and the controlled label fully covered
```

The second item is deliberately different from order line 2, which requests
`DRK-LEM500` / `Sparkling Lemon Drink 500ml`. The two puzzle boxes are two
physical units with the same SKU. Although the operator knows what the fifth box
contains, Test A must provide no readable pie name or SKU anywhere.

Take no more than three photographs:

1. `A_01_overview.jpg`: all five separate objects fully visible. This is the
   count-bearing image. Make the deodorant, 330ml lemon-drink, and both puzzle labels
   readable if possible; keep the pie identity fully covered.
2. `A_02_labels.jpg`: a contextual closer view of the deodorant, drink can, and
   puzzle box A. Keep enough surroundings to link each label to Photo 1.
3. `A_03_labels.jpg`: a contextual closer view of puzzle box B and the covered pie
   box. The complete pie identity remains covered.

Do not move an object after `A_01_overview.jpg`.

## Test B — reveal only the pie label

Test B is a clarification rerun of the same unchanged physical delivery. Keep the
same five objects in exactly the same positions and orientations. Reuse:

```text
A_01_overview.jpg
A_02_labels.jpg
```

Replace the third image with `B_03_revealed_detail.jpg`. Remove only the
removable flap from the pie box so its controlled label reads:

```text
BRAMLEY APPLE PIE
SKU: PIE-BRAM-01
```

Include puzzle box B and stable scene context in that image so the revealed label
can be linked back to the covered pie-box region in the original overview. Do not
replace, move, add, remove, or otherwise relabel any object.

## Test C — corrected delivery as a new set

Select **New delivery**. This is a separate corrected physical delivery, so its
composition may now change. Prepare four objects with these readable labels:

```text
FRESH DEODORANT
SKU: DEO-FRESH
```

```text
SPARKLING LEMON DRINK 500ML
SKU: DRK-LEM500
```

```text
JIGSAW PUZZLE
SKU: PUZ-001
```

```text
BRAMLEY APPLE PIE
SKU: PIE-BRAM-01
```

Compared with Test A/B, replace the controlled `DRK-LEM330` label with the correct
`DRK-LEM500` label, remove one puzzle box, and leave the pie label uncovered.
Keep all original retail text and identifiers covered before photographing.

Take:

1. `C_01_overview.jpg`: all four separate objects completely visible, with all
   four controlled labels readable if possible.
2. `C_02_labels.jpg`: one contextual closer angle covering any labels that need
   additional readability.
3. `C_03_labels.jpg` only if necessary; remain within the three-photo limit and
   do not move the goods.

## Before each real recognition run

- [ ] The shared PDF is selected and its source rows are readable.
- [ ] One to three photos total.
- [ ] Photo 1 contains every physical object in that check.
- [ ] Every object is separate, complete, and non-overlapping in Photo 1.
- [ ] Product/SKU labels use the exact controlled text above.
- [ ] All original retail names, identifiers, codes, and barcodes are covered.
- [ ] Later photos preserve the layout and include enough context for safe linking.
- [ ] Filenames are neutral and contain no expected answer.
- [ ] Test A hides all pie identity; Test B reveals only its controlled label.
- [ ] Test C starts with **New delivery** and contains exactly four objects.
- [ ] Expected results were recorded before the run.

## After each run: human evidence check

Select every result and compare each box with the normalized photo shown by the
application. Confirm that the box covers the intended physical object and label.
Inspect the two puzzle regions in Photo 1 separately. A box that is out of bounds,
offset after rotation, duplicated across two objects, or placed over the wrong
label invalidates that evidence even when its text happens to be correct. Record
the first actual result—including failures—in `ACTUAL_RESULTS.md`; do not rewrite
the expected result to fit the model.
