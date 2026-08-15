import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Goals } from '../lib/types';

const SINGLETON_ID = 'singleton';

/**
 * "Never a blank page" applies here too: the form always opens with a
 * computed proposal already filled in, not empty inputs. DEFAULTS is that
 * starting proposal — Alexis's derived targets (130 lb / 59 kg, 5'5", 28,
 * female, 3 zone-2 running days + 2-3 strength days/week, 4 months
 * post-surgery under PT). See the rationale field for the full derivation.
 */
export const DEFAULTS: Goals = {
  calories: 1800,
  protein: 125,
  carbs: 190,
  fat: 60,
  fiber: 26,
  proteinFloorPerMeal: 35,
  rationale:
    "Based on 130 lb (59 kg), 5'5\", 28, female, 3 zone-2 running days + " +
    '2–3 strength days/week, 4 months post-surgery and still under PT. ' +
    'Protein: 125g ≈ 2.1 g/kg — inside the 2.0–2.2 g/kg zone where the ' +
    'muscle-growth and post-op-rehab literatures overlap. Floored at 35g/meal ' +
    'because protein works better spread across the day than back-loaded into ' +
    'one meal. Calories: Mifflin-St Jeor BMR (~1,320) × 1.5 for a moderately ' +
    'active week ≈ 1,980 maintenance, then a modest ~10% deficit (1,800) for ' +
    "lean recomposition — kept small on purpose, since it's the protein and " +
    'resistance training doing the work, not the deficit, and a bigger cut ' +
    'fights a body still rebuilding post-surgery. Fat ~30% of calories (60g); ' +
    'carbs fill the rest (~190g on a normal day) and should flex upward around ' +
    'running days rather than sit fixed. Fiber: 14g/1,000 kcal ≈ 26g. ' +
    "Re-run these once running volume ramps up — and the running progression " +
    "itself is PT's/the surgeon's call, not this app's.",
};

type GoalsRow = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  protein_floor_per_meal: number;
  rationale: string;
};

function fromRow(r: GoalsRow): Goals {
  return {
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    proteinFloorPerMeal: r.protein_floor_per_meal,
    rationale: r.rationale,
  };
}

export function useGoals() {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('goals').select('*').eq('id', SINGLETON_ID).maybeSingle();
    if (!error) setGoals(data ? fromRow(data as GoalsRow) : null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function saveGoals(next: Goals) {
    const { error } = await supabase.from('goals').upsert({
      id: SINGLETON_ID,
      calories: next.calories,
      protein: next.protein,
      carbs: next.carbs,
      fat: next.fat,
      fiber: next.fiber,
      protein_floor_per_meal: next.proteinFloorPerMeal,
      rationale: next.rationale,
    });
    if (!error) await refresh();
    return error?.message ?? null;
  }

  return { goals: goals ?? DEFAULTS, hasSaved: goals !== null, loading, saveGoals, refresh };
}
