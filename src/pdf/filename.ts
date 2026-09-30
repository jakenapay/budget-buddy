/**
 * "October plan!" on 2026-09-30 → "october-plan-2026-09-30.pdf".
 * Letters, numbers and dashes only: accents are stripped ("Café" → "cafe"),
 * everything else becomes a dash, and an empty name falls back to
 * "budget-plan". The date is the user's local date.
 */
export function pdfFileName(planName: string, date: Date): string {
  const slug = planName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  const pad = (n: number): string => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${slug || "budget-plan"}-${day}.pdf`;
}
