# Test data protocol

This directory separates pre-registered expectations from actual execution
results for DeliveryCheck. It contains no claim that physical photos, a live A/B/C
run, or a walkthrough video already exists. Routing and deployment history is
recorded separately in `../DELIVERY_NOTES.md`; it is not recognition evidence.

## Files

- `EXPECTED_RESULTS.md` - fixture composition, expected observable findings, and
  evidence acceptance criteria for A, B, and C.
- `PHOTO_INSTRUCTIONS.md` - the real-photo procedure and Photo-1-only count rule.
- `NEW_INPUT_EXPECTATIONS.md` - a held-out changed order and physical recipe.
- `ACTUAL_RESULTS.md` - the only place to append real integration, timing, usage,
  cost, and manual evidence findings.

Generated orders and printable product/SKU labels are under `../output/pdf/`.
No physical instance-number cards are needed. Future user-provided photographs
belong under `photos/` using neutral filenames; see `photos/README.md`. They are
inputs, not proof of a successful run. Never represent a generated image, drawing,
synthetic unit fixture, or placeholder as a photograph of real items.

## Count and identity convention

Photo 1 is the sole count-bearing overview. Every distinct physical region in
that photo may establish at most one item. Photos 2 and 3 may clarify a label only
when the model can safely link the detail to one Photo 1 object; they can never
introduce another unit. Keep the goods fixed in place and take contextual details
that retain the package, label position, surrounding items, and background.

The model assigns response-local references `O01`, `O02`, and so on to Photo 1
objects. They are internal analysis metadata, not printed labels and not user
input. The interface presents them as "Photo 1 item 1", etc. An unlinked detail,
overlapping overview detection, hidden SKU, or incomplete overview remains
unverified. No such case is evidence that an ordered item was not delivered.

## Required separation

The application may receive only the selected order PDF and selected photos. It
must not import, serve as a hidden prompt, or otherwise read:

- `EXPECTED_RESULTS.md`;
- `NEW_INPUT_EXPECTATIONS.md`;
- fixture preparation notes or answer keys; or
- product-revealing photo filenames.

The model extracts observations only. Deterministic application code validates the
response, builds its roster from Photo 1 regions, links contextual details,
exact-matches SKUs, and produces conclusions. A human then verifies the source row
and photo region. Expected answers never substitute for that chain of evidence.

## Execution order

1. Read the relevant expectations without changing them.
2. Generate and inspect the extractable-text PDF and print the product/SKU labels.
3. Build and photograph the physical set using `PHOTO_INSTRUCTIONS.md`.
4. Run synthetic unit tests and record their commands separately from live AI.
5. Run the live browser check and immediately append the first actual result,
   including failures, to `ACTUAL_RESULTS.md`.
6. Manually inspect every selected evidence region at original resolution.
7. After A-C and tuning are frozen, create and run the held-out input in
   `NEW_INPUT_EXPECTATIONS.md` once; record that first result before changes.

Tests A and B use the same fixed physical layout with different label visibility.
Test C is a corrected, separate delivery and must begin after **New delivery**
clears old state and response-local object references.
