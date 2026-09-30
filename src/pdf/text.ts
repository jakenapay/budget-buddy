// jsPDF's built-in Helvetica only prints Latin-1 (U+0020–U+007E and
// U+00A1–U+00FF). Tested with jsPDF 4.2.1: common punctuation outside it
// (… – — € ’ “ ” •) is silently dropped, and anything further out (₱, emoji,
// CJK) corrupts the whole string. So every string is cleaned before drawing.

const REPLACEMENTS: Record<string, string> = {
  "…": "...",
  "–": "-",
  "—": "-",
  "−": "-",
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "„": '"',
  "•": "·",
  "€": "EUR",
  "™": "TM",
  " ": " ",
  // Letters with no accent to strip, so NFKD can't simplify them.
  "Ł": "L",
  "ł": "l",
  "Đ": "D",
  "đ": "d",
  "Ħ": "H",
  "ħ": "h",
  "ı": "i",
};

const isLatin1 = (cp: number): boolean => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa1 && cp <= 0xff);
const LATIN1 = /^[ -~¡-ÿ]+$/;
/** Emoji and the invisible joiners/selectors that glue emoji together. */
const PICTOGRAPH = /\p{Extended_Pictographic}|‍|️/u;

/**
 * Makes text safe for the PDF font: keeps Latin-1, maps typographic
 * punctuation to plain equivalents, drops emoji, strips accents the font
 * lacks ("ő" → "o"), and shows "?" for anything else (e.g. CJK).
 */
export function toPdfText(raw: string): string {
  let out = "";
  for (const ch of raw.normalize("NFC")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isLatin1(cp)) out += ch;
    else if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
    else if (PICTOGRAPH.test(ch)) continue;
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += base && LATIN1.test(base) ? base : "?";
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Width of `text` in mm at `sizePt`, from the real PDF font metrics. */
export type Measure = (text: string, sizePt: number, bold: boolean) => number;

/**
 * Shortens text to fit `maxWidth`, ending in "..." (the font has no "…"
 * glyph). Binary search over characters, so it's fast even for 40 chars.
 */
export function fitText(text: string, maxWidth: number, sizePt: number, bold: boolean, measure: Measure): string {
  if (measure(text, sizePt, bold) <= maxWidth) return text;
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${chars.slice(0, mid).join("").trimEnd()}...`;
    if (measure(candidate, sizePt, bold) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "..." : `${chars.slice(0, lo).join("").trimEnd()}...`;
}
