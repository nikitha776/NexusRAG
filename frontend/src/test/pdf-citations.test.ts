import { expect, it } from "vitest";
import { findPdfPassage } from "@/lib/pdf-citations";

it("maps a saved passage across PDF items and page boundaries", () => {
  const result = findPdfPassage([["Title", "Atlas launches on"], ["15 December 2026.", "Other text"]], "Atlas launches on 15 December 2026.");
  expect(result.partial).toBe(false);
  expect(result.highlights).toEqual([
    { page: 1, item: 1, start: 0, end: 17 },
    { page: 2, item: 0, start: 0, end: 16 },
  ]);
});

it("matches ligatures, punctuation, hyphenation and whitespace while retaining original offsets", () => {
  const result = findPdfPassage([["A ﬁnal re-", "view: tomorrow."]], "final review tomorrow");
  expect(result.partial).toBe(false);
  expect(result.highlights[0]).toMatchObject({ start: 2, end: 9 });
  expect(result.highlights[1]).toMatchObject({ start: 0, end: 14 });
  expect(findPdfPassage([["𝔸"]], "A").highlights[0]).toMatchObject({ start: 0, end: 2 });
});

it("reports partial exact phrases when extraction order differs and avoids keyword guesses", () => {
  const phrase = "The product team will launch the new release tomorrow";
  const result = findPdfPassage([[phrase]], `Different table heading ${phrase} rearranged column text`);
  expect(result.partial).toBe(true);
  expect(result.highlights.length).toBeGreaterThan(0);
  expect(findPdfPassage([["Unrelated data about launch"]], "A different passage with no reliable matching phrase").highlights).toEqual([]);
  expect(findPdfPassage([[]], "Scanned page").highlights).toEqual([]);
  expect(findPdfPassage([["text"]], " ").highlights).toEqual([]);
});
