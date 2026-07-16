// Canonical nutrient dictionary.
//
// The single in-repo source of truth for the nutrient codes T1Dine understands,
// their canonical unit, and human labels. Codes follow INFOODS tagnames where a
// stable one exists (e.g. `CHOAVL` = available carbohydrate — the dose-relevant
// carbohydrate T1Dine already keys on), with two local extensions:
//   - `ENERC`    energy in kcal (INFOODS `ENERC` is unit-ambiguous; we pin kcal)
//   - `ENERC_KJ` energy in kJ (kept as a distinct code so both energies coexist)
//
// PARITY NOTE: the PortFIR ingestion adapter carries an equivalent table in
// `services/food-ingestion/food_ingestion/portfir/nutrient_map.py`. Both must
// agree on (code → unit) and on the confidence rule in `defaultConfidence`
// below. Keep them in lock-step when either changes.

import type { NutrientObservation } from "@t1dine/domain";

export type NutrientUnit = NutrientObservation["unit"]; // "g" | "mg" | "µg" | "kcal" | "kJ"
export type ConfidenceLevel = NutrientObservation["confidence"];

export interface NutrientDefinition {
  /** Canonical nutrient code (INFOODS tagname or local extension). */
  code: string;
  /** Canonical unit the stored `value` is expressed in. */
  unit: NutrientUnit;
  /** Portuguese display label (matches the INSA/PortFIR source wording). */
  labelPt: string;
  /** English display label. */
  labelEn: string;
  /** INFOODS tagname, when one exists (`undefined` where the source has none). */
  infoods?: string;
  /** EuroFIR Component Thesaurus code. */
  eurofir?: string;
}

/**
 * Default confidence for an observation of `code`, derived purely from its unit
 * so the TypeScript and Python sides stay identical: macronutrients (grams) and
 * energy are `high`; micronutrients reported in mg/µg default to `medium`.
 * Callers may still override per observation from source metadata.
 */
export function defaultConfidence(unit: NutrientUnit): ConfidenceLevel {
  return unit === "g" || unit === "kcal" || unit === "kJ" ? "high" : "medium";
}

