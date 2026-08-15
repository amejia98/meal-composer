import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Goals } from '../lib/types';
import { computeTargets, DEFAULT_PROFILE } from '../lib/targets';

const SINGLETON_ID = 'singleton';

/** "Never a blank page": the form opens with a computed proposal, not empty inputs. */
export const DEFAULTS: Goals = { ...DEFAULT_PROFILE, ...computeTargets(DEFAULT_PROFILE) };

type GoalsRow = {
  age: number;
  gender: Goals['gender'];
  weight_lb: number;
  height_in: number;
  activity_level: Goals['activityLevel'];
  goal_type: Goals['goalType'];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  protein_floor_per_meal: number;
};

function fromRow(r: GoalsRow): Goals {
  return {
    age: r.age,
    gender: r.gender,
    weightLb: r.weight_lb,
    heightIn: r.height_in,
    activityLevel: r.activity_level,
    goalType: r.goal_type,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    proteinFloorPerMeal: r.protein_floor_per_meal,
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
      age: next.age,
      gender: next.gender,
      weight_lb: next.weightLb,
      height_in: next.heightIn,
      activity_level: next.activityLevel,
      goal_type: next.goalType,
      calories: next.calories,
      protein: next.protein,
      carbs: next.carbs,
      fat: next.fat,
      fiber: next.fiber,
      protein_floor_per_meal: next.proteinFloorPerMeal,
    });
    if (!error) await refresh();
    return error?.message ?? null;
  }

  return { goals: goals ?? DEFAULTS, hasSaved: goals !== null, loading, saveGoals, refresh };
}
