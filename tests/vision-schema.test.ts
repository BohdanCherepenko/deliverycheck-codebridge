import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { parseObservationResponse } from "@/lib/vision-schema";

function validPayload() {
  return {
    photo_assessments: [
      {
        photo_number: 1,
        is_overview: true,
        all_items_visible: true,
        limitations: "",
      },
    ],
    observations: [
      {
        photo_number: 1,
        overview_item_id: "O01" as string | null,
        sku: "PUZ-001" as string | null,
        label_text: "PUZ-001 Jigsaw Puzzle",
        object_description: "Puzzle box",
        box_2d: [120, 100, 520, 350],
        association_reason: null as string | null,
        uncertainty_reason: null as string | null,
      },
    ],
  };
}

describe("parseObservationResponse", () => {
  it("accepts a Photo 1 roster object and preserves its region", () => {
    const result = parseObservationResponse(JSON.stringify(validPayload()), 1);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toMatchObject({
      photoNumber: 1,
      overviewItemId: "O01",
      sku: "PUZ-001",
      associationReason: null,
      bbox: { x: 100, y: 120, width: 250, height: 400 },
    });
  });

  it("removes a printed SKU caption and normalizes dash typography", () => {
    const payload = validPayload();
    payload.observations[0].sku = "SKU: DEO‑FRESH";
    payload.observations[0].label_text = "SKU: DEO‑FRESH Fresh Deodorant";

    const result = parseObservationResponse(JSON.stringify(payload), 1);

    expect(result.observations[0]).toMatchObject({
      sku: "DEO-FRESH",
      labelText: "SKU: DEO‑FRESH Fresh Deodorant",
    });
  });

  it("accepts a contextual detail linked to an existing Photo 1 object", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "Close label view",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: "O01",
      sku: "PUZ-001",
      label_text: "PUZ-001 Jigsaw Puzzle",
      object_description: "Same puzzle box",
      box_2d: [100, 100, 900, 900],
      association_reason: "Same artwork and unchanged neighbouring cup",
      uncertainty_reason: null,
    });

    const parsed = parseObservationResponse(JSON.stringify(payload), 2);
    expect(parsed.observations[1]).toMatchObject({
      photoNumber: 2,
      overviewItemId: "O01",
      associationReason: "Same artwork and unchanged neighbouring cup",
    });
  });

  it("accepts an unlinked detail only with an uncertainty reason", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "No surrounding context",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: null,
      sku: "PUZ-001",
      label_text: "PUZ-001 Jigsaw Puzzle",
      object_description: "Close puzzle-box label",
      box_2d: [100, 100, 900, 900],
      association_reason: null,
      uncertainty_reason: "The crop cannot be linked to one Photo 1 box",
    });

    const parsed = parseObservationResponse(JSON.stringify(payload), 2);
    expect(parsed.observations[1].overviewItemId).toBeNull();
  });

  it("quarantines an asserted SKU that is absent from the visible label text", () => {
    const payload = validPayload();
    payload.observations[0].label_text = "Jigsaw Puzzle";

    const parsed = parseObservationResponse(JSON.stringify(payload), 1);
    expect(parsed.observations[0]).toMatchObject({
      sku: null,
      uncertaintyReason: expect.stringMatching(/not supported.*remains unverified/i),
    });
  });

  it("does not use caption normalization to repair a different SKU", () => {
    const payload = validPayload();
    payload.observations[0].sku = "SKU: DEO‑FRE5H";
    payload.observations[0].label_text = "SKU: DEO‑FRESH Fresh Deodorant";

    const parsed = parseObservationResponse(JSON.stringify(payload), 1);
    expect(parsed.observations[0].sku).toBeNull();
    expect(parsed.observations[0].uncertaintyReason).toMatch(/remains unverified/i);
  });

  it("quarantines a SKU asserted as only a prefix of a longer visible SKU", () => {
    const payload = validPayload();
    payload.observations[0].sku = "PUZ";
    payload.observations[0].label_text = "SKU: PUZ-001 Jigsaw Puzzle";

    const parsed = parseObservationResponse(JSON.stringify(payload), 1);
    expect(parsed.observations[0].sku).toBeNull();
    expect(parsed.observations[0].uncertaintyReason).toMatch(/remains unverified/i);
  });

  it("rejects whitespace-only SKU and association strings when they are present", () => {
    const whitespaceSku = validPayload();
    whitespaceSku.observations[0].sku = "   ";
    expect(() => parseObservationResponse(JSON.stringify(whitespaceSku), 1)).toThrow(
      /evidence validation/i,
    );

    const whitespaceAssociation = validPayload();
    whitespaceAssociation.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "Close label view",
    });
    whitespaceAssociation.observations.push({
      photo_number: 2,
      overview_item_id: "O01",
      sku: "PUZ-001",
      label_text: "PUZ-001 Jigsaw Puzzle",
      object_description: "Same puzzle box",
      box_2d: [100, 100, 900, 900],
      association_reason: "   ",
      uncertainty_reason: null,
    });
    expect(() =>
      parseObservationResponse(JSON.stringify(whitespaceAssociation), 2),
    ).toThrow(/evidence validation/i);
  });

  it.each([null, "   "])(
    "keeps an unreadable SKU unverified when its explanation is %p",
    (uncertaintyReason) => {
      const payload = validPayload();
      payload.observations[0].sku = null;
      payload.observations[0].label_text = "covered label";
      payload.observations[0].uncertainty_reason = uncertaintyReason;

      const parsed = parseObservationResponse(JSON.stringify(payload), 1);

      expect(parsed.observations[0]).toMatchObject({
        sku: null,
        overviewItemId: "O01",
        bbox: { x: 100, y: 120, width: 250, height: 400 },
      });
      expect(parsed.observations[0].uncertaintyReason).toMatch(
        /no sku was confidently transcribed.*remains unverified/i,
      );
    },
  );

  it("adds a neutral explanation to an unlinked detail without counting it", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "No surrounding context",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: null,
      sku: "PUZ-001",
      label_text: "PUZ-001 Jigsaw Puzzle",
      object_description: "Close puzzle-box label",
      box_2d: [100, 100, 900, 900],
      association_reason: null,
      uncertainty_reason: null,
    });

    const parsed = parseObservationResponse(JSON.stringify(payload), 2);
    expect(parsed.observations[1]).toMatchObject({
      overviewItemId: null,
      sku: "PUZ-001",
      bbox: { x: 100, y: 100, width: 800, height: 800 },
    });
    expect(parsed.observations[1].uncertaintyReason).toMatch(
      /not safely linked.*cannot support identity or quantity/i,
    );
  });

  it("explains both unresolved fields without inventing a visual cause", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: null,
      sku: null,
      label_text: "",
      object_description: "Close view of an unidentified box",
      box_2d: [100, 100, 900, 900],
      association_reason: null,
      uncertainty_reason: null,
    });

    const parsed = parseObservationResponse(JSON.stringify(payload), 2);
    expect(parsed.observations[1].uncertaintyReason).toMatch(
      /no sku was confidently transcribed.*not safely linked.*remains unverified/i,
    );
    expect(parsed.observations[1].uncertaintyReason).not.toMatch(
      /blur|cover|occlud/i,
    );
  });

  it("preserves a specific uncertainty explanation supplied by the model", () => {
    const payload = validPayload();
    payload.observations[0].sku = null;
    payload.observations[0].label_text = "PUZ-0?1";
    payload.observations[0].uncertainty_reason =
      "One printed character is not readable";

    const parsed = parseObservationResponse(JSON.stringify(payload), 1);
    expect(parsed.observations[0].uncertaintyReason).toBe(
      "One printed character is not readable",
    );
  });

  it("still rejects a structurally missing uncertainty field", () => {
    const payload = validPayload() as unknown as {
      observations: Array<Record<string, unknown>>;
    };
    payload.observations[0].sku = null;
    delete payload.observations[0].uncertainty_reason;

    expect(() => parseObservationResponse(JSON.stringify(payload), 1)).toThrow(
      /evidence validation/i,
    );
  });

  it("rejects a structurally invalid response", () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.observations;
    expect(() => parseObservationResponse(JSON.stringify(payload), 1)).toThrow(AppError);
  });

  it("rejects out-of-bounds and reversed boxes", () => {
    const outside = validPayload();
    outside.observations[0].box_2d = [120, 900, 520, 1_150];
    expect(() => parseObservationResponse(JSON.stringify(outside), 1)).toThrow(
      /evidence validation/i,
    );

    const reversed = validPayload();
    reversed.observations[0].box_2d = [120, 350, 520, 100];
    expect(() => parseObservationResponse(JSON.stringify(reversed), 1)).toThrow(
      /evidence validation/i,
    );
  });

  it("accepts the exact normalized image boundary", () => {
    const payload = validPayload();
    payload.observations[0].box_2d = [0, 0, 1000, 1000];
    expect(parseObservationResponse(JSON.stringify(payload), 1).observations[0].bbox).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
    });
  });

  it("rejects the legacy x/y/width/height provider shape", () => {
    const payload = validPayload() as unknown as {
      observations: Array<Record<string, unknown>>;
    };
    delete payload.observations[0].box_2d;
    payload.observations[0].bbox = { x: 100, y: 120, width: 250, height: 400 };
    expect(() => parseObservationResponse(JSON.stringify(payload), 1)).toThrow(
      /evidence validation/i,
    );
  });

  it("rejects observations that reference an unsupplied photo", () => {
    const payload = validPayload();
    payload.observations[0].photo_number = 2;
    expect(() => parseObservationResponse(JSON.stringify(payload), 1)).toThrow(
      /wrong photos/i,
    );
  });

  it("requires unique sequential internal references in Photo 1", () => {
    const duplicate = validPayload();
    duplicate.observations.push({
      ...duplicate.observations[0],
      box_2d: [600, 600, 900, 900],
    });
    expect(() => parseObservationResponse(JSON.stringify(duplicate), 1)).toThrow(
      /object roster/i,
    );

    const printedStyleId = validPayload();
    printedStyleId.observations[0].overview_item_id = "U01";
    expect(() => parseObservationResponse(JSON.stringify(printedStyleId), 1)).toThrow(
      /object roster/i,
    );
  });

  it("rejects a detail reference not established in Photo 1", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: "O02",
      sku: "PUZ-001",
      label_text: "PUZ-001",
      object_description: "Puzzle box close-up",
      box_2d: [100, 100, 900, 900],
      association_reason: "Looks similar",
      uncertainty_reason: null,
    });
    expect(() => parseObservationResponse(JSON.stringify(payload), 2)).toThrow(
      /detail observation/i,
    );
  });

  it("requires a specific association reason for linked detail views", () => {
    const payload = validPayload();
    payload.photo_assessments.push({
      photo_number: 2,
      is_overview: false,
      all_items_visible: false,
      limitations: "",
    });
    payload.observations.push({
      photo_number: 2,
      overview_item_id: "O01",
      sku: "PUZ-001",
      label_text: "PUZ-001",
      object_description: "Puzzle box close-up",
      box_2d: [100, 100, 900, 900],
      association_reason: null,
      uncertainty_reason: null,
    });
    expect(() => parseObservationResponse(JSON.stringify(payload), 2)).toThrow(
      /detail observation/i,
    );
  });

  it("quarantines a positive SKU claim accompanied by uncertainty", () => {
    const inventedUncertainty = validPayload();
    inventedUncertainty.observations[0].uncertainty_reason = "Maybe blurry";
    const parsed = parseObservationResponse(
      JSON.stringify(inventedUncertainty),
      1,
    );
    expect(parsed.observations[0]).toMatchObject({
      sku: null,
      uncertaintyReason: "Maybe blurry",
    });
  });
});
