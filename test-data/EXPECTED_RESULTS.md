# Pre-registered fixture expectations

Status: **written before any live physical-image recognition run**

Original registration: 2026-09-14 13:58 IST (UTC+01:00)

Final physical-fixture revision: 2026-09-14, before receiving A/B/C photos

Physical A/B/C photos available at this revision: **no**
Physical A/B/C multimodal runs completed at this revision: **none**

The final fixture below supersedes the earlier puzzle/tea/cup/sugar fixture and
all earlier printed-instance-tag variants. The superseded fixture and synthetic
blank-image route probe must not be used as the expected answer for these physical
tests. No physical `U01`, `U02`, or similar tags are used: separate Photo 1 object
regions establish quantity.

This file is audit documentation, not application input. Runtime code, prompts,
and model requests must never read it or receive its hidden setup or expected
answers. The fixture values are not runtime special cases. Photo filenames must
remain neutral.

## Evidence and hidden truth are separate

The person assembling the fixture knows that the obscured Test A object is the pie
box. DeliveryCheck does not know that. Hidden physical truth cannot turn covered
text into visual evidence, so the app must not name the fifth object until its
controlled label is visibly readable in a safely linked Test B detail.

## Shared order document

The generated one-page PDF must have an extractable text layer containing:

```text
Line | SKU          | Product             | Quantity
1    | DEO-FRESH    | Fresh Deodorant     | 1
2    | DRK-LEM500   | Sparkling Lemon Drink 500ml | 1
3    | PUZ-001      | Jigsaw Puzzle       | 1
4    | PIE-BRAM-01  | Bramley Apple Pie   | 1
```

The evidence explorer must preserve the relevant source row and `Line` value.
SKU comparison is exact after documented formatting-only normalization;
`DRK-LEM330` must never normalize to `DRK-LEM500`.

## Test A — errors plus ambiguity

### Hidden physical setup (fixture preparation only)

| Photo 1 object | Attached label / physical setup |
| --- | --- |
| Deodorant container | `DEO-FRESH`, `Fresh Deodorant` |
| Drink can | `DRK-LEM330`, `Sparkling Lemon Drink 330ml`; original can identity covered |
| Puzzle box A | `PUZ-001`, `Jigsaw Puzzle` |
| Puzzle box B | `PUZ-001`, `Jigsaw Puzzle` |
| Pie box | `PIE-BRAM-01`, `Bramley Apple Pie`, but both the complete controlled label and all original identifying retail text are fully covered in every Test A image |

All original retail product names, identifiers, codes, and barcodes on every
object are covered; only the controlled labels above may provide identity.

Photo 1 is a complete overview of all five separate, non-overlapping objects.
The two puzzle boxes occupy distinct regions. Up to two later photos show the
same fixed layout from contextual closer angles and cannot add units.

### Expected observable conclusions

| Order line | Confirmed Photo 1 objects | Expected conclusion | Required basis and prohibited overclaim |
| --- | ---: | --- | --- |
| 1 — `DEO-FRESH` | deodorant container (1) | **Confirmed match** | Show source line 1 and a valid deodorant region whose visible controlled label contains `DEO-FRESH` and `Fresh Deodorant`. Another unresolved object means the whole delivery remains incomplete. |
| 2 — `DRK-LEM500` | none (0) | **Visible mismatch** | Show source line 2 and the drink-can region reading `DRK-LEM330` / `Sparkling Lemon Drink 330ml`. State that a similarly named drink with a different exact SKU and size is visible. Do not say it definitely replaced line 2, and do not claim the ordered drink was not delivered. |
| 3 — `PUZ-001` | puzzle boxes A and B (2) | **Visible mismatch** | Show source line 3 and separate Photo 1 regions for both puzzle boxes. Two distinct exact-SKU objects against quantity 1 prove one visible excess unit. Repeated detail views cannot increase this count. |
| 4 — `PIE-BRAM-01` | none (0) | **Needs another photo** | Show source line 4 and explain that no exact readable match was confirmed. Keep the covered fifth box as an unresolved observation with its real region as evidence of uncertainty. Do not identify it as pie from fixture knowledge, claim it belongs to line 4 as fact, or call line 4 missing. |

