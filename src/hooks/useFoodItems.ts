import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FoodItem, Recipe } from '../lib/types';

/** food_items row (snake_case, as stored) <-> FoodItem (camelCase, as used in the app). */
type FoodItemRow = {
  id: string;
  name: string;
  category: FoodItem['category'];
  serving_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  label_amount: number | null;
  label_unit: string | null;
  label_my_amount: number | null;
  meal_slots: string[];
  pairs_with: string[];
  always_have: boolean;
  last_eaten: string | null;
  source: FoodItem['source'];
  barcode: string | null;
};

function fromRow(r: FoodItemRow): FoodItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    servingLabel: r.serving_label,
    labelBasis: { amount: r.label_amount, unit: r.label_unit, myAmount: r.label_my_amount },
    nutrition: { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber },
    mealSlots: (r.meal_slots ?? []) as FoodItem['mealSlots'],
    pairsWith: r.pairs_with ?? [],
    alwaysHave: r.always_have,
    lastEaten: r.last_eaten,
    source: r.source,
    barcode: r.barcode,
  };
}

function toRow(item: FoodItem) {
  return {
    id: item.id || undefined,
    name: item.name,
    category: item.category,
    serving_label: item.servingLabel,
    calories: item.nutrition.calories,
    protein: item.nutrition.protein,
    carbs: item.nutrition.carbs,
    fat: item.nutrition.fat,
    fiber: item.nutrition.fiber,
    label_amount: item.labelBasis.amount,
    label_unit: item.labelBasis.unit,
    label_my_amount: item.labelBasis.myAmount,
    meal_slots: item.mealSlots,
    pairs_with: item.pairsWith,
    always_have: item.alwaysHave,
    last_eaten: item.lastEaten,
    source: item.source,
    barcode: item.barcode ?? null,
  };
}

export function useFoodItems() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('food_items').select('*').order('name');
    if (!error) setItems((data as FoodItemRow[] ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const findItem = (id: string) => items.find((i) => i.id === id);

  const recipesUsing = (itemId: string, recipes: Recipe[]) =>
    recipes.filter((r) => r.ingredients.some((g) => g.itemId === itemId));

  async function saveItem(item: FoodItem, isNew: boolean) {
    const row = toRow(item);
    const { error } = isNew
      ? await supabase.from('food_items').insert(row)
      : await supabase.from('food_items').update(row).eq('id', item.id);
    if (!error) await refresh();
    return error?.message ?? null;
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('food_items').delete().eq('id', id);
    if (!error) await refresh();
    return error?.message ?? null;
  }

  return { items, loading, findItem, recipesUsing, saveItem, removeItem, refresh };
}
