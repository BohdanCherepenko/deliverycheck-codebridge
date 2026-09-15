import { describe, expect, it } from "vitest";

import {
  isNormalizedBoundingBox,
  labelContainsExactSku,
  normalizeOverviewItemId,
  normalizeSku,
  reconcileDelivery,
} from "@/lib/reconcile";
import type {
  BoundingBox,
  OrderLine,
  PhotoAssessment,
  RawObservation,
} from "@/lib/types";

const lines: OrderLine[] = [
  {
    lineNumber: 1,
    sku: "PUZ-001",
    normalizedSku: "PUZ-001",
    product: "Jigsaw Puzzle",
    expectedQuantity: 1,
    sourceText: "1 | PUZ-001 | Jigsaw Puzzle | 1",
    sourcePdfPage: 1,
  },
  {
    lineNumber: 2,
    sku: "TEA-B100",
    normalizedSku: "TEA-B100",
    product: "Black Tea 100g",
    expectedQuantity: 1,
    sourceText: "2 | TEA-B100 | Black Tea 100g | 1",
    sourcePdfPage: 1,
  },
  {
    lineNumber: 3,
    sku: "CUP-250",
    normalizedSku: "CUP-250",
    product: "Paper Cup 250ml",
    expectedQuantity: 1,
    sourceText: "3 | CUP-250 | Paper Cup 250ml | 1",
    sourcePdfPage: 1,
  },
  {
    lineNumber: 4,
    sku: "SUG-500",
    normalizedSku: "SUG-500",
    product: "Sugar 500g",
    expectedQuantity: 1,
    sourceText: "4 | SUG-500 | Sugar 500g | 1",
    sourcePdfPage: 1,
  },
];

const completeOverview: PhotoAssessment[] = [
  {
    photoNumber: 1,
    isOverview: true,
    allItemsVisible: true,
    limitations: "",
  },
];

const box = (x = 100, y = 100, width = 160, height = 180): BoundingBox => ({
  x,
  y,
  width,
  height,
});

function observation(
  partial: Partial<RawObservation> &
    Pick<RawObservation, "photoNumber" | "overviewItemId" | "sku">,
): RawObservation {
  const linkedDetail = partial.photoNumber > 1 && partial.overviewItemId !== null;
  const needsUncertainty = partial.sku === null || partial.overviewItemId === null;
  return {
    labelText: partial.sku ?? "covered label",
    objectDescription: "labelled test object",
    bbox: box(),
    associationReason: linkedDetail
      ? "Same package, label placement, and unchanged surrounding objects"
      : null,
    uncertaintyReason: needsUncertainty ? "Label or overview link is unclear" : null,
    ...partial,
  };
}

describe("safe identifier normalization", () => {
  it("normalizes formatting only and accepts internal overview references", () => {
    expect(normalizeSku("  ｔｅａ  -  ｇ１００  ")).toBe("TEA-G100");
    expect(normalizeSku("AB  CD-01/2")).toBe("AB  CD-01/2");
    expect(normalizeSku("SKU: TEA–G100")).toBe("TEA-G100");
    expect(normalizeSku("sku： tea‑g100")).toBe("TEA-G100");
    expect(normalizeSku("TEA-G100")).not.toBe(normalizeSku("TEA-G10O"));
    expect(normalizeSku("SKU: TEA-G100")).not.toBe(
      normalizeSku("SKU: TEA-G101"),
    );
    expect(normalizeOverviewItemId(" o01 ")).toBe("O01");
    expect(normalizeOverviewItemId("U01")).toBeNull();
    expect(labelContainsExactSku("SKU: ABC", "ABC")).toBe(true);
    expect(labelContainsExactSku("SKU: TEA–G100", "SKU: TEA-G100")).toBe(true);
    expect(labelContainsExactSku("SKU: ABC-X", "ABC")).toBe(false);
    expect(labelContainsExactSku("SKU: X-ABC", "ABC")).toBe(false);
    expect(labelContainsExactSku("SKU: ABC/2", "ABC")).toBe(false);
  });
});

