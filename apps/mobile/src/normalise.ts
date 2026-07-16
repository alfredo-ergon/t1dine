// Accent- and case-insensitive text normalisation, shared by offline search
// (./search) and food iconography (./foodEmoji). Kept in its own tiny,
// dependency-free module so both can reuse the exact same folding rules —
// so "pao"/"Pão" and "acucar"/"açúcar" always match the same way — without
// pulling the catalog into a consumer that only needs the string helper.
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .trim();
}
