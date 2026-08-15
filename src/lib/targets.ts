/**
 * Suggested daily targets, computed from a body profile. Pure — no DOM, no
 * Supabase — so it's cheap to unit test, same principle as label.ts.
 *
 * Formula: Mifflin-St Jeor for BMR, an activity multiplier for TDEE, then a
 * goal-based calorie adjustment and a g/kg protein target. These are
 * reasonable defaults, not medical advice — the UI always keeps the computed
 * numbers editable rather than locking them in.
 */

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very-active';
export type GoalType = 'bulk' | 'maintain' | 'lean';

export type Profile = {
  age: number;
  gender: Gender;
  weightLb: number;
  heightIn: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
};

export type TargetNumbers = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  proteinFloorPerMeal: number;
};

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; description: string; multiplier: number }> = {
  sedentary: { label: 'Sedentary', description: 'Little or no exercise, desk job', multiplier: 1.2 },
  light: { label: 'Lightly active', description: 'Light exercise 1–3 days a week', multiplier: 1.375 },
  moderate: { label: 'Moderately active', description: 'Moderate exercise 3–5 days a week', multiplier: 1.55 },
  'very-active': { label: 'Very active', description: 'Hard exercise 6–7 days a week', multiplier: 1.725 },
};

export const GOAL_TYPES: Record<GoalType, { label: string; description: string }> = {
  bulk: { label: 'Bulk up', description: 'Calorie surplus to build muscle' },
  maintain: { label: 'Maintain', description: 'Hold steady at your current weight' },
  lean: { label: 'Get lean', description: 'Calorie deficit to lose fat' },
};

const CALORIE_MULTIPLIER: Record<GoalType, number> = { bulk: 1.10, maintain: 1.0, lean: 0.80 };
const PROTEIN_PER_KG: Record<GoalType, number> = { bulk: 2.0, maintain: 1.8, lean: 2.2 };
const FAT_SHARE_OF_CALORIES = 0.28;

export function computeTargets(profile: Profile): TargetNumbers {
  const weightKg = profile.weightLb * 0.453592;
  const heightCm = profile.heightIn * 2.54;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * profile.age + (profile.gender === 'male' ? 5 : -161);
  const tdee = bmr * ACTIVITY_LEVELS[profile.activityLevel].multiplier;

  const calories = Math.round(tdee * CALORIE_MULTIPLIER[profile.goalType]);
  const protein = Math.round(weightKg * PROTEIN_PER_KG[profile.goalType]);
  const fat = Math.round((calories * FAT_SHARE_OF_CALORIES) / 9);

  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));

  const fiber = Math.round((calories / 1000) * 14);
  const proteinFloorPerMeal = Math.min(40, Math.max(20, Math.round(protein / 4)));

  return { calories, protein, carbs, fat, fiber, proteinFloorPerMeal };
}

export const DEFAULT_PROFILE: Profile = {
  age: 30,
  gender: 'female',
  weightLb: 150,
  heightIn: 65,
  activityLevel: 'moderate',
  goalType: 'maintain',
};
