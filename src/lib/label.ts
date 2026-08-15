/**
 * Nutrition label parser.
 *
 * Pure — takes pasted label text, returns numbers. No DOM, no side effects,
 * which is why it's the one part of this app with real unit tests. iOS Live
 * Text does the OCR; this only pulls values out of whatever lands in the box.
 *
 * Handles English and Spanish labels. Two gotchas that already bit us once,
 * so don't "simplify" them away:
 *
 *   1. \w does NOT match accented letters in JS. /calor\w*​/ fails on
 *      "Calorías". Spell endings out explicitly.
 *   2. Pattern order matters. "Total Fat" must be tried before bare "Fat",
 *      or the "Saturated Fat" line underneath can win.
 */

type NutrientKey = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber';

const PATTERNS: Record<NutrientKey, RegExp[]> = {
  calories: [
    /calor(?:[íi]as?|ies|ie|y)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i,
    /energ[íi]a\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*k?cal/i,
  ],
  protein: [
    /prote[íi]n\w*\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
  ],
  carbs: [
    /carbohidratos?\s*(?:totales)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
    /total\s*carb(?:ohydrate)?s?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
    /carb(?:ohydrate)?s?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
  ],
  fat: [
    /grasas?\s*total(?:es)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
    /total\s*fat\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
    /(?:^|\n)\s*(?:grasas?|fat)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/im,
  ],
  fiber: [
    /fibra\s*(?:diet[ée]tica)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
    /(?:dietary\s*)?fib(?:er|re)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
  ],
};

const SERVING_LINE =
  /(?:serving\s*size|tama[ñn]o[^\n\r]*?porci[óo]n|porci[óo]n)\s*[:\-]?\s*([^\n\r]+)/i;
const SERVING_AMOUNT = /\(?\s*(\d+(?:[.,]\d+)?)\s*(g|ml|oz)\s*\)?/i;
const BARE_PER = /(?:por|per)\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i;

function firstMatch(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

export type ParsedNutrition = Record<NutrientKey, number | null>;

export type ParsedLabel = {
  nutrition: ParsedNutrition;
  serving: { amount: number | null; unit: string | null };
  found: string[];
};

/**
 * Every field is null when not found — never 0, never a stale previous value.
 * Callers must clear their form before applying, or a miss silently keeps the
 * last product's number.
 */
export function parseNutritionLabel(text: string): ParsedLabel {
  const nutrition = {} as ParsedNutrition;
  const found: string[] = [];

  for (const key of Object.keys(PATTERNS) as NutrientKey[]) {
    const v = firstMatch(text, PATTERNS[key]);
    nutrition[key] = v;
    if (v !== null) found.push(key);
  }

  const serving: { amount: number | null; unit: string | null } = { amount: null, unit: null };
  const line = text.match(SERVING_LINE);
  if (line) {
    const m = line[1].match(SERVING_AMOUNT);
    if (m) {
      serving.amount = parseFloat(m[1].replace(',', '.'));
      serving.unit = m[2].toLowerCase();
    }
  }
  if (serving.amount === null) {
    const m = text.match(BARE_PER);
    if (m) {
      serving.amount = parseFloat(m[1].replace(',', '.'));
      serving.unit = m[2].toLowerCase();
    }
  }
  if (serving.amount !== null) found.push('serving size');

  return { nutrition, serving, found };
}

/** Human-readable names for the `found` list. */
export const FIELD_LABELS: Record<string, string> = {
  calories: 'calories',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
  fiber: 'fiber',
  'serving size': 'serving size',
};
