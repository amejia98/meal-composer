/** Data model. Mirrors docs/spec.md §6 — keep them in sync. */

import type { Profile } from './targets';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type LabelBasis = {
  amount: number | null;
  unit: string | null;
  myAmount: number | null;
};

export type FoodItem = {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fruit' | 'veg' | 'fat' | 'dairy' | 'condiment';
  servingLabel: string;
  labelBasis: LabelBasis;
  nutrition: Nutrition;
  mealSlots: MealSlot[];
  pairsWith: string[];
  alwaysHave: boolean;
  lastEaten: string | null;
  source: 'manual' | 'label-scan' | 'barcode';
  barcode?: string | null;
};

export type Step = {
  text: string;
  phase: 'make-ahead' | 'day-of';
  minutes?: number | null;
};

export type Ingredient = {
  itemId: string;
  qty: number;
  unit: string;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  activeMinutes: number | null;
  totalMinutes: number | null;
  nutrition: Nutrition; // per serving, snapshot computed at save time
  mealSlots: MealSlot[];
};

export type Goals = Profile & {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  proteinFloorPerMeal: number;
};

export type MealComponent = {
  refId: string;
  refType: 'item' | 'recipe';
  servings: number;
};

export type Meal = {
  id: string;
  date: string;
  slot: MealSlot;
  components: MealComponent[];
  // nutrition is derived, never stored
};
