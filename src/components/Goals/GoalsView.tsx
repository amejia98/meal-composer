import { useEffect, useMemo, useRef, useState } from 'react';
import type { Goals } from '../../lib/types';
import {
  ACTIVITY_LEVELS, GOAL_TYPES, computeTargets,
  type ActivityLevel, type Gender, type GoalType, type Profile,
} from '../../lib/targets';
import { toast } from '../shared/toastBus';

type TargetsForm = {
  calories: string; protein: string; carbs: string; fat: string; fiber: string; proteinFloorPerMeal: string;
};

function targetsToForm(g: Goals): TargetsForm {
  return {
    calories: String(g.calories),
    protein: String(g.protein),
    carbs: String(g.carbs),
    fat: String(g.fat),
    fiber: String(g.fiber),
    proteinFloorPerMeal: String(g.proteinFloorPerMeal),
  };
}

function targetsToNumbers(f: TargetsForm) {
  return {
    calories: parseFloat(f.calories) || 0,
    protein: parseFloat(f.protein) || 0,
    carbs: parseFloat(f.carbs) || 0,
    fat: parseFloat(f.fat) || 0,
    fiber: parseFloat(f.fiber) || 0,
    proteinFloorPerMeal: parseFloat(f.proteinFloorPerMeal) || 0,
  };
}

/**
 * Clamps a numeric text field without forcing it to "0" while the user is
 * mid-edit (e.g. backspacing to empty before typing a new value) — only
 * snaps back once the typed number actually exceeds the range.
 */
function clampStr(raw: string, min: number, max: number): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  if (n > max) return String(max);
  if (n < min) return String(min);
  return raw;
}

const AUTOSAVE_DELAY_MS = 800;

