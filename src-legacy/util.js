/** Small shared helpers. No app state in here — see state.js for that. */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** Value of an input by id, trimmed. */
export const val = (id) => document.getElementById(id).value.trim();

/** Numeric value of an input by id. Non-numeric and empty both read as 0. */
export function num(id) {
  const v = parseFloat(document.getElementById(id).value);
  return Number.isFinite(v) ? v : 0;
}

export const setVal = (id, v) => {
  document.getElementById(id).value = v === null || v === undefined ? '' : v;
};

export const clearFields = (ids) => ids.forEach((id) => setVal(id, ''));

/** Escape for innerHTML. Food names are user input; always run them through this. */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const round1 = (x) => Math.round(x * 10) / 10;

/** One-line macro summary used in previews and list rows. */
export const macroLine = (n) =>
  `${n.calories} cal · ${n.protein}g protein · ${n.carbs}g carbs · ` +
  `${n.fat}g fat · ${n.fiber}g fiber`;

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2100);
}

/**
 * Tiny event bus.
 *
 * Exists to keep the module graph acyclic: items.js needs the library list to
 * re-render after a save, and library.js needs to open the item editor when a
 * row is tapped. Importing each other would be a cycle, so both talk to app.js
 * through here instead. Keep it that way.
 */
const bus = new EventTarget();
export const emit = (name, detail) =>
  bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
