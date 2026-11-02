export interface PdfHighlight { page: number; item: number; start: number; end: number }

function normalize(text: string) {
  return text.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Match the saved passage against the original PDF, including across page breaks.
 * Offsets map back to the actual PDF text items, so highlights follow the text layer.
 */
export function findPdfPassage(pages: string[][], passage: string) {
  const items: { page: number; item: number; start: number; end: number; offsets: number[]; ends: number[] }[] = [];
  let text = "";
  pages.forEach((page, p) => page.forEach((value, i) => {
    const offsets: number[] = [];
    const ends: number[] = [];
    let normalized = "";
    let rawOffset = 0;
    for (const character of value) {
      const part = normalize(character);
      normalized += part;
      for (let n = 0; n < part.length; n++) { offsets.push(rawOffset); ends.push(rawOffset + character.length); }
      rawOffset += character.length;
    }
    items.push({ page: p + 1, item: i, start: text.length, end: text.length + normalized.length, offsets, ends });
    text += normalized;
  }));
  let needle = normalize(passage);
  if (!needle) return { highlights: [] as PdfHighlight[], partial: false };
  let position = text.indexOf(needle);
  const partial = position < 0;
  if (partial) {
    // Extraction orders can differ in tables. Highlight only a substantial,
    // exact phrase instead of guessing a page from unrelated keywords.
    const words = passage.split(/\s+/).filter(Boolean);
    search: for (const length of [80, 40, 20, 12, 8]) {
      if (words.length < length) continue;
      for (let start = 0; start + length <= words.length; start += 1) {
        const candidate = normalize(words.slice(start, start + length).join(" "));
        const found = text.indexOf(candidate);
        if (found >= 0) { position = found; needle = candidate; break search; }
      }
    }
  }
  if (position < 0) return { highlights: [] as PdfHighlight[], partial: false };
  const end = position + needle.length;
  const highlights = items.filter((item) => item.start < end && item.end > position && item.offsets.length)
    .map((item) => ({ page: item.page, item: item.item,
      start: item.offsets[Math.max(0, position - item.start)],
      end: item.ends[Math.min(item.offsets.length, end - item.start) - 1],
    }));
  return { highlights, partial };
}
