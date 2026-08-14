/**
 * Entry point: navigation, event wiring, boot.
 *
 * All interaction goes through one delegated click handler keyed on
 * `data-action`. There are no inline onclick attributes anywhere — module
 * scope isn't global, so they wouldn't resolve, and delegation means
 * dynamically rendered rows work without rebinding.
 *
 * To add an interaction: put data-action="thing" in the markup, add a case to
 * ACTIONS. That's the whole pattern.
 */

import { on, toast } from './util.js';
import { state } from './state.js';
import * as items from './items.js';
import * as recipes from './recipes.js';
import * as library from './library.js';

const VIEWS = ['lib', 'item', 'recipe'];

const TITLES = {
  lib: () => 'Your library',
  item: () => (items.isEditing() ? 'Edit item' : 'New food item'),
  recipe: () => 'New recipe',
};

function navigate(view) {
  for (const v of VIEWS) {
    document.getElementById(`v-${v}`).classList.toggle('active', v === view);
    document.getElementById(`n-${v}`).classList.toggle('on', v === view);
  }
  document.getElementById('title-text').textContent = TITLES[view]();
  document.getElementById('count').textContent =
    view === 'lib' ? library.countLine() : '';
  if (view === 'recipe') recipes.refreshPicker();
  window.scrollTo(0, 0);
}

const ACTIONS = {
  // nav
  'go-lib': () => navigate('lib'),
  'go-item': () => navigate('item'),
  'go-recipe': () => navigate('recipe'),

  // library
  'tab-items': () => library.setTab('items'),
  'tab-recipes': () => library.setTab('recipes'),
  'open-item': (el) => items.edit(el.dataset.id),
  'open-recipe': (el) => recipes.edit(el.dataset.id),
  export: () => library.exportBackup(),
  import: () => document.getElementById('importfile').click(),

  // item form
  'mode-type': () => items.setEntryMode('type'),
  'mode-paste': () => items.setEntryMode('paste'),
  'read-label': () => items.readLabel(),
  'toggle-chip': (el) => el.classList.toggle('on'),
  'save-item': () => items.saveItem(),
  'cancel-item': () => { items.reset(); navigate('lib'); },
  'delete-item': (el) => items.remove(el.dataset.id),

  // recipe form
  'add-ing': () => recipes.addIngredient(),
  'remove-ing': (el) => recipes.removeIngredient(Number(el.dataset.index)),
  'add-step': () => recipes.addStep(),
  'flip-step': (el) => recipes.flipStep(Number(el.dataset.index)),
  'remove-step': (el) => recipes.removeStep(Number(el.dataset.index)),
  'save-recipe': () => recipes.saveRecipe(),
  'cancel-recipe': () => { recipes.reset(); navigate('lib'); },
  'delete-recipe': (el) => recipes.remove(el.dataset.id),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el);
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-action]');
  if (el?.dataset.action === 'set-qty') {
    recipes.setQty(Number(el.dataset.index), el.value);
    return;
  }
  if (e.target.closest('#v-item')) items.preview();
  if (e.target.id === 'search') library.render();
  if (e.target.id === 'r-servings') recipes.preview();
});

document.addEventListener('keydown', (e) => {
  if (e.target.id === 'r-steptext' && e.key === 'Enter') {
    e.preventDefault();
    recipes.addStep();
  }
});

document.getElementById('importfile')
  .addEventListener('change', library.importBackup);

// Cross-module messages (see the bus note in util.js).
on('navigate', navigate);
on('data-changed', () => { library.render(); recipes.refreshPicker(); });

// Boot.
library.render();
recipes.renderIngredients();
recipes.renderSteps();
recipes.preview();
recipes.refreshPicker();
items.preview();
navigate('lib');

// Test hooks. Harmless in production, and the e2e suite drives state through
// them rather than reaching into module internals.
window.__souschef = { state, items, recipes, library, navigate, toast };
