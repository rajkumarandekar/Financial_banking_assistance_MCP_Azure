// "View" opens a formatted preview in a new tab. "Download PDF" generates a
// real .pdf file client-side with jsPDF and saves it directly - an actual
// file download, not a print-dialog workaround.
import { jsPDF } from "jspdf";

export interface StatementData {
  cardName: string;
  last4: string;
  monthLabel: string;
  statementBalance: number;
  minimumDue: number;
  dueDate: string;
  creditLimit: number;
}

function formatINR(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

function buildStatementHtml(s: StatementData): string {
  const available = Math.max(s.creditLimit - s.statementBalance, 0);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${s.monthLabel} Statement - ${s.cardName}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 48px; background: #fff; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #16a34a; }
  .brand small { display: block; font-size: 11px; font-weight: 400; color: #64748b; }
  .title { text-align: right; }
  .title h1 { font-size: 18px; margin: 0; }
  .title p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
  .card-info { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 13px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .summary div { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .summary .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em; }
  .summary .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .footer { margin-top: 48px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">SecureBank<small>Agentic Banking</small></div>
    <div class="title"><h1>Credit Card Statement</h1><p>${s.monthLabel}</p></div>
  </div>
  <div class="card-info">
    <div><strong>${s.cardName}</strong><br/>•••• •••• •••• ${s.last4}</div>
    <div>Credit Limit: ₹${s.creditLimit.toLocaleString("en-IN")}</div>
  </div>
  <div class="summary">
    <div><div class="label">Statement Balance</div><div class="value">₹${s.statementBalance.toLocaleString("en-IN")}</div></div>
    <div><div class="label">Minimum Due</div><div class="value">₹${s.minimumDue.toLocaleString("en-IN")}</div></div>
    <div><div class="label">Due Date</div><div class="value">${new Date(s.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}</div></div>
    <div><div class="label">Available Credit</div><div class="value">₹${available.toLocaleString("en-IN")}</div></div>
  </div>
  <div class="footer">This statement was generated from your SecureBank account activity.</div>
</body>
</html>`;
}

export function viewStatement(data: StatementData): boolean {
  const win = window.open("", "_blank", "width=820,height=1060");
  if (!win) return false;
  win.document.open();
  win.document.write(buildStatementHtml(data));
  win.document.close();
  return true;
}

/** Builds and saves a real PDF file (via the browser's download mechanism -
 * jsPDF serializes to a Blob and triggers an <a download> click). */
export function downloadStatementPdf(s: StatementData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74); // SecureBank green
  doc.setFontSize(20);
  doc.text("SecureBank", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Agentic Banking", marginX, y + 14);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Credit Card Statement", 539, y - 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(s.monthLabel, 539, y + 10, { align: "right" });

  y += 30;
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(2);
  doc.line(marginX, y, 539, y);

  y += 32;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(s.cardName, marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`•••• •••• •••• ${s.last4}`, marginX, y + 15);
  doc.text(`Credit Limit: Rs. ${s.creditLimit.toLocaleString("en-IN")}`, 539, y, { align: "right" });

  y += 40;
  const available = Math.max(s.creditLimit - s.statementBalance, 0);
  const cells: [string, string][] = [
    ["Statement Balance", formatINR(s.statementBalance)],
    ["Minimum Due", formatINR(s.minimumDue)],
    ["Due Date", new Date(s.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })],
    ["Available Credit", formatINR(available)],
  ];
  const colWidth = (539 - marginX) / 2;
  cells.forEach(([label, value], i) => {
    const cx = marginX + (i % 2) * colWidth;
    const cy = y + Math.floor(i / 2) * 56;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.75);
    doc.roundedRect(cx, cy, colWidth - 12, 44, 4, 4);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), cx + 10, cy + 16);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(value, cx + 10, cy + 33);
    doc.setFont("helvetica", "normal");
  });

  y += 130;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, 539, y);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("This statement was generated from your SecureBank account activity.", marginX, y + 16);

  const filename = `${s.monthLabel.replace(/\s+/g, "-")}-${s.cardName.replace(/\s+/g, "-")}-Statement.pdf`;
  doc.save(filename);
}