describe("overview-first counting", () => {
  it("counts a captioned Unicode-dash SKU as the same exact identifier", () => {
    const result = reconcileDelivery(
      [lines[1]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "SKU: TEA‑B100",
          labelText: "SKU: TEA‑B100 Black Tea 100g",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 1,
      status: "confirmed_match",
    });
    expect(result.lines[0].confirmedItems[0].sku).toBe("TEA-B100");
    expect(result.lines[0].explanation).not.toContain("SKU SKU:");
  });

  it("counts one Photo 1 object once across several linked detail views", () => {
    const result = reconcileDelivery(
      [lines[0]],
      [
        observation({ photoNumber: 1, overviewItemId: "O01", sku: "PUZ-001" }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "PUZ-001",
          bbox: box(500, 100),
        }),
        observation({
          photoNumber: 3,
          overviewItemId: "O01",
          sku: "PUZ-001",
          bbox: box(250, 500),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 1,
      status: "confirmed_match",
    });
    expect(result.lines[0].confirmedItems).toHaveLength(1);
    expect(result.lines[0].confirmedItems[0].observations).toHaveLength(3);
  });

  it("never lets an exact-SKU detail-only object create quantity", () => {
    const result = reconcileDelivery(
      [lines[0]],
      [
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "PUZ-001",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.unresolved[0].kind).toBe("detail_only_item");
  });

  it("counts two separate Photo 1 objects with the same SKU and proves overage", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "CUP-250",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: "CUP-250",
          bbox: box(700, 150),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 2,
      quantityIsLowerBound: false,
      status: "visible_mismatch",
    });
    expect(result.lines[0].confirmedItems.map((item) => item.overviewItemId)).toEqual([
      "O01",
      "O02",
    ]);
    expect(result.lines[0].overageEvidence).toHaveLength(2);
    expect(result.lines[0].identityMismatchEvidence).toEqual([]);
    expect(result.lines[0].overageEvidence.every((item) => item.photoNumber === 1)).toBe(
      true,
    );
  });

  it("uses linked detail labels for identity while retaining Photo 1 count regions", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          labelText: "covered label",
          uncertaintyReason: "SKU is too small in the overview",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: null,
          labelText: "covered label",
          uncertaintyReason: "SKU is too small in the overview",
          bbox: box(700, 150),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "CUP-250",
          labelText: "CUP-250 Paper Cup 250ml",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O02",
          sku: "CUP-250",
          labelText: "CUP-250 Paper Cup 250ml",
          bbox: box(700, 150),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 2,
      status: "visible_mismatch",
    });
    expect(result.lines[0].overageEvidence).toHaveLength(2);
    expect(result.lines[0].overageEvidence.every((item) => item.photoNumber === 1)).toBe(
      true,
    );
    expect(result.lines[0].confirmedItems).toHaveLength(2);
    expect(
      result.lines[0].confirmedItems.every(
        (item) =>
          item.observations.length === 2 &&
          item.observations.some(
            (evidence) => evidence.photoNumber === 2 && evidence.normalizedSku === "CUP-250",
          ),
      ),
    ).toBe(true);
  });

  it("ignores duplicated detail links without blocking independently identified overview objects", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(700, 150),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(250, 300, 400, 400),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O02",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(255, 305, 400, 400),
        }),
      ],
      completeOverview,
    );

    expect(result.captureComplete).toBe(true);
    expect(result.unresolved).toEqual([]);
    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 2,
      status: "visible_mismatch",
    });
    expect(
      result.lines[0].confirmedItems.every(
        (item) =>
          item.observations.length === 1 &&
          item.observations[0].photoNumber === 1,
      ),
    ).toBe(true);
    expect(result.captureLimitations).toEqual([
      expect.stringMatching(/ambiguous detail regions.*ignored.*Photo 1/i),
    ]);
  });

  it("does not let one duplicated detail region identify unreadable overview objects", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          labelText: "label too small",
          uncertaintyReason: "SKU is unreadable in the overview",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: null,
          labelText: "label too small",
          uncertaintyReason: "SKU is unreadable in the overview",
          bbox: box(700, 150),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(250, 300, 400, 400),
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O02",
          sku: "CUP-250",
          labelText: "SKU: CUP-250 Paper Cup 250ml",
          bbox: box(255, 305, 400, 400),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.lines[0].overageEvidence).toEqual([]);
    expect(result.captureComplete).toBe(false);
    expect(result.unresolved.map((item) => item.title)).toContain(
      "Ambiguous detail links",
    );
    expect(result.lines[0].explanation.toLowerCase()).not.toContain("missing");
  });

  it("quarantines overlapping Photo 1 detections instead of fabricating overage", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "CUP-250",
          bbox: box(100, 100, 300, 300),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: "CUP-250",
          bbox: box(150, 150, 300, 300),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.unresolved[0]).toMatchObject({
      kind: "overlapping_overview_items",
      relatedLineNumber: 3,
    });
    expect(result.lines[0].explanation.toLowerCase()).not.toContain("overage");
  });

  it("uses a safely linked detail to identify an unreadable overview item", () => {
    const result = reconcileDelivery(
      [lines[3]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          uncertaintyReason: "SKU is too small in the overview",
        }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "SUG-500",
          labelText: "SUG-500 Sugar 500g",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 1,
      status: "confirmed_match",
    });
    expect(result.lines[0].confirmedItems[0]).toMatchObject({
      overviewItemId: "O01",
      overviewEvidenceId: "photo-1-observation-1",
      bestEvidenceId: "photo-2-observation-1",
    });
  });
});

