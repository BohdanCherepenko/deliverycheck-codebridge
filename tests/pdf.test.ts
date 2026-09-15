import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { extractOrderLines } from "@/lib/pdf";

async function fixture(name: string) {
  const bytes = await readFile(resolve("output/pdf", name));
  return new File([bytes], name, { type: "application/pdf" });
}

describe("text PDF extraction", () => {
  it("extracts the four exact sample SKUs and preserves source rows", async () => {
    const lines = await extractOrderLines(await fixture("deliverycheck-order.pdf"));
    expect(lines.map((line) => line.normalizedSku)).toEqual([
      "DEO-FRESH",
      "DRK-LEM500",
      "PUZ-001",
      "PIE-BRAM-01",
    ]);
    expect(lines.map((line) => line.expectedQuantity)).toEqual([1, 1, 1, 1]);
    expect(lines.every((line) => line.sourcePdfPage === 1)).toBe(true);
    expect(lines[0].sourceText).toContain("Fresh Deodorant");
    expect(lines[1].sourceText).toContain("Sparkling Lemon Drink 500ml");
    expect(lines[2].sourceText).toContain("Jigsaw Puzzle");
    expect(lines[3].sourceText).toContain("Bramley Apple Pie");
  });

  it("accepts a changed, pre-registered order without fixture-specific code", async () => {
    const lines = await extractOrderLines(await fixture("new-input-order.pdf"));
    expect(lines.map(({ normalizedSku, expectedQuantity }) => ({
      normalizedSku,
      expectedQuantity,
    }))).toEqual([
      { normalizedSku: "NOTE-A5", expectedQuantity: 2 },
      { normalizedSku: "PEN-BLK", expectedQuantity: 1 },
    ]);
  });

  it("rejects a non-PDF even when its filename and MIME type claim PDF", async () => {
    const fake = new File(["not really a PDF"], "invoice.pdf", {
      type: "application/pdf",
    });
    await expect(extractOrderLines(fake)).rejects.toMatchObject({
      code: "UNSUPPORTED_PDF",
      status: 415,
    });
  });
});
