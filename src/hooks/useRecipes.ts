import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Ingredient, Recipe, Step } from '../lib/types';

type RecipeRow = {
  id: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  steps: Step[];
  active_minutes: number | null;
  total_minutes: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  meal_slots: string[];
};

function fromRow(r: RecipeRow): Recipe {
  return {
    id: r.id,
    name: r.name,
    servings: r.servings,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    activeMinutes: r.active_minutes,
    totalMinutes: r.total_minutes,
    nutrition: { calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber },
    mealSlots: (r.meal_slots ?? []) as Recipe['mealSlots'],
  };
}

function toRow(recipe: Recipe) {
  return {
    id: recipe.id || undefined,
    name: recipe.name,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    active_minutes: recipe.activeMinutes,
    total_minutes: recipe.totalMinutes,
    calories: recipe.nutrition.calories,
    protein: recipe.nutrition.protein,
    carbs: recipe.nutrition.carbs,
    fat: recipe.nutrition.fat,
    fiber: recipe.nutrition.fiber,
    meal_slots: recipe.mealSlots,
  };
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('name');
    if (!error) setRecipes((data as RecipeRow[] ?? []).map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const findRecipe = (id: string) => recipes.find((r) => r.id === id);

  async function saveRecipe(recipe: Recipe, isNew: boolean) {
    const row = toRow(recipe);
    const { error } = isNew
      ? await supabase.from('recipes').insert(row)
      : await supabase.from('recipes').update(row).eq('id', recipe.id);
    if (!error) await refresh();
    return error?.message ?? null;
  }

  async function removeRecipe(id: string) {
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (!error) await refresh();
    return error?.message ?? null;
  }

  return { recipes, loading, findRecipe, saveRecipe, removeRecipe, refresh };
}