The unmatched exact SKU `DRK-LEM330` must also remain available as a visible
observation with no exact document match, even if it is conservatively related to
line 2. Overall verification remains incomplete because the fifth object is
unidentified. “Not confirmed” is not “not delivered.”

## Test B — clarification without changing the delivery

Test B reuses the same five physical objects in the same positions as Test A.
Only the removable flap over the pie's controlled label changes. A contextual
replacement detail makes `PIE-BRAM-01` and `Bramley Apple Pie` readable and must
link safely to the fifth object's original Photo 1 region.

Expected conclusions:

- Line 1: **Confirmed match** — `DEO-FRESH`, visible confirmed quantity 1.
- Line 2: **Visible mismatch** — observed `DRK-LEM330` differs exactly from
  requested `DRK-LEM500`; retain the no-replacement and no-missing caveats.
- Line 3: **Visible mismatch** — two separate Photo 1 puzzle regions read
  `PUZ-001` against quantity 1, proving one visible excess unit.
- Line 4: **Confirmed match** — `PIE-BRAM-01`, visible confirmed quantity 1,
  supported by source line 4, the fifth object's Photo 1 region, and the safely
  linked revealing detail.
- The unresolved fifth-object observation should clear. The drink mismatch and
  puzzle excess must remain because revealing the pie label did not change the
  delivery.

## Test C — corrected delivery, separate check

Test C is a new corrected physical delivery and must begin with **New delivery**:

| Photo 1 object in the new check | Attached label |
| --- | --- |
| Deodorant container | `DEO-FRESH`, `Fresh Deodorant` |
| Drink can | `DRK-LEM500`, `Sparkling Lemon Drink 500ml` |
| Puzzle box | `PUZ-001`, `Jigsaw Puzzle` |
| Pie box | `PIE-BRAM-01`, `Bramley Apple Pie` |

All four objects appear as separate regions in the count-bearing overview and all
controlled labels are readable in the photo set. The 330ml drink label is gone, there is
only one puzzle box, the pie label is visible, and no fifth object exists.

Each line should be **Confirmed match** with visible confirmed quantity 1:

| Line | Object | Required evidence |
| --- | --- | --- |
| 1 — `DEO-FRESH` | deodorant container | Source row 1 plus a readable controlled deodorant product/SKU region |
| 2 — `DRK-LEM500` | drink can | Source row 2 plus a readable controlled drink product/SKU region |
| 3 — `PUZ-001` | puzzle box | Source row 3 plus a readable controlled puzzle product/SKU region |
| 4 — `PIE-BRAM-01` | pie box | Source row 4 plus a readable controlled pie product/SKU region |

With a complete overview, four distinct regions, no unresolved objects, and all
labels readable, the four order rows match within the declared capture rule. This
is not proof about anything outside the photographed delivery.

## Evidence acceptance criteria for every physical run

- Every confirmed match or visible mismatch links to the exact PDF source row and
  at least one valid photo region a human can inspect.
- Each excess puzzle unit has its own separate, non-overlapping Photo 1 region;
  details cannot fabricate another unit.
- Coordinates remain within bounds and cover the intended object/label after EXIF
  orientation and preview scaling.
- A detail contributes identity only when it safely references exactly one Photo
  1 object. Conflicts, duplicate cross-object links, or overlapping object regions
  remain ambiguous.
- A covered label supports uncertainty only. It never supports a SKU, product
  identity, substitution claim, or missing-item statement.
- Failure to observe an expected exact SKU is phrased as unconfirmed / needs
  another photo, never as proof of nondelivery.