// Ordered to match the INSA BDCA v7.1 column order (F..BA) for traceability.
const DEFINITIONS: NutrientDefinition[] = [
  { code: "ENERC", unit: "kcal", labelPt: "Energia", labelEn: "Energy", infoods: "ENERC", eurofir: "ENERC" },
  { code: "ENERC_KJ", unit: "kJ", labelPt: "Energia", labelEn: "Energy", infoods: "ENERC", eurofir: "ENERC" },
  { code: "FAT", unit: "g", labelPt: "Lípidos", labelEn: "Total fat", infoods: "FAT", eurofir: "FAT" },
  { code: "FASAT", unit: "g", labelPt: "Ácidos gordos saturados", labelEn: "Saturated fatty acids", infoods: "FASAT", eurofir: "FASAT" },
  { code: "FAMS", unit: "g", labelPt: "Ácidos gordos monoinsaturados", labelEn: "Monounsaturated fatty acids", infoods: "FAMS", eurofir: "FAMS" },
  { code: "FAPU", unit: "g", labelPt: "Ácidos gordos polinsaturados", labelEn: "Polyunsaturated fatty acids", infoods: "FAPU", eurofir: "FAPU" },
  { code: "F18D2CN6", unit: "g", labelPt: "Ácido linoleico", labelEn: "Linoleic acid", infoods: "F18D2CN6", eurofir: "F18:2CN6" },
  { code: "FATRN", unit: "g", labelPt: "Ácidos gordos trans", labelEn: "Trans fatty acids", infoods: "FATRN", eurofir: "FATRS" },
  { code: "CHOAVL", unit: "g", labelPt: "Hidratos de carbono", labelEn: "Available carbohydrate", infoods: "CHOAVL", eurofir: "CHO" },
  { code: "SUGAR", unit: "g", labelPt: "Açúcares", labelEn: "Sugars", infoods: "SUGAR", eurofir: "SUGAR" },
  { code: "OLSAC", unit: "g", labelPt: "Oligossacáridos", labelEn: "Oligosaccharides", infoods: "OLSAC", eurofir: "OLSAC" },
  { code: "STARCH", unit: "g", labelPt: "Amido", labelEn: "Starch", infoods: "STARCH", eurofir: "STARCH" },
  { code: "NACL", unit: "g", labelPt: "Sal", labelEn: "Salt", infoods: "NACL", eurofir: "NACL" },
  { code: "FIBTG", unit: "g", labelPt: "Fibra", labelEn: "Fibre", infoods: "FIBTG", eurofir: "FIBT" },
  { code: "PROCNT", unit: "g", labelPt: "Proteínas", labelEn: "Protein", infoods: "PROCNT", eurofir: "PROT" },
  { code: "ALC", unit: "g", labelPt: "Álcool", labelEn: "Alcohol", infoods: "ALC", eurofir: "ALC" },
  { code: "WATER", unit: "g", labelPt: "Água", labelEn: "Water", infoods: "WATER", eurofir: "WATER" },
  { code: "OA", unit: "g", labelPt: "Ácidos orgânicos", labelEn: "Organic acids", infoods: "OA", eurofir: "OA" },
  { code: "CHOLE", unit: "mg", labelPt: "Colesterol", labelEn: "Cholesterol", infoods: "CHOLE", eurofir: "CHORL" },
  { code: "VITA", unit: "µg", labelPt: "Vitamina A", labelEn: "Vitamin A", infoods: "VITA", eurofir: "VITA" },
  { code: "CARTBEQ", unit: "µg", labelPt: "Equivalentes de β-caroteno", labelEn: "β-carotene equivalents", infoods: "CARTBEQ", eurofir: "CARTBEQ" },
  { code: "CARTA", unit: "µg", labelPt: "α-caroteno", labelEn: "α-carotene", infoods: "CARTA", eurofir: "CARTA" },
  { code: "CARTBTOT", unit: "µg", labelPt: "β-caroteno, total", labelEn: "β-carotene, total", eurofir: "CARTBTOT" },
  { code: "CRYPXB", unit: "µg", labelPt: "β-criptoxantina", labelEn: "β-cryptoxanthin", infoods: "CRYPXB", eurofir: "CRYPXB" },
  { code: "LYCPN", unit: "µg", labelPt: "Licopeno", labelEn: "Lycopene", infoods: "LYCPN", eurofir: "LYCPN" },
  { code: "LUTN", unit: "µg", labelPt: "Luteína", labelEn: "Lutein", infoods: "LUTN", eurofir: "LUTN" },
  { code: "ZEA", unit: "µg", labelPt: "Zeaxantina", labelEn: "Zeaxanthin", infoods: "ZEA", eurofir: "ZEA" },
  { code: "VITD", unit: "µg", labelPt: "Vitamina D", labelEn: "Vitamin D", infoods: "VITD", eurofir: "VITD" },
  { code: "TOCPHA", unit: "mg", labelPt: "α-tocoferol", labelEn: "α-tocopherol", infoods: "TOCPHA", eurofir: "TOCPHA" },
  { code: "THIA", unit: "mg", labelPt: "Tiamina", labelEn: "Thiamin", infoods: "THIA", eurofir: "THIA" },
  { code: "RIBF", unit: "mg", labelPt: "Riboflavina", labelEn: "Riboflavin", infoods: "RIBF", eurofir: "RIBF" },
  { code: "NIA", unit: "mg", labelPt: "Niacina", labelEn: "Niacin", infoods: "NIA", eurofir: "NIA" },
  { code: "NIAEQ", unit: "mg", labelPt: "Equivalentes de niacina", labelEn: "Niacin equivalents", infoods: "NIAEQ", eurofir: "NIAEQ" },
  { code: "NIATRP", unit: "mg", labelPt: "Triptofano/60", labelEn: "Tryptophan/60", infoods: "NIATRP", eurofir: "NIATRP" },
  { code: "VITB6A", unit: "mg", labelPt: "Vitamina B6", labelEn: "Vitamin B6", infoods: "VITB6A", eurofir: "VITB6" },
  { code: "VITB12", unit: "µg", labelPt: "Vitamina B12", labelEn: "Vitamin B12", infoods: "VITB12", eurofir: "VITB12" },
  { code: "VITC", unit: "mg", labelPt: "Vitamina C", labelEn: "Vitamin C", infoods: "VITC", eurofir: "VITC" },
  { code: "FOL", unit: "µg", labelPt: "Folatos", labelEn: "Folate", infoods: "FOL", eurofir: "FOL" },
  { code: "ASH", unit: "g", labelPt: "Cinza", labelEn: "Ash", infoods: "ASH", eurofir: "ASH" },
  { code: "NA", unit: "mg", labelPt: "Sódio", labelEn: "Sodium", infoods: "NA", eurofir: "NA" },
  { code: "K", unit: "mg", labelPt: "Potássio", labelEn: "Potassium", infoods: "K", eurofir: "K" },
  { code: "CA", unit: "mg", labelPt: "Cálcio", labelEn: "Calcium", infoods: "CA", eurofir: "CA" },
  { code: "P", unit: "mg", labelPt: "Fósforo", labelEn: "Phosphorus", infoods: "P", eurofir: "P" },
  { code: "MG", unit: "mg", labelPt: "Magnésio", labelEn: "Magnesium", infoods: "MG", eurofir: "MG" },
  { code: "FE", unit: "mg", labelPt: "Ferro", labelEn: "Iron", infoods: "FE", eurofir: "FE" },
  { code: "ZN", unit: "mg", labelPt: "Zinco", labelEn: "Zinc", infoods: "ZN", eurofir: "ZN" },
  { code: "SE", unit: "µg", labelPt: "Selénio", labelEn: "Selenium", infoods: "SE", eurofir: "SE" },
  { code: "ID", unit: "µg", labelPt: "Iodo", labelEn: "Iodine", infoods: "ID", eurofir: "ID" },
];

/** All nutrient definitions, in source column order. */
export const NUTRIENT_DEFINITIONS: readonly NutrientDefinition[] = DEFINITIONS;

/** Lookup by canonical code. */
export const NUTRIENTS: Readonly<Record<string, NutrientDefinition>> = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((d) => [d.code, d])),
);

/** Canonical unit for a code, or `undefined` if the code is unknown. */
export function nutrientUnit(code: string): NutrientUnit | undefined {
  return NUTRIENTS[code]?.unit;
}

// Note: the two dose-relevant codes the meal journey aggregates today
// (`CHOAVL`, `ENERC`) are owned by `@t1dine/nutrition`
// (`CARBOHYDRATE_CODE` / `ENERGY_CODE`); they are intentionally NOT re-exported
// here to avoid a duplicate symbol across packages.
