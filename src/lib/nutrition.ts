/**
 * Pure nutrition math shared by the item and recipe forms. Ported from the
 * old items.js/recipes.js — same formulas, just taking values instead of
 * reading DOM elements by id.
 */

import type { FoodItem, Ingredient, Nutrition } from './types';

export const round1 = (x: number) => Math.round(x * 10) / 10;

/** Label values are per `labelAmount`; you eat `myAmount`. This is the ratio. */
export function computeRatio(labelAmount: number, myAmount: number): number {
  return labelAmount > 0 && myAmount > 0 ? myAmount / labelAmount : 1;
}

/** Nutrition for one of *your* servings, scaled off the label values. */
export function scaleNutrition(raw: Nutrition, ratio: number): Nutrition {
  return {
    calories: Math.round(raw.calories * ratio),
    protein: round1(raw.protein * ratio),
    carbs: round1(raw.carbs * ratio),
    fat: round1(raw.fat * ratio),
    fiber: round1(raw.fiber * ratio),
  };
}

/**
 * Recipe totals. Ingredient quantities are servings of a FoodItem, not
 * grams — deliberate, sidesteps a unit-conversion layer entirely. If real
 * weights are ever needed, add a grams-per-serving field to FoodItem rather
 * than teaching this file unit math.
 */
export function computeTotals(ingredients: Ingredient[], findItem: (id: string) => FoodItem | undefined): Nutrition {
  const t: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const g of ingredients) {
    const item = findItem(g.itemId);
    if (!item) continue;
    t.calories += item.nutrition.calories * g.qty;
    t.protein += item.nutrition.protein * g.qty;
    t.carbs += item.nutrition.carbs * g.qty;
    t.fat += item.nutrition.fat * g.qty;
    t.fiber += item.nutrition.fiber * g.qty;
  }
  return t;
}

export function computePerServing(totals: Nutrition, servings: number): Nutrition {
  const s = Math.max(1, servings);
  return {
    calories: Math.round(totals.calories / s),
    protein: round1(totals.protein / s),
    carbs: round1(totals.carbs / s),
    fat: round1(totals.fat / s),
    fiber: round1(totals.fiber / s),
  };
}

/** One-line macro summary used in previews and list rows. */
export const macroLine = (n: Nutrition) =>
  `${n.calories} cal · ${n.protein}g protein · ${n.carbs}g carbs · ` +
  `${n.fat}g fat · ${n.fiber}g fiber`;
