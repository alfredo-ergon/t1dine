// Machine-assisted English localisation for INSA (BDCA v7.1) Portuguese food
// names via a curated PT->EN food-term glossary.
//
// GOVERNANCE / HONESTY:
//   * This is a TRANSPARENT, token-wise glossary translation — NOT human-reviewed
//     and NOT authoritative EN localisation. It exists so English-locale users see
//     a readable approximation instead of a raw Portuguese string.
//   * We NEVER fabricate a per-food translation. Only vocabulary present in the
//     curated glossary below is translated. Any token we do not know is left in
//     Portuguese verbatim — so the output is honest about what was and was not
//     understood (e.g. brand names, proper preparation names, rare species).
//   * Translation is token-wise and preserves the source STRUCTURE (comma
//     segments, word order). Portuguese places the adjective after the noun, so
//     e.g. "Arroz branco cozido" -> "Rice white boiled" (not reordered). That is
//     intentional: reordering would be an editorial claim we are not making.
//
// The pt-PT name remains the source of truth; this only feeds the `en` locale.
//
// Matching: accent-folded, case-insensitive. Multi-word phrases are matched
// (longest first) before single tokens so idioms like "sem pele" -> "skinless"
// win over word-by-word "without skin". Output is lower-cased vocabulary with the
// first letter of the whole name capitalised.

/** Accent-fold + lowercase for case/diacritic-insensitive matching. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Curated PT -> EN food-term glossary. Keys are written naturally (lower-case,
 * with Portuguese accents) and folded at load time. Values are lower-case EN
 * vocabulary; the first letter of the final name is capitalised by
 * `translateInsaName`. Multi-word keys (with spaces) are treated as phrases and
 * matched before single tokens.
 *
 * Coverage targets the frequent INSA vocabulary (connectives, meats & cuts,
 * fish & seafood, dairy & eggs, staples, legumes, vegetables & herbs, fruit &
 * nuts, cooking methods & states, descriptors, beverages, and common dishes).
 * The long tail (rare species, brands, regional preparations) deliberately
 * stays Portuguese.
 */
