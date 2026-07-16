// Decorative food iconography. Maps a CanonicalFood to a single emoji glyph
// used as a visual "flag" tile in food lists and on the detail hero (Aurora
// brief: food cards lead with an emoji tile). Pure, deterministic, offline —
// no assets, no network — so it works exactly the same in every list.
//
// PURELY DECORATIVE: the glyph is never injected into an accessibilityLabel,
// and every tile that renders it is hidden from screen readers (the
// surrounding name/type text already carries the meaning). It is NOT food
// data and never influences nutrients, confidence, or the dose path.

import type { CanonicalFood } from "@t1dine/food-schema";

import { normalise } from "./normalise";

// Ordered, specific-before-generic: the FIRST keyword found in the food's
// normalised name/synonym haystack wins, so "arroz doce" resolves to the
// pudding glyph before the plain "arroz" rice glyph, "batata frita" before
// "batata", and so on. Keywords are pre-normalised (lowercase, accent-free)
// to match `normalise()`'s output.
const KEYWORD_TABLE: readonly { emoji: string; keywords: readonly string[] }[] = [
  // --- Bakery & grains (specific first) ---
  { emoji: "🍮", keywords: ["arroz doce", "leite creme", "pudim"] },
  { emoji: "🥧", keywords: ["pastel de nata", "pastel", "empada", "quiche"] },
  { emoji: "🥐", keywords: ["croissant"] },
  { emoji: "🥞", keywords: ["panqueca", "panquecas"] },
  { emoji: "🍩", keywords: ["donut", "donuts", "bola de berlim"] },
  { emoji: "🍰", keywords: ["bolo", "pao de lo", "tarte", "cheesecake"] },
  { emoji: "🍪", keywords: ["bolacha", "bolachas", "biscoito", "biscoitos"] },
  { emoji: "🍞", keywords: ["pao", "torrada", "broa", "baguete", "tosta"] },
  { emoji: "🥪", keywords: ["sandes", "sanduiche"] },
  { emoji: "🍚", keywords: ["arroz"] },
  { emoji: "🍝", keywords: ["massa", "esparguete", "macarrao", "lasanha", "talharim"] },
  { emoji: "🥣", keywords: ["cereais", "flocos", "aveia", "papa", "muesli", "granola", "iogurte"] },
  // --- Prepared dishes ---
  { emoji: "🍕", keywords: ["pizza"] },
  { emoji: "🍔", keywords: ["hamburguer", "hamburger"] },
  { emoji: "🌭", keywords: ["cachorro", "hot dog"] },
  { emoji: "🍟", keywords: ["batata frita", "batatas fritas", "fritas"] },
  // NB: no bare "cozido"/"guisado" here — they are preparation words ("arroz
  // cozido", "bacalhau cozido") and would wrongly grab plain ingredients.
  { emoji: "🍲", keywords: ["sopa", "caldo", "canja", "feijoada", "acorda", "cozido a portuguesa"] },
  { emoji: "🍣", keywords: ["sushi", "sashimi"] },
  { emoji: "🥗", keywords: ["salada", "alface"] },
  // --- Proteins ---
  { emoji: "🐟", keywords: ["bacalhau", "peixe", "pescada", "dourada", "robalo", "sardinha", "atum", "salmao", "linguado"] },
  { emoji: "🦐", keywords: ["camarao", "gamba", "marisco", "ameijoa", "mexilhao", "lagosta"] },
  { emoji: "🦑", keywords: ["polvo", "lula", "choco"] },
  { emoji: "🍗", keywords: ["frango", "galinha", "peru"] },
  { emoji: "🥩", keywords: ["carne", "bife", "vaca", "porco", "vitela", "borrego", "cordeiro", "lombo"] },
  { emoji: "🥓", keywords: ["fiambre", "presunto", "chourico", "salsicha", "enchido", "bacon", "toucinho"] },
  { emoji: "🥚", keywords: ["ovo", "ovos", "omeleta"] },
  { emoji: "🧀", keywords: ["queijo", "requeijao"] },
  { emoji: "🫘", keywords: ["feijao", "grao", "lentilha", "lentilhas", "ervilha"] },
  // --- Fruit ---
  { emoji: "🍌", keywords: ["banana"] },
  { emoji: "🍎", keywords: ["maca"] },
  { emoji: "🍐", keywords: ["pera"] },
  { emoji: "🍊", keywords: ["laranja", "tangerina", "clementina", "mandarina"] },
  { emoji: "🍋", keywords: ["limao", "lima"] },
  { emoji: "🍇", keywords: ["uva", "uvas", "passa"] },
  { emoji: "🍓", keywords: ["morango", "morangos"] },
  { emoji: "🫐", keywords: ["mirtilo", "framboesa", "amora"] },
  { emoji: "🍑", keywords: ["pessego", "alperce", "damasco"] },
  { emoji: "🍉", keywords: ["melancia"] },
  { emoji: "🍈", keywords: ["melao"] },
  { emoji: "🍍", keywords: ["ananas", "abacaxi"] },
  { emoji: "🥝", keywords: ["kiwi"] },
  { emoji: "🍒", keywords: ["cereja", "cerejas", "ginja"] },
  { emoji: "🥥", keywords: ["coco"] },
  { emoji: "🥑", keywords: ["abacate"] },
  { emoji: "🫒", keywords: ["azeite", "azeitona", "azeitonas"] },
  // --- Vegetables ---
  { emoji: "🍅", keywords: ["tomate"] },
  { emoji: "🥕", keywords: ["cenoura"] },
  { emoji: "🥦", keywords: ["brocolo", "brocolos", "brocolis", "couve"] },
  { emoji: "🧅", keywords: ["cebola"] },
  { emoji: "🧄", keywords: ["alho"] },
  { emoji: "🍄", keywords: ["cogumelo", "cogumelos"] },
  { emoji: "🌽", keywords: ["milho"] },
  { emoji: "🥒", keywords: ["pepino"] },
  { emoji: "🫑", keywords: ["pimento", "pimentao"] },
  { emoji: "🍆", keywords: ["beringela"] },
  { emoji: "🥔", keywords: ["batata", "batata doce"] },
  { emoji: "🎃", keywords: ["abobora"] },
  { emoji: "🧈", keywords: ["manteiga", "margarina"] },
  // --- Sweets & drinks (checked before plain milk so "café/chá com leite"
  //     reads as the drink, not as milk) ---
  { emoji: "🍫", keywords: ["chocolate", "cacau", "nutella"] },
  { emoji: "🍦", keywords: ["gelado"] },
  { emoji: "🍯", keywords: ["mel"] },
  { emoji: "🍬", keywords: ["acucar", "rebucado", "gomas", "caramelo", "doce"] },
  { emoji: "🍿", keywords: ["pipoca", "pipocas"] },
  { emoji: "☕", keywords: ["cafe", "galao", "expresso"] },
  { emoji: "🍵", keywords: ["cha", "infusao"] },
  { emoji: "🍷", keywords: ["vinho"] },
  { emoji: "🍺", keywords: ["cerveja", "imperial"] },
  { emoji: "🧃", keywords: ["sumo", "nectar"] },
  { emoji: "🥤", keywords: ["refrigerante", "cola", "gasosa"] },
  { emoji: "💧", keywords: ["agua"] },
  { emoji: "🥛", keywords: ["leite"] },
  // --- Nuts, seeds, misc ---
  { emoji: "🥜", keywords: ["amendoa", "amendoas", "amendoim", "noz", "nozes", "caju", "pistacio", "frutos secos", "avela"] },
];

// Last-resort glyph by food type — guarantees there is ALWAYS a sensible tile
// even for a food whose name matches no keyword (e.g. a freshly created custom
// food, or a brand/restaurant item with an unusual name).
const TYPE_FALLBACK: Record<CanonicalFood["type"], string> = {
  ingredient: "🥗",
  packaged: "🥫",
  restaurant: "🍽️",
  recipe: "🍲",
  custom: "🍴",
};

/**
 * A single decorative emoji for a food. Matches keywords against the food's
 * normalised names + synonyms (specific before generic), falling back to a
 * per-type glyph so the result is never empty.
 */
export function foodEmoji(food: CanonicalFood): string {
  const haystack = food.names
    .flatMap((n) => [n.name, ...n.synonyms])
    .map(normalise)
    .join(" ");

  for (const { emoji, keywords } of KEYWORD_TABLE) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return emoji;
    }
  }

  return TYPE_FALLBACK[food.type] ?? "🍴";
}