export function GoalsView({ goals, onSave }: { goals: Goals; onSave: (g: Goals) => Promise<string | null> }) {
  // Age/weight/height are kept as raw text while editing (never coerced to a
  // number on every keystroke) so backspacing to empty doesn't snap back to
  // "0" and block further typing. Only gender/activity/goal are true enums.
  const [ageStr, setAgeStr] = useState(String(goals.age));
  const [gender, setGender] = useState<Gender>(goals.gender);
  const [weightStr, setWeightStr] = useState(String(goals.weightLb));
  const [heightFt, setHeightFt] = useState(String(Math.floor(goals.heightIn / 12)));
  const [heightIn, setHeightIn] = useState(String(Math.round(goals.heightIn % 12)));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(goals.activityLevel);
  const [goalType, setGoalType] = useState<GoalType>(goals.goalType);
  const [targets, setTargets] = useState<TargetsForm>(targetsToForm(goals));
  // Tracks whether the user has hand-edited a target field. While false,
  // target fields track the suggestion live as the profile changes; once
  // true, profile edits stop overwriting what the user typed — only
  // "Reset to suggested" touches them again.
  const [targetsDirty, setTargetsDirty] = useState(false);

  // What's currently saved on the server, so autosave can skip no-op writes
  // (including the write it would otherwise trigger on itself after a
  // successful save refreshes `goals` and this effect re-syncs local state).
  const lastSavedRef = useRef<string>(JSON.stringify(goals));

  useEffect(() => {
    setAgeStr(String(goals.age));
    setGender(goals.gender);
    setWeightStr(String(goals.weightLb));
    setHeightFt(String(Math.floor(goals.heightIn / 12)));
    setHeightIn(String(Math.round(goals.heightIn % 12)));
    setActivityLevel(goals.activityLevel);
    setGoalType(goals.goalType);
    setTargets(targetsToForm(goals));
    setTargetsDirty(false);
    lastSavedRef.current = JSON.stringify(goals);
  }, [goals]);

  const fullProfile: Profile = useMemo(() => ({
    age: parseFloat(ageStr) || 0,
    gender,
    weightLb: parseFloat(weightStr) || 0,
    heightIn: (parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0),
    activityLevel,
    goalType,
  }), [ageStr, gender, weightStr, heightFt, heightIn, activityLevel, goalType]);

  const suggested = useMemo(() => computeTargets(fullProfile), [fullProfile]);

  useEffect(() => {
    if (!targetsDirty) {
      setTargets({
        calories: String(suggested.calories),
        protein: String(suggested.protein),
        carbs: String(suggested.carbs),
        fat: String(suggested.fat),
        fiber: String(suggested.fiber),
        proteinFloorPerMeal: String(suggested.proteinFloorPerMeal),
      });
    }
  }, [suggested, targetsDirty]);

  const pending: Goals = { ...fullProfile, ...targetsToNumbers(targets) };

  // Autosave, debounced — any change to profile or targets writes to
  // Supabase shortly after the user stops typing, so navigating away (or
  // just not hitting Save) never loses an edit.
  useEffect(() => {
    const key = JSON.stringify(pending);
    if (key === lastSavedRef.current) return;
    const timer = window.setTimeout(async () => {
      const error = await onSave(pending);
      if (error) toast(error);
      else lastSavedRef.current = key;
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pending)]);

  function setTargetField<K extends keyof TargetsForm>(key: K, value: string) {
    setTargets((t) => ({ ...t, [key]: value }));
    setTargetsDirty(true);
  }

  function resetToSuggested() {
    setTargetsDirty(false);
    toast('Reset to suggested targets');
  }

  return (
    <section>
      <div className="card">
        <h2>About you</h2>
        <div className="row">
          <div className="field"><label htmlFor="p-age">Age</label>
            <input id="p-age" type="number" inputMode="numeric" max={100} value={ageStr} onChange={(e) => setAgeStr(clampStr(e.target.value, 0, 100))} /></div>
          <div className="field"><label htmlFor="p-gender">Gender</label>
            <select id="p-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="p-weight">Weight (lb)</label>
            <input id="p-weight" type="number" inputMode="decimal" step="any" max={200} value={weightStr} onChange={(e) => setWeightStr(clampStr(e.target.value, 0, 200))} /></div>
          <div className="field"><label>Height</label>
            <div className="row">
              <input type="number" inputMode="numeric" aria-label="Feet" placeholder="ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
              <input type="number" inputMode="numeric" aria-label="Inches" placeholder="in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
            </div></div>
        </div>
      </div>

      <div className="card">
        <h2>Activity level</h2>
        <div className="field">
          <label className="sr-only" htmlFor="p-activity">Activity level</label>
          <select id="p-activity" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}>
            {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>{ACTIVITY_LEVELS[k].label}</option>
            ))}
          </select>
        </div>
        <p className="note">{ACTIVITY_LEVELS[activityLevel].description}</p>
      </div>

      <div className="card">
        <h2>Goal</h2>
        <div className="seg">
          {(Object.keys(GOAL_TYPES) as GoalType[]).map((k) => (
            <button key={k} className={goalType === k ? 'on' : ''} onClick={() => setGoalType(k)}>
              {GOAL_TYPES[k].label}
            </button>
          ))}
        </div>
        <p className="note">{GOAL_TYPES[goalType].description}</p>
      </div>

      <div className="card">
        <h2>Daily targets</h2>
        <p className="hint">Editable — the numbers below are a starting suggestion based on your profile, not a rule. Changes save automatically.</p>

        <div className="row">
          <div className="field"><label htmlFor="g-cal">Calories</label>
            <input id="g-cal" type="number" inputMode="decimal" step="any" value={targets.calories} onChange={(e) => setTargetField('calories', e.target.value)} />
            <p className="note">Suggested: {suggested.calories}</p></div>
          <div className="field"><label htmlFor="g-pro">Protein (g)</label>
            <input id="g-pro" type="number" inputMode="decimal" step="any" value={targets.protein} onChange={(e) => setTargetField('protein', e.target.value)} />
            <p className="note">Suggested: {suggested.protein}</p></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="g-carb">Carbs (g)</label>
            <input id="g-carb" type="number" inputMode="decimal" step="any" value={targets.carbs} onChange={(e) => setTargetField('carbs', e.target.value)} />
            <p className="note">Suggested: {suggested.carbs}</p></div>
          <div className="field"><label htmlFor="g-fat">Fat (g)</label>
            <input id="g-fat" type="number" inputMode="decimal" step="any" value={targets.fat} onChange={(e) => setTargetField('fat', e.target.value)} />
            <p className="note">Suggested: {suggested.fat}</p></div>
        </div>
        <div className="field"><label htmlFor="g-fib">Fiber (g)</label>
          <input id="g-fib" type="number" inputMode="decimal" step="any" value={targets.fiber} onChange={(e) => setTargetField('fiber', e.target.value)} />
          <p className="note">Suggested: {suggested.fiber}</p></div>
        <div className="field"><label htmlFor="g-floor">Protein floor per meal (g)</label>
          <input id="g-floor" type="number" inputMode="decimal" step="any" value={targets.proteinFloorPerMeal} onChange={(e) => setTargetField('proteinFloorPerMeal', e.target.value)} />
          <p className="note">Suggested: {suggested.proteinFloorPerMeal}</p></div>

        <button className="btn-ghost btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={resetToSuggested}>Reset to suggested</button>
      </div>
    </section>
  );
}
