import { AppError } from "@/lib/errors";
import { MAX_PDF_BYTES } from "@/lib/config";
import type { OrderLine } from "@/lib/types";

interface TextFragment {
  text: string;
  x: number;
  y: number;
}

const PDF_MAGIC = "%PDF-";
const HEADER_WORDS = new Set(["line", "sku", "product", "quantity", "qty"]);

function normalizeSkuForPdf(sku: string) {
  return sku.normalize("NFKC").trim().toUpperCase().replace(/\s*-\s*/g, "-");
}

function reconstructTextLines(fragments: TextFragment[]) {
  const rows: TextFragment[][] = [];
  const sorted = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x);

  for (const fragment of sorted) {
    const existing = rows.find((row) => Math.abs(row[0].y - fragment.y) <= 2.5);
    if (existing) existing.push(fragment);
    else rows.push([fragment]);
  }

  return rows
    .map((row) =>
      row
        .sort((a, b) => a.x - b.x)
        .map((fragment) => fragment.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function parsePipeRow(sourceText: string) {
  const cells = sourceText
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.length !== 4) return null;
  return cells;
}

function parseWhitespaceRow(sourceText: string) {
  const match = sourceText.match(
    /^\s*(\d+)\s+([A-Za-z0-9][A-Za-z0-9._/-]*)\s+(.+?)\s+(\d+)\s*$/,
  );
  if (!match) return null;
  return [match[1], match[2], match[3], match[4]];
}

function parseOrderRow(sourceText: string): OrderLine | null {
  const normalizedHeader = sourceText
    .toLowerCase()
    .replace(/[|]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (
    normalizedHeader.length >= 3 &&
    normalizedHeader.filter((word) => HEADER_WORDS.has(word)).length >= 3
  ) {
    return null;
  }

  const cells = parsePipeRow(sourceText) ?? parseWhitespaceRow(sourceText);
  if (!cells) return null;

  const [lineCell, skuCell, productCell, quantityCell] = cells;
  if (!/^\d+$/.test(lineCell) || !/^\d+$/.test(quantityCell)) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(skuCell)) return null;

  const lineNumber = Number(lineCell);
  const expectedQuantity = Number(quantityCell);
  if (
    !Number.isSafeInteger(lineNumber) ||
    lineNumber < 1 ||
    !Number.isSafeInteger(expectedQuantity) ||
    expectedQuantity < 1 ||
    expectedQuantity > 99 ||
    productCell.length < 2 ||
    productCell.length > 160
  ) {
    return null;
  }

  return {
    lineNumber,
    sku: skuCell,
    normalizedSku: normalizeSkuForPdf(skuCell),
    product: productCell,
    expectedQuantity,
    sourceText,
    sourcePdfPage: 1,
  };
}

function validateOrderLines(lines: OrderLine[]) {
  if (lines.length === 0) {
    throw new AppError(
      "PDF_ROWS_NOT_FOUND",
      "No order rows were found. Use columns Line, SKU, Product, and Quantity.",
      422,
    );
  }
  if (lines.length > 5) {
    throw new AppError(
      "TOO_MANY_PRODUCT_TYPES",
      "This prototype supports up to five product types per PDF.",
      422,
    );
  }

  const duplicateLines = lines
    .map((line) => line.lineNumber)
    .filter((value, index, all) => all.indexOf(value) !== index);
  const duplicateSkus = lines
    .map((line) => line.normalizedSku)
    .filter((value, index, all) => all.indexOf(value) !== index);
  if (duplicateLines.length || duplicateSkus.length) {
    throw new AppError(
      "AMBIGUOUS_PDF_ROWS",
      "Each order row must have a unique line number and SKU.",
      422,
    );
  }
}

export async function extractOrderLines(file: File): Promise<OrderLine[]> {
  if (file.size === 0) {
    throw new AppError("EMPTY_PDF", "The PDF is empty.", 400);
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new AppError("PDF_TOO_LARGE", "The PDF must be 2 MB or smaller.", 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (header !== PDF_MAGIC) {
    throw new AppError(
      "UNSUPPORTED_PDF",
      "The document is not a valid PDF file.",
      415,
    );
  }

  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = getDocument({
      data: bytes,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    if (pdf.numPages !== 1) {
      throw new AppError(
        "PDF_PAGE_LIMIT",
        "Use a one-page PDF for this prototype.",
        422,
      );
    }

    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const fragments: TextFragment[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      fragments.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
      });
    }

    if (fragments.length === 0 || fragments.map((item) => item.text).join("").length < 12) {
      throw new AppError(
        "PDF_NO_TEXT_LAYER",
        "No extractable text was found. Scanned PDFs are outside this prototype; export a text-based PDF.",
        422,
      );
    }

    const sourceLines = reconstructTextLines(fragments);
    const lines = sourceLines
      .map(parseOrderRow)
      .filter((line): line is OrderLine => line !== null)
      .sort((a, b) => a.lineNumber - b.lineNumber);
    validateOrderLines(lines);
    return lines;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "PDF_READ_FAILED",
      "The PDF text could not be read. Try exporting the document again.",
      422,
    );
  }
}
