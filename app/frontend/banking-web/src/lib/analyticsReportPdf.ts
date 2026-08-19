// Builds and saves a real PDF analytics report client-side with jsPDF - same
// approach as statementPrinter.ts's downloadStatementPdf: doc.save() triggers
// an actual browser file download, not a print-dialog workaround.
import { jsPDF } from "jspdf";
import type { Totals, CategoryRow } from "@/lib/transactionAnalytics";

export interface AnalyticsReportData {
  rangeLabel: string;
  totals: Totals;
  categories: CategoryRow[];
}

function formatINR(n: number): string {
  return `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
}

export function downloadAnalyticsReportPdf(data: AnalyticsReportData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 56;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.setFontSize(20);
  doc.text("SecureBank", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Agentic Banking", marginX, y + 14);

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Transaction Analytics Report", 539, y - 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(data.rangeLabel, 539, y + 10, { align: "right" });

  y += 30;
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(2);
  doc.line(marginX, y, 539, y);

  y += 36;
  const cells: [string, string][] = [
    ["Total Income", formatINR(data.totals.income)],
    ["Total Expenses", formatINR(data.totals.expenses)],
    ["Net Cash Flow", `${data.totals.net >= 0 ? "+" : "-"}${formatINR(Math.abs(data.totals.net))}`],
    ["Avg. Transaction", formatINR(data.totals.avg)],
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
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Expense Categories", marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const topCategories = data.categories.slice(0, 10);
  if (topCategories.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text("No expenses recorded in this period.", marginX, y);
    y += 18;
  } else {
    for (const cat of topCategories) {
      doc.setTextColor(15, 23, 42);
      doc.text(cat.category, marginX, y);
      doc.setTextColor(100, 116, 139);
      doc.text(`${cat.percentage}%`, 440, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(formatINR(cat.amount), 539, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 20;
    }
  }

  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, 539, y);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Generated from your SecureBank account activity.", marginX, y + 16);

  const filename = `SecureBank-Analytics-Report-${data.rangeLabel.replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}
