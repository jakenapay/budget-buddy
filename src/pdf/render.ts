import { jsPDF } from "jspdf";
import type { Plan, Summary } from "../model/state";
import { pdfFileName } from "./filename";
import { layoutPdf, type Op } from "./layout";
import type { Measure } from "./text";

// This module is loaded with import() when "Save as PDF" is pressed, so
// jsPDF (the largest dependency) never slows down the first page load.

export function measureWith(doc: jsPDF): Measure {
  return (text, sizePt, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(sizePt);
    return doc.getTextWidth(text);
  };
}

function draw(doc: jsPDF, ops: readonly Op[]): void {
  for (const op of ops) {
    if (op.kind === "rect") {
      if (op.fill) doc.setFillColor(...op.fill);
      if (op.stroke) {
        doc.setDrawColor(...op.stroke);
        doc.setLineWidth(op.lineWidth ?? 0.3);
      }
      const style = op.fill && op.stroke ? "FD" : op.stroke ? "S" : "F";
      if (op.radius) doc.roundedRect(op.x, op.y, op.w, op.h, op.radius, op.radius, style);
      else doc.rect(op.x, op.y, op.w, op.h, style);
    } else if (op.kind === "line") {
      doc.setDrawColor(...op.color);
      doc.setLineWidth(op.width);
      doc.line(op.x1, op.y1, op.x2, op.y2);
    } else {
      doc.setFont("helvetica", op.bold ? "bold" : "normal");
      doc.setFontSize(op.size);
      doc.setTextColor(...op.color);
      doc.text(op.text, op.x, op.y, { align: op.align });
    }
  }
}

/** Builds the one-page PDF. Separate from saving so tests can inspect it. */
export function buildPdf(plan: Plan, summary: Summary, generated: Date): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.setProperties({ title: plan.name || "Budget plan" });
  const { ops } = layoutPdf({ plan, summary, generated }, measureWith(doc));
  draw(doc, ops);
  // layoutPdf never adds a page, but check anyway rather than hand over a
  // broken file.
  if (doc.getNumberOfPages() !== 1) throw new Error("The PDF didn't fit on one page.");
  return doc;
}

/** Builds the PDF and starts the download; returns the file name. */
export function savePdf(plan: Plan, summary: Summary): string {
  const generated = new Date();
  const doc = buildPdf(plan, summary, generated);
  const name = pdfFileName(plan.name, generated);
  doc.save(name);
  return name;
}
