#!/usr/bin/env python3
"""Generate a fictional Tesco-labelled DeliveryCheck order PDF."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "tesco-test-delivery-note.pdf"

NAVY = colors.HexColor("#10243E")
BLUE = colors.HexColor("#00539F")
RED = colors.HexColor("#E31B23")
PALE_BLUE = colors.HexColor("#EEF5FB")
INK = colors.HexColor("#18202A")
MUTED = colors.HexColor("#626D79")
LINE = colors.HexColor("#D7DEE6")

ROWS = [
    (1, "TSC-TEA-80", "Tesco Original Tea Bags 80 Pack", 1),
    (2, "TSC-MILK-2L", "Tesco Semi Skimmed Milk 2L", 1),
    (3, "TSC-BREAD-800", "Tesco White Bread 800g", 1),
    (4, "TSC-CHORIZO-80", "Tesco Chorizo Slices 80g", 1),
    (5, "TSC-MAYO-L500", "Tesco Light Mayonnaise 500ml", 1),
]


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    base = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=29,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=2 * mm,
    )
    eyebrow = ParagraphStyle(
        "Eyebrow",
        parent=base["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=RED,
        alignment=TA_LEFT,
        spaceAfter=6 * mm,
    )
    body = ParagraphStyle(
        "Body",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=MUTED,
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=MUTED,
    )
    meta_value = ParagraphStyle(
        "MetaValue",
        parent=body,
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=INK,
        alignment=TA_RIGHT,
    )

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Tesco Grocery Delivery - DeliveryCheck Test Order",
        author="DeliveryCheck test fixture generator",
        subject="Fictional text-layer order for prototype testing",
    )

    story = [
        Paragraph("Grocery delivery note", title),
        Paragraph("SAMPLE - NOT ISSUED BY OR AFFILIATED WITH TESCO", eyebrow),
    ]

    meta = Table(
        [
            [Paragraph("Supplier", meta_label), Paragraph("Tesco-labelled test fixture", meta_value)],
            [Paragraph("Reference", meta_label), Paragraph("TSC-DEMO-001", meta_value)],
            [Paragraph("Purpose", meta_label), Paragraph("DeliveryCheck prototype test", meta_value)],
        ],
        colWidths=[35 * mm, 139 * mm],
        rowHeights=[10 * mm, 10 * mm, 10 * mm],
    )
    meta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4 * mm),
            ]
        )
    )
    story.extend([meta, Spacer(1, 9 * mm)])

    data = [["Line", "SKU", "Product", "Quantity"]]
    data.extend([[str(line), sku, product, str(quantity)] for line, sku, product, quantity in ROWS])
    order = Table(
        data,
        colWidths=[19 * mm, 42 * mm, 87 * mm, 26 * mm],
        rowHeights=[12 * mm] + [15 * mm] * len(ROWS),
    )
    order.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (1, 1), (1, -1), "Courier-Bold"),
                ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 1), (2, -1), "Helvetica"),
                ("FONTNAME", (3, 1), (3, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (3, 0), (3, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_BLUE]),
                ("GRID", (0, 0), (-1, -1), 0.7, LINE),
                ("BOX", (0, 0), (-1, -1), 1, BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ]
        )
    )
    story.extend([order, Spacer(1, 9 * mm)])
    story.append(
        Paragraph(
            "Testing note: Photo 1 must show the complete unchanged delivery in one overview. Additional photos may clarify labels on those same visible items; they do not add units to the count.",
            body,
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "This fictional document contains selectable text and exists only to test DeliveryCheck. It is not a Tesco receipt, invoice, or proof of purchase.",
            body,
        )
    )

    doc.build(story)


if __name__ == "__main__":
    build()
