/**
 * App state and persistence.
 *
 * localStorage when the browser allows it, memory when it doesn't. Some
 * sandboxed contexts (preview iframes, private-mode edge cases) throw on
 * access rather than returning null, so every call is wrapped — the app
 * degrades to a session-only scratchpad instead of a white screen.
 *
 * Whether persistence is live is surfaced in the UI, not hidden: see
 * `storageWorks()` and the note rendered under the library list. Export/import
 * is the real backup story either way.
 *
 * Schema lives in docs/spec.md §6. Keep them in sync.
 */

const KEY = 'souschef.v1';

const EMPTY = { items: [], recipes: [], goals: null };

let persists = true;
let memory = null;

export function storageWorks() {
  return persists;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    persists = true;
    return raw ? JSON.parse(raw) : structuredClone(EMPTY);
  } catch {
    persists = false;
    return memory || structuredClone(EMPTY);
  }
}

export const state = read();

export function save() {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persists = true;
  } catch {
    persists = false;
  }
}

export const findItem = (id) => state.items.find((i) => i.id === id);
export const findRecipe = (id) => state.recipes.find((r) => r.id === id);

/** Recipes that reference this item — used to block orphaning deletes. */
export const recipesUsing = (itemId) =>
  state.recipes.filter((r) => r.ingredients.some((g) => g.itemId === itemId));

/** Merge an imported backup in by id. Existing entries win ties. */
export function merge(incoming) {
  if (!incoming || !Array.isArray(incoming.items) || !Array.isArray(incoming.recipes)) {
    throw new Error('not a Sous Chef backup');
  }
  for (const key of ['items', 'recipes']) {
    const byId = new Map();
    for (const row of [...incoming[key], ...state[key]]) byId.set(row.id, row);
    state[key] = [...byId.values()];
  }
  if (incoming.goals) state.goals = incoming.goals;
  save();
}
