"""Renders a document's plain-text content (as already produced by
generateStatement/generateReceipt/generateLoanLetter) into a simple PDF.

Kept deliberately basic - monospace body text in a bordered page - since the
source content is already formatted as aligned plain text (see mcp_tools.py).
"""
import base64

from fpdf import FPDF


def render_pdf_base64(title: str, content: str) -> str:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Courier", "B", 14)
    pdf.multi_cell(0, 8, title)
    pdf.ln(4)
    pdf.set_font("Courier", "", 10)
    for line in content.splitlines():
        pdf.multi_cell(0, 5, line if line.strip() else " ")

    pdf_bytes = bytes(pdf.output())
    return base64.b64encode(pdf_bytes).decode("ascii")
