"""Renders a document's plain-text content (as already produced by
generateStatement/generateReceipt/generateLoanLetter) into a simple PDF.

Kept deliberately basic - monospace body text in a bordered page - since the
source content is already formatted as aligned plain text (see mcp_tools.py).
"""
import base64

from fpdf import FPDF
from fpdf.enums import XPos, YPos

# fpdf2's built-in core fonts (Courier/Helvetica/Times) only support Latin-1/
# WinAnsi encoding - no rupee sign or other non-Latin-1 characters. Rendering
# one crashes fpdf2 outright ("Not enough horizontal space to render a single
# character") rather than degrading gracefully, so swap known symbols for a
# safe ASCII equivalent before rendering, and defensively drop anything else
# outside Latin-1 rather than crash the whole PDF over one stray character.
_SYMBOL_REPLACEMENTS = {
    "₹": "Rs. ",  # ₹
    "–": "-",  # –
    "—": "-",  # —
    "‘": "'", "’": "'",  # ‘ ’
    "“": '"', "”": '"',  # “ ”
}


def _sanitize_for_pdf(text: str) -> str:
    for symbol, replacement in _SYMBOL_REPLACEMENTS.items():
        text = text.replace(symbol, replacement)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def render_pdf_base64(title: str, content: str) -> str:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Courier", "B", 14)
    pdf.multi_cell(0, 8, _sanitize_for_pdf(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(4)
    pdf.set_font("Courier", "", 10)
    for line in content.splitlines():
        line = _sanitize_for_pdf(line)
        pdf.multi_cell(0, 5, line if line.strip() else " ", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf_bytes = bytes(pdf.output())
    return base64.b64encode(pdf_bytes).decode("ascii")
