import { useEffect, useMemo, useState } from 'react';
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

export function GoalsView({ goals, onSave }: { goals: Goals; onSave: (g: Goals) => Promise<string | null> }) {
  const [profile, setProfile] = useState<Profile>(goals);
  const [heightFt, setHeightFt] = useState(String(Math.floor(goals.heightIn / 12)));
  const [heightIn, setHeightIn] = useState(String(Math.round(goals.heightIn % 12)));
  const [targets, setTargets] = useState<TargetsForm>(targetsToForm(goals));
  // Tracks whether the user has hand-edited a target field. While false,
  // target fields track the suggestion live as the profile changes; once
  // true, profile edits stop overwriting what the user typed — only
  // "Reset to suggested" touches them again.
  const [targetsDirty, setTargetsDirty] = useState(false);

  useEffect(() => {
    setProfile(goals);
    setHeightFt(String(Math.floor(goals.heightIn / 12)));
    setHeightIn(String(Math.round(goals.heightIn % 12)));
    setTargets(targetsToForm(goals));
    setTargetsDirty(false);
  }, [goals]);

  const fullProfile: Profile = useMemo(() => ({
    ...profile,
    heightIn: (parseFloat(heightFt) || 0) * 12 + (parseFloat(heightIn) || 0),
  }), [profile, heightFt, heightIn]);

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

  function setProfileField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setTargetField<K extends keyof TargetsForm>(key: K, value: string) {
    setTargets((t) => ({ ...t, [key]: value }));
    setTargetsDirty(true);
  }

  function resetToSuggested() {
    setTargetsDirty(false);
    toast('Reset to suggested targets');
  }

  async function handleSave() {
    const next: Goals = { ...fullProfile, ...targetsToNumbers(targets) };
    const error = await onSave(next);
    if (error) return toast(error);
    toast('Goals saved');
  }

  return (
    <section>
      <div className="card">
        <h2>About you</h2>
        <div className="row">
          <div className="field"><label htmlFor="p-age">Age</label>
            <input id="p-age" type="number" inputMode="numeric" value={profile.age} onChange={(e) => setProfileField('age', parseFloat(e.target.value) || 0)} /></div>
          <div className="field"><label htmlFor="p-gender">Gender</label>
            <select id="p-gender" value={profile.gender} onChange={(e) => setProfileField('gender', e.target.value as Gender)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="p-weight">Weight (lb)</label>
            <input id="p-weight" type="number" inputMode="decimal" step="any" value={profile.weightLb} onChange={(e) => setProfileField('weightLb', parseFloat(e.target.value) || 0)} /></div>
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
          <select id="p-activity" value={profile.activityLevel} onChange={(e) => setProfileField('activityLevel', e.target.value as ActivityLevel)}>
            {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>{ACTIVITY_LEVELS[k].label}</option>
            ))}
          </select>
        </div>
        <p className="note">{ACTIVITY_LEVELS[profile.activityLevel].description}</p>
      </div>

      <div className="card">
        <h2>Goal</h2>
        <div className="seg">
          {(Object.keys(GOAL_TYPES) as GoalType[]).map((k) => (
            <button key={k} className={profile.goalType === k ? 'on' : ''} onClick={() => setProfileField('goalType', k)}>
              {GOAL_TYPES[k].label}
            </button>
          ))}
        </div>
        <p className="note">{GOAL_TYPES[profile.goalType].description}</p>
      </div>

      <div className="card">
        <h2>Daily targets</h2>
        <p className="hint">Editable — the numbers below are a starting suggestion based on your profile, not a rule.</p>

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

      <button className="btn" onClick={handleSave}>Save goals</button>
    </section>
  );
}
