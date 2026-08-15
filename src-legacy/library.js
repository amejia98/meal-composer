/**
 * The library list — browse, search, and back up.
 *
 * Deliberately imports neither items.js nor recipes.js: tapping a row emits
 * an event that app.js routes. Keeps the module graph acyclic.
 */

import { state, merge, storageWorks } from './state.js';
import { val, esc, plural, toast, emit } from './util.js';

let tab = 'items';

export const countLine = () =>
  `· ${plural(state.items.length, 'item')}, ${plural(state.recipes.length, 'recipe')}`;

export function setTab(next) {
  tab = next;
  document.getElementById('tab-items').classList.toggle('on', next === 'items');
  document.getElementById('tab-recipes').classList.toggle('on', next === 'recipes');
  render();
}

function itemRow(i) {
  const tags =
    (i.verified ? '' : '<span class="tag unv">unverified</span>') +
    (i.alwaysHave ? '<span class="tag">pantry</span>' : '');
  return `<div class="item" data-action="open-item" data-id="${i.id}">
    <div>
      <div class="nm">${esc(i.name)}${tags}</div>
      <div class="sub">${esc(i.servingLabel)} · ${i.nutrition.protein}g protein · ${i.nutrition.fiber}g fiber</div>
    </div>
    <div class="kcal">${i.nutrition.calories} cal</div>
  </div>`;
}

function recipeRow(r) {
  const ahead = (r.steps || []).filter((s) => s.phase === 'make-ahead').length;
  return `<div class="item" data-action="open-recipe" data-id="${r.id}">
    <div>
      <div class="nm">${esc(r.name)}${ahead ? `<span class="tag">${ahead} make-ahead</span>` : ''}</div>
      <div class="sub">${plural(r.servings, 'serving')} · ${plural(r.ingredients.length, 'ingredient')} · ${r.nutrition.protein}g protein</div>
    </div>
    <div class="kcal">${r.nutrition.calories} cal</div>
  </div>`;
}

export function render() {
  const q = val('search').toLowerCase();
  const el = document.getElementById('lib-list');
  document.getElementById('count').textContent = countLine();

  const source = tab === 'items' ? state.items : state.recipes;
  const rows = source
    .filter((x) => x.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!rows.length) {
    const empty = source.length
      ? `Nothing matches “${esc(q)}”.`
      : tab === 'items'
        ? 'No food items yet.<br>Start with the five things you eat most weeks.'
        : 'No recipes yet.<br>Recipes are built from food items, so add a few of those first.';
    el.innerHTML = `<div class="empty">${empty}</div>`;
  } else {
    el.innerHTML = rows.map(tab === 'items' ? itemRow : recipeRow).join('');
  }

  document.getElementById('storagenote').innerHTML = storageWorks()
    ? 'Saved in this browser. Export a backup now and then — clearing site data wipes it.'
    : '<span class="warn">This preview can\'t save between refreshes.</span> ' +
      'Download the file and open it directly in Safari or Chrome and it will remember. ' +
      'Export a backup before you close the tab.';
}

/* ----------------------------------------------------------------- backup */

export function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'souschef-library.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup downloaded');
}

export function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      merge(JSON.parse(reader.result));
      render();
      emit('data-changed');
      toast(`Imported — ${plural(state.items.length, 'item')}, ${plural(state.recipes.length, 'recipe')}`);
    } catch {
      toast("That file didn't look like a Sous Chef backup");
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