const GLOSSARY_SOURCE: Record<string, string> = {
  // --- connectives / structure -------------------------------------------
  de: "of",
  com: "with",
  sem: "without",
  e: "and",
  ou: "or",
  para: "for",
  ao: "to",
  em: "in",
  tipo: "type",
  sabor: "flavour",
  variedades: "varieties",
  valor: "value",
  teor: "content",

  // --- multi-word phrases (matched before single tokens) -----------------
  "com pele": "with skin",
  "sem pele": "skinless",
  "com osso": "bone-in",
  "sem osso": "boneless",
  "com sal": "salted",
  "sem sal": "unsalted",
  "com açúcar": "with sugar",
  "sem açúcar": "sugar-free",
  "sem adição de açúcar": "no added sugar",
  "sem lactose": "lactose-free",
  "sem glúten": "gluten-free",
  "meio gordo": "semi-fat",
  "meio gorda": "semi-fat",
  "óleo alimentar": "cooking oil",
  "à base de": "based on",
  "a base de": "based on",
  "bebida vegetal": "plant-based drink",
  "creme vegetal": "vegetable spread",
  "para barrar": "for spreading",
  "no forno": "in the oven",
  "ao forno": "in the oven",
  "virgem extra": "extra virgin",
  "extra virgem": "extra virgin",
  "em pó": "powdered",
  "em calda": "in syrup",
  "em conserva": "preserved",
  "valor médio": "average value",
  "teor alcoólico": "alcoholic strength",
  "pão de forma": "sliced bread",
  "pão ralado": "breadcrumbs",
  "carne de vaca": "beef",
  "carne de porco": "pork",
  "carne de galinha": "hen meat",
  "carne picada": "minced meat",
  "queijo de cabra": "goat cheese",
  "queijo de ovelha": "sheep cheese",
  "queijo fresco": "fresh cheese",
  "leite de cabra": "goat milk",
  "leite de ovelha": "sheep milk",
  "leite de vaca": "cow milk",
  "ovo de galinha": "hen egg",
  "ovo de codorniz": "quail egg",
  "grão de bico": "chickpeas",
  "vinho do porto": "port wine",
  "vinho verde": "vinho verde wine",

  // --- hyphenated compound names (single tokens; matched via token lookup) --
  "grão-de-bico": "chickpeas",
  "feijão-verde": "green beans",
  "feijão-manteiga": "butter beans",
  "feijão-frade": "black-eyed peas",
  "feijão-branco": "white beans",
  "couve-flor": "cauliflower",
  "couve-lombarda": "savoy cabbage",
  "couve-galega": "galician kale",
  "couve-branca": "white cabbage",
  "couve-roxa": "red cabbage",
  "couve-portuguesa": "portuguese cabbage",
  "couve-de-bruxelas": "brussels sprouts",
  "alho-francês": "leek",
  "batata-doce": "sweet potato",
  "peixe-espada": "scabbardfish",
  "peixe-espada-preto": "black scabbardfish",
  "peixe-espada-branco": "silver scabbardfish",
  "arco-íris": "rainbow",
  "bolo-rei": "king cake",
  "açafrão-da-índia": "turmeric",

  // --- meats, poultry, game ----------------------------------------------
  porco: "pork",
  vaca: "beef",
  boi: "beef",
  frango: "chicken",
  galinha: "hen",
  peru: "turkey",
  pato: "duck",
  ganso: "goose",
  coelho: "rabbit",
  lebre: "hare",
  borrego: "lamb",
  carneiro: "mutton",
  cabrito: "kid goat",
  cabra: "goat",
  vitela: "veal",
  novilho: "young beef",
  cavalo: "horse",
  veado: "venison",
  javali: "wild boar",
  codorniz: "quail",
  perdiz: "partridge",
  faisão: "pheasant",
  carne: "meat",
  aves: "poultry",
  ave: "poultry",
  hambúrguer: "burger",
  bife: "steak",
  bifes: "steaks",
  febras: "pork steaks",
  fiambre: "ham",
  presunto: "cured ham",
  chouriço: "chorizo",
  salsicha: "sausage",
  salsichas: "sausages",
  linguiça: "linguiça sausage",
  morcela: "blood sausage",
  farinheira: "farinheira sausage",
  alheira: "alheira sausage",
  paio: "paio sausage",
  salpicão: "salpicão sausage",
  mortadela: "mortadella",
  salame: "salami",
  bacon: "bacon",
  toucinho: "fatback",
  entrecosto: "spare ribs",
  entremeada: "belly",
  entremeado: "belly",
  costeleta: "chop",
  costeletas: "chops",
  alcatra: "rump",
  acém: "chuck",
  vazia: "sirloin",
  cachaço: "neck",
  chispe: "trotter",
  picanha: "picanha",
  pá: "shoulder",
  lombo: "loin",
  peito: "breast",
  perna: "leg",
  coxa: "thigh",
  asa: "wing",
  costa: "back",
  costela: "rib",
  pele: "skin",
  fígado: "liver",
  rim: "kidney",
  rins: "kidneys",
  coração: "heart",
  língua: "tongue",
  sangue: "blood",
  tripa: "tripe",
  tripas: "tripe",
  miolos: "brains",
  mão: "trotter",
  almôndegas: "meatballs",
  espetada: "skewer",
  enchidos: "cured sausages",
  rojões: "pork chunks",
  banha: "lard",

  // --- fish & seafood ----------------------------------------------------
  peixe: "fish",
  peixinhos: "little fish",
  bacalhau: "cod",
  sardinha: "sardine",
  sardinhas: "sardines",
  atum: "tuna",
  pescada: "hake",
  polvo: "octopus",
  lula: "squid",
  lulas: "squid",
  choco: "cuttlefish",
  salmão: "salmon",
  cavala: "atlantic mackerel",
  sarda: "mackerel",
  carapau: "horse mackerel",
  chicharro: "horse mackerel",
  dourada: "sea bream",
  robalo: "sea bass",
  pargo: "common sea bream",
  goraz: "blackspot sea bream",
  cherne: "wreckfish",
  garoupa: "grouper",
  corvina: "meagre",
  tamboril: "monkfish",
  cantarilho: "redfish",
  redfish: "redfish",
  imperador: "alfonsino",
  safio: "conger eel",
  congro: "conger eel",
  enguia: "eel",
  enguias: "eels",
  truta: "trout",
  linguado: "sole",
  solha: "flounder",
  raia: "skate",
  espadarte: "swordfish",
  cação: "dogfish",
  abrótea: "forkbeard",
  maruca: "ling",
  anchova: "bluefish",
  faneca: "pouting",
  pescadinha: "small hake",
  bras: "brás style",
  filetes: "fillets",
  filete: "fillet",
  posta: "steak",
  postas: "steaks",
  ovas: "roe",
  // shellfish / molluscs
  camarão: "shrimp",
  gambas: "prawns",
  ameijoa: "clam",
  ameijoas: "clams",
  mexilhão: "mussel",
  mexilhões: "mussels",
  ostra: "oyster",
  ostras: "oysters",
  berbigão: "cockle",
  lagosta: "lobster",
  lagostim: "crayfish",
  caranguejo: "crab",
  sapateira: "brown crab",
  búzio: "whelk",
  marisco: "shellfish",

  // --- dairy & eggs ------------------------------------------------------
  leite: "milk",
  queijo: "cheese",
  requeijão: "curd cheese",
  iogurte: "yogurt",
  manteiga: "butter",
  margarina: "margarine",
  nata: "cream",
  natas: "cream",
  creme: "cream",
  kefir: "kefir",
  quark: "quark",
  flamengo: "flamengo cheese",
  ovo: "egg",
  ovos: "eggs",
  gema: "yolk",
  clara: "egg white",
  ovelha: "sheep",
  condensado: "condensed",
  evaporado: "evaporated",
  pasteurizado: "pasteurised",
  pasteurizada: "pasteurised",
  fermentado: "fermented",
  fermentada: "fermented",
  achocolatado: "chocolate-flavoured",
  aromatizado: "flavoured",
  açucarado: "sweetened",

  // --- staples: cereals, bread, pasta, potato ---------------------------
  arroz: "rice",
  pão: "bread",
  massa: "pasta",
  esparguete: "spaghetti",
  lasanha: "lasagna",
  farinha: "flour",
  trigo: "wheat",
  milho: "corn",
  centeio: "rye",
  aveia: "oats",
  cevada: "barley",
  sêmola: "semolina",
  flocos: "flakes",
  cereais: "cereals",
  cereal: "cereal",
  bolacha: "biscuit",
  bolachas: "biscuits",
  biscoitos: "biscuits",
  bolo: "cake",
  bolos: "cakes",
  pastel: "pastry",
  torrada: "toast",
  tosta: "toast",
  batata: "potato",
  batatas: "potatoes",
  mandioca: "cassava",
  amido: "starch",
  fécula: "starch",
  tapioca: "tapioca",
  farelo: "bran",
  glúten: "gluten",
  muesli: "muesli",

  // --- legumes -----------------------------------------------------------
  feijão: "beans",
  feijões: "beans",
  grão: "chickpeas",
  lentilhas: "lentils",
  ervilhas: "peas",
  ervilha: "pea",
  favas: "broad beans",
  tremoço: "lupini beans",
  tofu: "tofu",
  soja: "soy",

  // --- vegetables & herbs ------------------------------------------------
  tomate: "tomato",
  cebola: "onion",
  cebolada: "onion sauce",
  cenoura: "carrot",
  alho: "garlic",
  couve: "cabbage",
  alface: "lettuce",
  espinafres: "spinach",
  agrião: "watercress",
  nabo: "turnip",
  nabiças: "turnip greens",
  grelos: "turnip tops",
  brócolos: "broccoli",
  abóbora: "pumpkin",
  curgete: "courgette",
  beringela: "aubergine",
  pepino: "cucumber",
  pimento: "bell pepper",
  pimenta: "pepper",
  malagueta: "chilli",
  cogumelos: "mushrooms",
  cogumelo: "mushroom",
  alcachofra: "artichoke",
  beterraba: "beetroot",
  espargos: "asparagus",
  rabanete: "radish",
  aipo: "celery",
  chuchu: "chayote",
  funcho: "fennel",
  gengibre: "ginger",
  salsa: "parsley",
  coentros: "coriander",
  coentro: "coriander",
  hortelã: "mint",
  manjericão: "basil",
  alecrim: "rosemary",
  tomilho: "thyme",
  orégãos: "oregano",
  louro: "bay leaf",
  cebolinho: "chives",
  estragão: "tarragon",
  manjerona: "marjoram",
  cerefólio: "chervil",
  colorau: "paprika",
  açafrão: "saffron",
  cravinho: "clove",
  canela: "cinnamon",
  mostarda: "mustard",
  caril: "curry",
  vinagre: "vinegar",
  azeite: "olive oil",
  óleo: "oil",
  girassol: "sunflower",
  palma: "palm",
  coco: "coconut",
  sésamo: "sesame",
  linhaça: "flaxseed",
  azeitona: "olive",
  azeitonas: "olives",
  legumes: "vegetables",
  vegetais: "vegetables",
  hortícolas: "vegetables",
  raiz: "root",
  folha: "leaf",
  folhas: "leaves",
  rebentos: "sprouts",
  sementes: "seeds",
  semente: "seed",
  vagens: "green beans",
  polpa: "pulp",
  puré: "purée",

  // --- fruit & nuts ------------------------------------------------------
  maçã: "apple",
  maçãs: "apples",
  banana: "banana",
  laranja: "orange",
  pera: "pear",
  pêssego: "peach",
  uva: "grape",
  uvas: "grapes",
  ananás: "pineapple",
  morango: "strawberry",
  morangos: "strawberries",
  framboesa: "raspberry",
  mirtilo: "blueberry",
  ginja: "sour cherry",
  cereja: "cherry",
  cerejas: "cherries",
  ameixa: "plum",
  ameixas: "plums",
  alperce: "apricot",
  figo: "fig",
  figos: "figs",
  melão: "melon",
  meloa: "cantaloupe melon",
  melancia: "watermelon",
  kiwi: "kiwi",
  quivi: "kiwi",
  manga: "mango",
  papaia: "papaya",
  anona: "custard apple",
  dióspiro: "persimmon",
  nêspera: "loquat",
  marmelo: "quince",
  romã: "pomegranate",
  tangerina: "tangerine",
  clementina: "clementine",
  toranja: "grapefruit",
  limão: "lemon",
  lima: "lime",
  abacate: "avocado",
  carambola: "starfruit",
  tâmara: "date",
  tâmaras: "dates",
  passas: "raisins",
  castanha: "chestnut",
  castanhas: "chestnuts",
  amêndoa: "almond",
  amêndoas: "almonds",
  avelã: "hazelnut",
  avelãs: "hazelnuts",
  noz: "walnut",
  nozes: "walnuts",
  amendoim: "peanut",
  caju: "cashew",
  pistácio: "pistachio",
  pinhão: "pine nut",
  alfarroba: "carob",
  frutos: "fruits",
  fruta: "fruit",
  casca: "peel",
  sumo: "juice",
  néctar: "nectar",
  compota: "jam",
  doce: "jam",
  geleia: "jelly",
  marmelada: "quince paste",
  mel: "honey",
  calda: "syrup",

  // --- cooking methods & states ------------------------------------------
  cru: "raw",
  crua: "raw",
  crus: "raw",
  cruas: "raw",
  cozido: "boiled",
  cozida: "boiled",
  cozidos: "boiled",
  cozidas: "boiled",
  grelhado: "grilled",
  grelhada: "grilled",
  grelhados: "grilled",
  grelhadas: "grilled",
  assado: "roasted",
  assada: "roasted",
  assados: "roasted",
  assadas: "roasted",
  frito: "fried",
  frita: "fried",
  fritos: "fried",
  fritas: "fried",
  estufado: "stewed",
  estufada: "stewed",
  estufados: "stewed",
  estufadas: "stewed",
  guisado: "stewed",
  guisada: "stewed",
  salteado: "sautéed",
  salteada: "sautéed",
  escalfado: "poached",
  escalfada: "poached",
  estrelado: "fried",
  mexido: "scrambled",
  mexidos: "scrambled",
  panado: "breaded",
  panada: "breaded",
  recheado: "stuffed",
  recheada: "stuffed",
  seco: "dried",
  seca: "dried",
  secos: "dried",
  secas: "dried",
  desidratado: "dehydrated",
  desidratada: "dehydrated",
  fresco: "fresh",
  fresca: "fresh",
  frescos: "fresh",
  frescas: "fresh",
  salgado: "salted",
  salgada: "salted",
  demolhado: "soaked",
  demolhada: "soaked",
  demolhadas: "soaked",
  curado: "cured",
  curada: "cured",
  fumado: "smoked",
  fumada: "smoked",
  torrado: "roasted",
  congelado: "frozen",
  congelada: "frozen",
  congeladas: "frozen",
  enlatado: "canned",
  enlatados: "canned",
  conserva: "preserved",
  cristalizado: "candied",
  cristalizada: "candied",
  maduro: "ripe",
  madura: "ripe",
  ralado: "grated",
  ralada: "grated",
  moído: "ground",
  moída: "ground",
  escorrido: "drained",
  escorridos: "drained",
  temperado: "seasoned",
  temperada: "seasoned",
  preparado: "prepared",
  preparada: "prepared",
  instantâneo: "instant",
  solúvel: "instant",
  concentrado: "concentrated",
  diluído: "diluted",
  cozer: "for boiling",
  estufar: "for stewing",

  // --- descriptors -------------------------------------------------------
  natural: "natural",
  simples: "plain",
  inteiro: "whole",
  inteira: "whole",
  integral: "wholemeal",
  refinado: "refined",
  branco: "white",
  branca: "white",
  tinto: "red",
  preto: "black",
  preta: "black",
  vermelho: "red",
  vermelha: "red",
  amarelo: "yellow",
  amarela: "yellow",
  roxo: "purple",
  roxa: "purple",
  encarnado: "red",
  encarnada: "red",
  verde: "green",
  gordo: "full-fat",
  gorda: "fatty",
  magro: "low-fat",
  magra: "lean",
  meio: "semi",
  desnatado: "skimmed",
  líquido: "liquid",
  sólido: "solid",
  pó: "powder",
  pedaços: "pieces",
  rodelas: "slices",
  cubo: "cube",
  cubos: "cubes",
  tablete: "bar",
  light: "light",
  caseiro: "homemade",
  caseira: "homemade",
  industrial: "industrial",
  tradicional: "traditional",
  culinária: "cooking",
  culinário: "cooking",
  alimentar: "food-grade",
  médio: "medium",
  média: "medium",
  alto: "high",
  baixo: "low",
  reduzido: "reduced",
  enriquecido: "enriched",
  enriquecida: "enriched",
  edulcorantes: "sweeteners",
  açúcar: "sugar",
  açúcares: "sugars",
  sal: "salt",
  água: "water",
  mineral: "mineral",
  gaseificada: "sparkling",
  gasosa: "fizzy",
  espumante: "sparkling",
  miúda: "small",
  vegetal: "vegetable",

  // --- beverages ---------------------------------------------------------
  vinho: "wine",
  cerveja: "beer",
  sidra: "cider",
  aguardente: "spirit",
  brandy: "brandy",
  whisky: "whisky",
  gin: "gin",
  licor: "liqueur",
  cafe: "coffee",
  café: "coffee",
  chá: "tea",
  infusão: "infusion",
  tisana: "herbal tea",
  refrigerante: "soft drink",
  bebida: "drink",
  cacau: "cocoa",
  chocolate: "chocolate",
  cola: "cola",

  // --- dishes ------------------------------------------------------------
  sopa: "soup",
  caldo: "broth",
  caldeirada: "fish stew",
  feijoada: "bean stew",
  açorda: "açorda bread stew",
  canja: "chicken broth",
  jardineira: "vegetable stew",
  rancho: "rancho stew",
  favada: "broad-bean stew",
  empadão: "shepherd's pie",
  empada: "pie",
  quiche: "quiche",
  pizza: "pizza",
  salada: "salad",
  omelete: "omelette",
  pudim: "pudding",
  gelatina: "jelly",
  gelado: "ice cream",
  sorvete: "sorbet",
  mousse: "mousse",
  francesinha: "francesinha",
  moda: "style",
  portuguesa: "portuguese-style",
  alentejana: "alentejo-style",
  bolonhesa: "bolognese",
};