describe("identity mismatches and ambiguity", () => {
  it("links a similar but different SKU without claiming replacement or absence", () => {
    const result = reconcileDelivery(
      [lines[1]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "TEA-B200",
          labelText: "TEA-B200 Black Tea 200g",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "visible_mismatch",
    });
    expect(result.lines[0].overageEvidence).toEqual([]);
    expect(result.lines[0].identityMismatchEvidence[0].normalizedSku).toBe("TEA-B200");
    expect(result.lines[0].explanation).toContain("does not prove");
    expect(result.lines[0].explanation.toLowerCase()).not.toContain("missing");
  });

  it("removes a field caption but keeps a wrong SKU as an exact mismatch", () => {
    const result = reconcileDelivery(
      [lines[1]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "SKU: TEA‑B200",
          labelText: "SKU: TEA‑B200 Black Tea 200g",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "visible_mismatch",
    });
    expect(result.lines[0].identityMismatchEvidence[0]).toMatchObject({
      normalizedSku: "TEA-B200",
    });
    expect(result.unresolved[0]).toMatchObject({
      kind: "unmatched_sku",
      visibleSku: "TEA-B200",
      relatedLineNumber: 2,
    });
    expect(result.lines[0].explanation).not.toContain("SKU SKU:");
    expect(result.unresolved[0].explanation).not.toContain("SKU SKU:");
  });

  it("keeps exact-SKU overage and a related wrong SKU as separate evidence", () => {
    const result = reconcileDelivery(
      [lines[2]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "CUP-250",
          bbox: box(50, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O02",
          sku: "CUP-250",
          bbox: box(400, 150),
        }),
        observation({
          photoNumber: 1,
          overviewItemId: "O03",
          sku: "CUP-350",
          labelText: "CUP-350 Paper Cup 350ml",
          bbox: box(750, 150),
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 2,
      status: "visible_mismatch",
    });
    expect(result.lines[0].overageEvidence).toHaveLength(2);
    expect(result.lines[0].identityMismatchEvidence).toHaveLength(1);
    expect(result.lines[0].identityMismatchEvidence[0].normalizedSku).toBe("CUP-350");
    expect(result.lines[0].explanation.toLowerCase()).not.toContain("missing");
  });

  it("keeps an unrelated unknown SKU separate", () => {
    const result = reconcileDelivery(
      [lines[1]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "OREG-01",
          labelText: "OREG-01 Oregano",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0].status).toBe("needs_another_photo");
    expect(result.lines[0].overageEvidence).toEqual([]);
    expect(result.lines[0].identityMismatchEvidence).toEqual([]);
    expect(result.unresolved[0]).toMatchObject({
      kind: "unmatched_sku",
      relatedLineNumber: null,
    });
  });

  it("keeps an obscured Photo 1 label unresolved with its real region", () => {
    const result = reconcileDelivery(
      [lines[3]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          labelText: "",
          uncertaintyReason: "Product name and SKU are covered",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      quantityIsLowerBound: true,
      status: "needs_another_photo",
    });
    expect(result.unresolved[0]).toMatchObject({
      kind: "unreadable_sku",
      overviewItemId: "O01",
      visibleSku: null,
    });
    expect(result.unresolved[0].evidence[0].sku).toBeNull();
    expect(result.unresolved[0].evidence[0].bbox).toEqual(box());
    expect(result.lines[0].uncertaintyEvidence).toEqual([]);
    expect(result.captureComplete).toBe(false);
  });

  it("does not attach an unassigned obscured object to every document row", () => {
    const result = reconcileDelivery(
      [lines[0], lines[1]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          labelText: "covered label",
          uncertaintyReason: "The entire printed label is covered",
        }),
      ],
      completeOverview,
    );

    expect(result.unresolved[0]).toMatchObject({
      kind: "unreadable_sku",
      relatedLineNumber: null,
    });
    expect(result.unresolved[0].evidence).toHaveLength(1);
    expect(result.lines.every((line) => line.uncertaintyEvidence.length === 0)).toBe(true);
    expect(result.lines.every((line) => line.status === "needs_another_photo")).toBe(true);
  });

  it("does not confirm a model-asserted SKU absent from the visible label text", () => {
    const result = reconcileDelivery(
      [lines[0]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: "PUZ-001",
          labelText: "Jigsaw Puzzle",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.lines[0].confirmedItems).toEqual([]);
    expect(result.unresolved[0]).toMatchObject({
      kind: "unreadable_sku",
      overviewItemId: "O01",
      visibleSku: null,
    });
    expect(result.unresolved[0].evidence[0].sku).toBeNull();
    expect(result.lines[0].explanation.toLowerCase()).not.toContain("missing");
  });

  it("does not count an unlinked detail even when its SKU is readable", () => {
    const result = reconcileDelivery(
      [lines[3]],
      [
        observation({
          photoNumber: 1,
          overviewItemId: "O01",
          sku: null,
          uncertaintyReason: "SKU is covered",
        }),
        observation({
          photoNumber: 2,
          overviewItemId: null,
          sku: "SUG-500",
          associationReason: null,
          uncertaintyReason: "Close-up lacks enough context to link it to Photo 1",
        }),
      ],
      completeOverview,
    );

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.unresolved.map((item) => item.kind)).toContain("unlinked_detail");
  });

  it("rejects conflicting SKUs attached to one overview object", () => {
    const result = reconcileDelivery(
      [lines[0], lines[1]],
      [
        observation({ photoNumber: 1, overviewItemId: "O01", sku: "PUZ-001" }),
        observation({
          photoNumber: 2,
          overviewItemId: "O01",
          sku: "TEA-B100",
        }),
      ],
      completeOverview,
    );

    expect(result.lines.every((line) => line.confirmedQuantity === 0)).toBe(true);
    expect(result.lines.every((line) => line.status === "needs_another_photo")).toBe(true);
    expect(result.unresolved[0].kind).toBe("conflicting_item");
  });

  it("treats an incomplete overview as a lower bound, never a missing claim", () => {
    const result = reconcileDelivery(
      [lines[0], lines[1]],
      [observation({ photoNumber: 1, overviewItemId: "O01", sku: "PUZ-001" })],
      [
        {
          photoNumber: 1,
          isOverview: true,
          allItemsVisible: false,
          limitations: "Right side is outside the frame",
        },
      ],
    );

    expect(result.captureComplete).toBe(false);
    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 1,
      quantityIsLowerBound: true,
      status: "confirmed_match",
    });
    expect(result.lines[1]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.lines.map((line) => line.explanation.toLowerCase()).join(" ")).not.toContain(
      "missing",
    );
  });
});

describe("defensive geometry", () => {
  it("never confirms evidence with invalid coordinates", () => {
    expect(isNormalizedBoundingBox(box())).toBe(true);
    expect(isNormalizedBoundingBox({ x: 900, y: 100, width: 200, height: 200 })).toBe(
      false,
    );

    const invalid = observation({
      photoNumber: 1,
      overviewItemId: "O01",
      sku: "PUZ-001",
      bbox: { x: 900, y: 100, width: 200, height: 200 },
    });
    const result = reconcileDelivery([lines[0]], [invalid], completeOverview);

    expect(result.lines[0]).toMatchObject({
      confirmedQuantity: 0,
      status: "needs_another_photo",
    });
    expect(result.captureComplete).toBe(false);
    expect(result.captureLimitations.join(" ")).toContain("invalid observation");
  });
});
