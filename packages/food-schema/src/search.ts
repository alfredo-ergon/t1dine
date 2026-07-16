// Shared accent- and case-insensitive text normalisation for food search.
//
// One folding rule for the whole platform — the public `GET /catalog/foods`
// filter, the search-index document builder, and (eventually) the mobile
// offline catalogue — so "pao"/"Pão" and "acucar"/"açúcar" always match the
// same way regardless of surface. Decompose to NFD, then strip combining
// diacritics (via the Unicode `\p{Diacritic}` property, which avoids embedding
// literal combining characters in source).

/** Accent-insensitive, case-insensitive normalisation for search matching. */
export function normaliseSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