/** Folded glossary map (built once). */
const GLOSSARY: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [pt, en] of Object.entries(GLOSSARY_SOURCE)) {
    map.set(fold(pt), en);
  }
  return map;
})();

/** Longest phrase (in words) present in the glossary — bounds the match window. */
const MAX_PHRASE_WORDS = (() => {
  let max = 1;
  for (const key of GLOSSARY.keys()) {
    const words = key.split(" ").length;
    if (words > max) max = words;
  }
  return max;
})();

/** Uppercase the first alphabetic character of a string (skipping punctuation). */
function capitaliseFirst(value: string): string {
  return value.replace(/\p{L}/u, (c) => c.toUpperCase());
}

/**
 * Translate a single whitespace-delimited token, preserving any leading/trailing
 * punctuation (quotes, parentheses, %, etc.) and leaving unknown tokens in
 * Portuguese verbatim.
 */
function translateToken(token: string): string {
  const match = token.match(/^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u);
  if (!match) return token;
  const [, lead, core, trail] = match;
  if (!core) return token;
  const en = GLOSSARY.get(fold(core));
  return en !== undefined ? `${lead}${en}${trail}` : token;
}

/** Translate one comma-delimited segment's inner words (phrases before tokens). */
function translateWords(core: string): string {
  const words = core.split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    const maxWindow = Math.min(MAX_PHRASE_WORDS, words.length - i);
    for (let w = maxWindow; w >= 2; w -= 1) {
      const phraseKey = fold(words.slice(i, i + w).join(" "));
      const en = GLOSSARY.get(phraseKey);
      if (en !== undefined) {
        out.push(en);
        i += w;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(translateToken(words[i]!));
      i += 1;
    }
  }
  return out.join(" ");
}

/** Translate one comma segment, preserving its leading/trailing whitespace. */
function translateSegment(segment: string): string {
  const lead = segment.match(/^\s*/)![0];
  const trail = segment.match(/\s*$/)![0];
  const core = segment.slice(lead.length, segment.length - trail.length);
  if (!core) return segment;
  return `${lead}${translateWords(core)}${trail}`;
}

/**
 * Machine-assisted, glossary-based EN localisation of an INSA Portuguese food
 * name. Pure and deterministic. Translates token-wise, matching multi-word
 * phrases first, preserves comma structure and word order, and leaves any term
 * absent from the glossary in Portuguese (transparent — never invented).
 *
 *   translateInsaName("Peru, peito com pele, cru") -> "Turkey, breast with skin, raw"
 *   translateInsaName("Bacalhau salgado demolhado") -> "Cod salted soaked"
 *
 * Unknown terms (brands, rare species, regional preparations) stay Portuguese.
 */
export function translateInsaName(pt: string): string {
  if (!pt) return pt;
  const translated = pt.split(",").map(translateSegment).join(",");
  return capitaliseFirst(translated);
}
