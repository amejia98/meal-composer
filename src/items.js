/** The add/edit food item screen. */

import { state, save, findItem, recipesUsing } from './state.js';
import { parseNutritionLabel } from './label.js';
import {
  $$, val, num, setVal, clearFields, esc, uid, round1, macroLine, toast, emit,
} from './util.js';

const NUTRITION_FIELDS = ['i-cal', 'i-pro', 'i-carb', 'i-fat', 'i-fib'];
const ALL_FIELDS = [
  'i-name', 'i-paste', 'i-lblamt', 'i-lblunit', ...NUTRITION_FIELDS,
  'i-servlabel', 'i-myamt', 'i-myunit',
];

let editingId = null;

export const isEditing = () => editingId !== null;

/* ---------------------------------------------------------------- parsing */

export function readLabel() {
  const text = val('i-paste');
  const out = document.getElementById('parse-result');
  if (!text) {
    out.innerHTML = '<span class="warn">Paste the label text first.</span>';
    return;
  }

  // Reading a label means reading *this* label. Without the wipe, a nutrient
  // the parser misses silently keeps the previous product's number.
  clearFields([...NUTRITION_FIELDS, 'i-lblamt', 'i-lblunit']);

  const { nutrition, serving, found } = parseNutritionLabel(text);
  setVal('i-cal', nutrition.calories);
  setVal('i-pro', nutrition.protein);
  setVal('i-carb', nutrition.carbs);
  setVal('i-fat', nutrition.fat);
  setVal('i-fib', nutrition.fiber);
  if (serving.amount !== null) {
    setVal('i-lblamt', serving.amount);
    setVal('i-lblunit', serving.unit);
  }

  out.innerHTML = found.length
    ? `Found <strong>${found.join(', ')}</strong>. Check the fields above — ` +
      'labels vary and this is a guess.'
    : '<span class="warn">Couldn\'t find anything recognizable.</span> ' +
      'Type it in instead — it takes about twenty seconds.';

  preview();
}

/* ------------------------------------------------------- serving scaling */

/** Label values are per `i-lblamt`; you eat `i-myamt`. This is the ratio. */
function ratio() {
  const label = num('i-lblamt');
  const mine = num('i-myamt');
  return label > 0 && mine > 0 ? mine / label : 1;
}

/** Nutrition for one of *your* servings, scaled off the label values. */
function scaled() {
  const r = ratio();
  return {
    calories: Math.round(num('i-cal') * r),
    protein: round1(num('i-pro') * r),
    carbs: round1(num('i-carb') * r),
    fat: round1(num('i-fat') * r),
    fiber: round1(num('i-fib') * r),
  };
}

export function preview() {
  setVal('i-myunit', val('i-lblunit'));
  const r = ratio();
  const label = val('i-servlabel') || '1 serving';
  const scaleNote = Math.abs(r - 1) < 0.001
    ? ''
    : `<div class="macros" style="margin-top:5px">Label values × ${Math.round(r * 100) / 100}</div>`;
  document.getElementById('i-preview').innerHTML =
    `${esc(label)}<div class="macros" style="margin-top:5px">${macroLine(scaled())}</div>${scaleNote}`;
}

/* ------------------------------------------------------------------ CRUD */

const selectedSlots = () =>
  $$('#i-slots .chip.on').map((c) => c.dataset.slot);

export function saveItem() {
  const name = val('i-name');
  if (!name) return toast('Give it a name first');
  if (num('i-cal') === 0 && num('i-pro') === 0) {
    return toast('Add at least calories or protein');
  }

  const fromLabel = Boolean(val('i-paste'));
  const item = {
    id: editingId || uid(),
    name,
    category: val('i-cat'),
    servingLabel: val('i-servlabel') || '1 serving',
    labelBasis: {
      amount: num('i-lblamt') || null,
      unit: val('i-lblunit') || null,
      myAmount: num('i-myamt') || null,
    },
    nutrition: scaled(),
    mealSlots: selectedSlots(),
    alwaysHave: document.getElementById('i-always').classList.contains('on'),
    source: fromLabel ? 'label-scan' : 'manual',
    // Saving an edit means a human just looked at these numbers.
    verified: editingId ? true : !fromLabel,
    lastEaten: null,
  };

  if (editingId) {
    state.items[state.items.findIndex((i) => i.id === editingId)] = item;
    toast('Updated');
  } else {
    state.items.push(item);
    toast(`Saved — ${state.items.length} items`);
  }

  save();
  reset();
  emit('data-changed');
  emit('navigate', 'lib');
}

export function reset() {
  clearFields(ALL_FIELDS);
  setVal('i-cat', 'protein');
  $$('#i-slots .chip').forEach((c) => c.classList.remove('on'));
  document.getElementById('i-always').classList.remove('on');
  document.getElementById('parse-result').textContent = '';
  document.getElementById('i-editing').textContent = '';
  editingId = null;
  setEntryMode('type');
  preview();
}

export function edit(id) {
  const it = findItem(id);
  if (!it) return;
  reset();
  editingId = id;

  setVal('i-name', it.name);
  setVal('i-cat', it.category);
  setVal('i-servlabel', it.servingLabel);
  // Stored nutrition is already per-serving, so show it 1:1 and let the
  // scaling machinery be a no-op. Editing must never silently re-scale.
  setVal('i-lblamt', 1);
  setVal('i-lblunit', 'serving');
  setVal('i-myamt', 1);
  setVal('i-cal', it.nutrition.calories);
  setVal('i-pro', it.nutrition.protein);
  setVal('i-carb', it.nutrition.carbs);
  setVal('i-fat', it.nutrition.fat);
  setVal('i-fib', it.nutrition.fiber);

  for (const slot of it.mealSlots || []) {
    document.querySelector(`#i-slots .chip[data-slot="${slot}"]`)?.classList.add('on');
  }
  if (it.alwaysHave) document.getElementById('i-always').classList.add('on');

  document.getElementById('i-editing').innerHTML =
    `Editing “${esc(it.name)}”. ` +
    `<a href="#" data-action="delete-item" data-id="${it.id}">Delete this item</a>`;

  preview();
  emit('navigate', 'item');
}

export function remove(id) {
  const used = recipesUsing(id);
  if (used.length) {
    return toast(`Used in ${used.length} recipe${used.length > 1 ? 's' : ''} — remove it there first`);
  }
  state.items = state.items.filter((i) => i.id !== id);
  save();
  reset();
  emit('data-changed');
  emit('navigate', 'lib');
  toast('Deleted');
}

/* ------------------------------------------------------------------- UI */

export function setEntryMode(mode) {
  document.getElementById('m-type').classList.toggle('on', mode === 'type');
  document.getElementById('m-paste').classList.toggle('on', mode === 'paste');
  document.getElementById('paste-box').classList.toggle('hidden', mode !== 'paste');
}
