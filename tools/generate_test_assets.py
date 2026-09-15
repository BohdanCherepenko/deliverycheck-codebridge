#!/usr/bin/env python3
"""Generate DeliveryCheck's text PDF and printable label sheets.

This script creates only documents and labels. It deliberately does not create
photographs or recognition responses.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"

INK = colors.HexColor("#17211B")
MUTED = colors.HexColor("#5F6963")
GREEN = colors.HexColor("#246B4B")
CREAM = colors.HexColor("#F7F5EF")
LINE = colors.HexColor("#D5DBD6")


@dataclass(frozen=True)
class ProductLabel:
    sku: str
    product: str


ORDER_ROWS = [
    (1, "DEO-FRESH", "Fresh Deodorant", 1),
    (2, "DRK-LEM500", "Sparkling Lemon Drink 500ml", 1),
    (3, "PUZ-001", "Jigsaw Puzzle", 1),
    (4, "PIE-BRAM-01", "Bramley Apple Pie", 1),
]

TEST_A_PRODUCTS = [
    ProductLabel("DEO-FRESH", "Fresh Deodorant"),
    ProductLabel("DRK-LEM330", "Sparkling Lemon Drink 330ml"),
    ProductLabel("PUZ-001", "Jigsaw Puzzle"),
    ProductLabel("PUZ-001", "Jigsaw Puzzle"),
    ProductLabel("PIE-BRAM-01", "Bramley Apple Pie"),
]

TEST_C_PRODUCTS = [
    ProductLabel("DEO-FRESH", "Fresh Deodorant"),
    ProductLabel("DRK-LEM500", "Sparkling Lemon Drink 500ml"),
    ProductLabel("PUZ-001", "Jigsaw Puzzle"),
    ProductLabel("PIE-BRAM-01", "Bramley Apple Pie"),
]

NEW_INPUT_ROWS = [
    (1, "NOTE-A5", "A5 Notebook", 2),
    (2, "PEN-BLK", "Black Pen", 1),
]

NEW_INPUT_PRODUCTS = [
    ProductLabel("NOTE-A5", "A5 Notebook"),
    ProductLabel("NOTE-A5", "A5 Notebook"),
    ProductLabel("PEN-BLK", "Black Pen"),
]


def document(path: Path, title: str, subtitle: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=title,
        author="DeliveryCheck test fixture generator",
        subject=subtitle,
    )


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=29,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=5 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=MUTED,
            spaceAfter=7 * mm,
        ),
        "product": ParagraphStyle(
            "Product",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=19,
            textColor=INK,
            alignment=TA_CENTER,
        ),
        "sku": ParagraphStyle(
            "Sku",
            parent=base["BodyText"],
            fontName="Courier-Bold",
            fontSize=19,
            leading=23,
            textColor=INK,
            alignment=TA_CENTER,
        ),
    }


def heading(st: dict[str, ParagraphStyle], title: str, subtitle: str):
    return [Paragraph(title, st["title"]), Paragraph(subtitle, st["subtitle"])]


def write_order(path: Path, title: str, rows: list[tuple[int, str, str, int]]) -> None:
    st = styles()
    story = heading(
        st,
        title,
        "Text-layer fixture for DeliveryCheck. The four columns below are the complete order source.",
    )
    data = [["Line", "SKU", "Product", "Quantity"]]
    data.extend([[str(line), sku, product, str(quantity)] for line, sku, product, quantity in rows])
    table = Table(data, colWidths=[22 * mm, 42 * mm, 83 * mm, 28 * mm], rowHeights=14 * mm)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (1, 1), (1, -1), "Courier-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
                ("GRID", (0, 0), (-1, -1), 0.7, LINE),
                ("BOX", (0, 0), (-1, -1), 1, GREEN),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story.extend([table, Spacer(1, 8 * mm)])
    story.append(
        Paragraph(
            "Fixture note: this page contains selectable text. Scans without a text layer are intentionally unsupported.",
            st["subtitle"],
        )
    )
    document(path, title, "DeliveryCheck text order fixture").build(story)


def product_card(st: dict[str, ParagraphStyle], item: ProductLabel):
    return [
        Paragraph(item.product, st["product"]),
        Spacer(1, 4 * mm),
        Paragraph(f"SKU: {item.sku}", st["sku"]),
    ]


def write_product_labels(path: Path, title: str, products: list[ProductLabel]) -> None:
    st = styles()
    story = heading(
        st,
        title,
        "Print at 100% and cut on the card borders. Each label shows only the product name and exact SKU.",
    )
    cells = []
    for index in range(0, len(products), 2):
        row = [product_card(st, products[index])]
        row.append(product_card(st, products[index + 1]) if index + 1 < len(products) else "")
        cells.append(row)
    table = Table(cells, colWidths=[84 * mm, 84 * mm], rowHeights=55 * mm)
    table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1, GREEN),
                ("INNERGRID", (0, 0), (-1, -1), 0.8, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5 * mm),
            ]
        )
    )
    story.append(table)
    document(path, title, "DeliveryCheck printable product labels").build(story)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    generated_paths = [
        OUTPUT / "deliverycheck-order.pdf",
        OUTPUT / "test-a-product-labels.pdf",
        OUTPUT / "test-c-product-labels.pdf",
        OUTPUT / "new-input-order.pdf",
        OUTPUT / "new-input-product-labels.pdf",
    ]
    write_order(generated_paths[0], "DeliveryCheck sample order", ORDER_ROWS)
    write_product_labels(
        generated_paths[1],
        "Test A and B product labels",
        TEST_A_PRODUCTS,
    )
    write_product_labels(
        generated_paths[2],
        "Test C product labels",
        TEST_C_PRODUCTS,
    )
    write_order(
        generated_paths[3],
        "Held-out input order",
        NEW_INPUT_ROWS,
    )
    write_product_labels(
        generated_paths[4],
        "Held-out input product labels",
        NEW_INPUT_PRODUCTS,
    )
    for path in generated_paths:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
