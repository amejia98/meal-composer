/**
 * The add/edit recipe screen.
 *
 * Ingredient quantities are in *servings of that food item*, not grams. That
 * dodges a whole unit-conversion layer: each item already knows its own
 * nutrition per serving, so a recipe is a weighted sum. If you ever need real
 * units (200g of X), add a grams-per-serving field to FoodItem rather than
 * teaching this file about unit math.
 */

import { state, save, findItem, findRecipe } from './state.js';
import { val, num, setVal, esc, uid, round1, macroLine, toast, emit } from './util.js';

let editingId = null;
let ingredients = [];   // [{ itemId, qty }]
let steps = [];         // [{ text, phase }]

/* ------------------------------------------------------------ ingredients */

export function refreshPicker() {
  const picker = document.getElementById('r-picker');
  picker.innerHTML = state.items.length
    ? state.items.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')
    : '<option value="">No food items yet — add some first</option>';
}

export function addIngredient() {
  const id = document.getElementById('r-picker').value;
  if (!id) return;
  if (ingredients.some((g) => g.itemId === id)) return toast('Already in the list');
  ingredients.push({ itemId: id, qty: 1 });
  renderIngredients();
  preview();
}

export function setQty(index, value) {
  ingredients[index].qty = parseFloat(value) || 0;
  preview();
}

export function removeIngredient(index) {
  ingredients.splice(index, 1);
  renderIngredients();
  preview();
}

export function renderIngredients() {
  const el = document.getElementById('r-ings');
  if (!ingredients.length) {
    el.innerHTML = '<p class="note">Nothing added yet.</p>';
    return;
  }
  el.innerHTML = ingredients.map((g, i) => {
    const item = findItem(g.itemId);
    return `<div class="ing">
      <span class="nm">${esc(item ? item.name : '(missing item)')}
        <br><span class="macros">${esc(item ? item.servingLabel : '')}</span></span>
      <input class="qty" type="number" inputmode="decimal" step="any" min="0"
             value="${g.qty}" data-action="set-qty" data-index="${i}">
      <button class="x" data-action="remove-ing" data-index="${i}" aria-label="Remove">×</button>
    </div>`;
  }).join('');
}

/* -------------------------------------------------------------- nutrition */

function totals() {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const g of ingredients) {
    const item = findItem(g.itemId);
    if (!item) continue;
    for (const k of Object.keys(t)) t[k] += (item.nutrition[k] || 0) * g.qty;
  }
  return t;
}

function servings() {
  return Math.max(1, parseInt(document.getElementById('r-servings').value, 10) || 1);
}

function perServing() {
  const t = totals();
  const s = servings();
  return {
    calories: Math.round(t.calories / s),
    protein: round1(t.protein / s),
    carbs: round1(t.carbs / s),
    fat: round1(t.fat / s),
    fiber: round1(t.fiber / s),
  };
}

export function preview() {
  document.getElementById('r-preview').innerHTML = ingredients.length
    ? `<div class="macros">${macroLine(perServing())}</div>`
    : '<div class="macros">Add ingredients to see this.</div>';
}

/* ------------------------------------------------------------------ steps */

export function addStep() {
  const text = val('r-steptext');
  if (!text) return;
  steps.push({ text, phase: 'day-of' });
  setVal('r-steptext', '');
  renderSteps();
}

/** Flip a step between day-of and make-ahead. Sunday Prep reads this field. */
export function flipStep(index) {
  steps[index].phase = steps[index].phase === 'make-ahead' ? 'day-of' : 'make-ahead';
  renderSteps();
}

export function removeStep(index) {
  steps.splice(index, 1);
  renderSteps();
}

export function renderSteps() {
  const el = document.getElementById('r-steps');
  if (!steps.length) {
    el.innerHTML = '<p class="note">No steps yet.</p>';
    return;
  }
  el.innerHTML = steps.map((s, i) => `<div class="step">
    <span class="tx">${i + 1}. ${esc(s.text)}</span>
    <span class="ph${s.phase === 'make-ahead' ? ' ahead' : ''}"
          data-action="flip-step" data-index="${i}">${s.phase}</span>
    <button class="x" data-action="remove-step" data-index="${i}" aria-label="Remove">×</button>
  </div>`).join('');
}

/* ------------------------------------------------------------------- CRUD */

export function saveRecipe() {
  const name = val('r-name');
  if (!name) return toast('Give it a name first');
  if (!ingredients.length) return toast('Add at least one ingredient');

  const recipe = {
    id: editingId || uid(),
    name,
    servings: servings(),
    ingredients: ingredients.map((g) => ({ itemId: g.itemId, qty: g.qty, unit: 'serving' })),
    steps: steps.map((s) => ({ ...s })),
    activeMinutes: num('r-active') || null,
    nutrition: perServing(),
    mealSlots: [],
  };

  if (editingId) {
    state.recipes[state.recipes.findIndex((r) => r.id === editingId)] = recipe;
    toast('Updated');
  } else {
    state.recipes.push(recipe);
    toast(`Saved — ${state.recipes.length} recipes`);
  }

  save();
  reset();
  emit('data-changed');
  emit('navigate', 'lib');
}

export function reset() {
  ['r-name', 'r-active', 'r-steptext'].forEach((id) => setVal(id, ''));
  setVal('r-servings', 4);
  document.getElementById('r-editing').textContent = '';
  ingredients = [];
  steps = [];
  editingId = null;
  renderIngredients();
  renderSteps();
  preview();
}

export function edit(id) {
  const r = findRecipe(id);
  if (!r) return;
  reset();
  editingId = id;

  setVal('r-name', r.name);
  setVal('r-servings', r.servings);
  setVal('r-active', r.activeMinutes || '');
  ingredients = r.ingredients.map((g) => ({ itemId: g.itemId, qty: g.qty }));
  steps = (r.steps || []).map((s) => ({ ...s }));

  document.getElementById('r-editing').innerHTML =
    `Editing “${esc(r.name)}”. ` +
    `<a href="#" data-action="delete-recipe" data-id="${r.id}">Delete this recipe</a>`;

  refreshPicker();
  renderIngredients();
  renderSteps();
  preview();
  emit('navigate', 'recipe');
}

export function remove(id) {
  state.recipes = state.recipes.filter((r) => r.id !== id);
  save();
  reset();
  emit('data-changed');
  emit('navigate', 'lib');
  toast('Deleted');
}
