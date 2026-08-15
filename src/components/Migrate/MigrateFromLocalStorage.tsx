/**
 * One-time importer for data left over from the old vanilla-JS app, which
 * stored everything in localStorage['souschef.v1']. Old ids (uid() strings)
 * aren't valid UUIDs, so items are inserted first and the returned UUIDs are
 * used to remap recipe ingredient references before recipes are inserted.
 *
 * Temporary tooling — safe to delete once migration is confirmed working, or
 * leave dormant (harmless once localStorage is empty).
 */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../shared/toastBus';

const OLD_KEY = 'souschef.v1';

type OldFoodItem = {
  id: string;
  name: string;
  category: string;
  servingLabel: string;
  labelBasis?: { amount: number | null; unit: string | null; myAmount: number | null };
  nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  mealSlots?: string[];
  alwaysHave?: boolean;
  source: string;
  verified: boolean;
  lastEaten?: string | null;
};

type OldRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: { itemId: string; qty: number; unit: string }[];
  steps: { text: string; phase: string }[];
  activeMinutes?: number | null;
  nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  mealSlots?: string[];
};

type OldGoals = {
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
  proteinFloorPerMeal: number; rationale: string;
};

type OldData = { items: OldFoodItem[]; recipes: OldRecipe[]; goals: OldGoals | null };

export function MigrateFromLocalStorage({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const raw = (() => {
    try { return localStorage.getItem(OLD_KEY); } catch { return null; }
  })();
  if (!raw) return null;

  async function runImport() {
    setRunning(true);
    try {
      const data: OldData = JSON.parse(raw!);

      // Items first, capture old-id -> new-uuid map.
      const idMap = new Map<string, string>();
      if (data.items.length) {
        const rows = data.items.map((it) => ({
          name: it.name,
          category: it.category,
          serving_label: it.servingLabel,
          calories: it.nutrition.calories,
          protein: it.nutrition.protein,
          carbs: it.nutrition.carbs,
          fat: it.nutrition.fat,
          fiber: it.nutrition.fiber,
          label_amount: it.labelBasis?.amount ?? null,
          label_unit: it.labelBasis?.unit ?? null,
          label_my_amount: it.labelBasis?.myAmount ?? null,
          meal_slots: it.mealSlots ?? [],
          pairs_with: [],
          always_have: it.alwaysHave ?? false,
          last_eaten: it.lastEaten ?? null,
          source: it.source,
          barcode: null,
          verified: it.verified,
        }));
        const { data: inserted, error } = await supabase.from('food_items').insert(rows).select('id, name');
        if (error) throw error;
        // Match back up by position (insert preserves order) since old ids aren't stored.
        inserted!.forEach((row, i) => idMap.set(data.items[i].id, row.id));
      }

      let recipeCount = 0;
      if (data.recipes.length) {
        const rows = data.recipes.map((r) => ({
          name: r.name,
          servings: r.servings,
          ingredients: r.ingredients.map((g) => ({ itemId: idMap.get(g.itemId) ?? g.itemId, qty: g.qty, unit: g.unit })),
          steps: r.steps,
          active_minutes: r.activeMinutes ?? null,
          total_minutes: null,
          calories: r.nutrition.calories,
          protein: r.nutrition.protein,
          carbs: r.nutrition.carbs,
          fat: r.nutrition.fat,
          fiber: r.nutrition.fiber,
          meal_slots: r.mealSlots ?? [],
        }));
        const { error } = await supabase.from('recipes').insert(rows);
        if (error) throw error;
        recipeCount = rows.length;
      }

      if (data.goals) {
        const { error } = await supabase.from('goals').upsert({
          id: 'singleton',
          calories: data.goals.calories,
          protein: data.goals.protein,
          carbs: data.goals.carbs,
          fat: data.goals.fat,
          fiber: data.goals.fiber,
          protein_floor_per_meal: data.goals.proteinFloorPerMeal,
          rationale: data.goals.rationale,
        });
        if (error) throw error;
      }

      setSummary(`Imported ${data.items.length} item(s), ${recipeCount} recipe(s)${data.goals ? ', goals ✓' : ''}.`);
      toast('Import complete');
      onDone();
    } catch (err) {
      toast(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card">
      <h2>Found local data</h2>
      <p className="hint">This browser has data saved from the old version of the app. Import it?</p>
      {summary ? (
        <p className="note">{summary}</p>
      ) : (
        <button className="btn-ghost btn-sm" disabled={running} onClick={runImport}>
          {running ? 'Importing…' : 'Import local data'}
        </button>
      )}
    </div>
  );
}
