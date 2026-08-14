/**
 * The Goals screen. Spec §9.
 *
 * "Never a blank page" applies here too: the form always opens with a
 * computed proposal already filled in, not empty inputs. `DEFAULTS` is that
 * starting proposal — derived once from a Mifflin-St Jeor calculation for
 * this app's one user, editable and re-saveable like everything else.
 */

import { state, save } from './state.js';
import { num, setVal, toast } from './util.js';

// 130 lb (59 kg), 5'5" (165 cm), 28, female, 3 zone-2 running days + 2–3
// strength days/week, 4 months post-surgery under PT supervision, goal is
// lean recomposition. See rationale text below for the derivation.
export const DEFAULTS = {
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
    'lean recomposition — kept small on purpose, since it\'s the protein and ' +
    'resistance training doing the work, not the deficit, and a bigger cut ' +
    'fights a body still rebuilding post-surgery. Fat ~30% of calories (60g); ' +
    'carbs fill the rest (~190g on a normal day) and should flex upward around ' +
    'running days rather than sit fixed. Fiber: 14g/1,000 kcal ≈ 26g. ' +
    "Re-run these once running volume ramps up — and the running progression " +
    "itself is PT's/the surgeon's call, not this app's.",
};

function fill(g) {
  setVal('g-cal', g.calories);
  setVal('g-pro', g.protein);
  setVal('g-carb', g.carbs);
  setVal('g-fat', g.fat);
  setVal('g-fib', g.fiber);
  setVal('g-floor', g.proteinFloorPerMeal);
  document.getElementById('g-rationale').value = g.rationale;
}

export function render() {
  fill(state.goals || DEFAULTS);
}

export function saveGoals() {
  const rationale = document.getElementById('g-rationale').value.trim();
  state.goals = {
    calories: num('g-cal'),
    protein: num('g-pro'),
    carbs: num('g-carb'),
    fat: num('g-fat'),
    fiber: num('g-fib'),
    proteinFloorPerMeal: num('g-floor'),
    rationale,
  };
  save();
  toast('Goals saved');
}
