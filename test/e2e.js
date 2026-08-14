/**
 * End-to-end tests. Drives a real browser against the real app.
 *
 *   npm run test:e2e
 *
 * Requires a dev server on PORT (default 5173) — npm run test:e2e starts one.
 * ES modules can't load over file://, so this can't just open index.html.
 *
 * Tests reach into window.__souschef for assertions, never for actions:
 * actions go through real clicks so the delegated-handler wiring is covered.
 */

import { chromium } from 'playwright';

const BASE = `http://localhost:${process.env.PORT || 5173}`;

const pass = [];
const fail = [];
const check = (name, ok, detail) =>
  (ok ? pass : fail).push(name + (detail && !ok ? ` — ${detail}` : ''));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

await page.goto(BASE);
await page.waitForFunction(() => window.__souschef);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__souschef);

const state = () => page.evaluate(() => window.__souschef.state);

/* ------------------------------------------------- item via label paste */

await page.click('#n-item');
await page.click('#m-paste');
await page.fill('#i-paste', `Información Nutricional
Tamaño por porción 30 g
Calorías 120
Grasa total 9 g
Carbohidratos totales 2 g
Fibra dietética 1 g
Proteínas 7 g`);
await page.click('[data-action="read-label"]');
await page.waitForTimeout(100);

check('label paste fills the form',
  (await page.inputValue('#i-cal')) === '120' &&
  (await page.inputValue('#i-lblamt')) === '30');

// 30g label → 45g serving = ×1.5 → 180 cal, 10.5g protein
await page.fill('#i-name', 'Queso panela');
await page.fill('#i-servlabel', '1 slice');
await page.fill('#i-myamt', '45');
await page.waitForTimeout(100);
const preview = await page.textContent('#i-preview');
check('serving conversion scales by 1.5',
  preview.includes('180 cal') && preview.includes('10.5g protein'),
  preview.replace(/\s+/g, ' ').trim());

await page.click('#i-slots .chip[data-slot="breakfast"]');
await page.click('#i-always');
await page.click('[data-action="save-item"]');
await page.waitForTimeout(150);

const saved = (await state()).items[0];
check('item saved with scaled nutrition',
  saved.nutrition.calories === 180 && saved.nutrition.protein === 10.5 &&
  saved.alwaysHave === true && saved.mealSlots.includes('breakfast') &&
  saved.verified === false && saved.source === 'label-scan',
  JSON.stringify(saved.nutrition));

check('unverified rows are flagged in the list',
  (await page.textContent('#lib-list')).includes('unverified'));

/* ---------------------------------------------------- stale-value guard */

await page.click('#n-item');
await page.click('#m-paste');
await page.fill('#i-paste', 'Calories 500');
await page.click('[data-action="read-label"]');
await page.waitForTimeout(100);
check('a second parse clears what it cannot find',
  (await page.inputValue('#i-pro')) === '' && (await page.inputValue('#i-cal')) === '500');

/* ------------------------------------------------------ item via typing */

await page.click('[data-action="cancel-item"]');
await page.click('#n-item');
await page.fill('#i-name', 'Arepa');
await page.fill('#i-lblamt', '1');
await page.fill('#i-lblunit', 'arepa');
await page.fill('#i-cal', '180');
await page.fill('#i-pro', '4');
await page.fill('#i-carb', '38');
await page.fill('#i-fat', '2');
await page.fill('#i-fib', '2');
await page.fill('#i-servlabel', '1 arepa');
await page.fill('#i-myamt', '1');
await page.click('[data-action="save-item"]');
await page.waitForTimeout(150);
check('manual entry saves verified', (await state()).items[1].verified === true);

/* ---------------------------------------------------------------- recipe */

// 2 × queso (180/10.5) + 1 × arepa (180/4) = 540 cal / 25g over 2 servings
await page.click('#n-recipe');
await page.fill('#r-name', 'Arepa breakfast');
await page.fill('#r-servings', '2');
await page.selectOption('#r-picker', { label: 'Queso panela' });
await page.click('#r-adding');
await page.waitForTimeout(80);
await page.fill('#r-ings .ing:nth-child(1) .qty', '2');
await page.selectOption('#r-picker', { label: 'Arepa' });
await page.click('#r-adding');
await page.waitForTimeout(150);
const rPreview = await page.textContent('#r-preview');
check('recipe per-serving math',
  rPreview.includes('270 cal') && rPreview.includes('12.5g protein'),
  rPreview.replace(/\s+/g, ' ').trim());

await page.fill('#r-steptext', 'Marinate the queso');
await page.click('#r-addstep');
await page.waitForTimeout(80);
await page.click('#r-steps .ph');
await page.waitForTimeout(80);
check('step flips to make-ahead',
  (await page.textContent('#r-steps')).includes('make-ahead'));

await page.click('[data-action="save-recipe"]');
await page.waitForTimeout(150);
const recipe = (await state()).recipes[0];
check('recipe saved',
  recipe.nutrition.calories === 270 && recipe.ingredients.length === 2 &&
  recipe.steps[0].phase === 'make-ahead',
  JSON.stringify(recipe.nutrition));

/* ----------------------------------------------------------- delete guard */

await page.click('#lib-list .item >> nth=1');   // Queso panela (alphabetical)
await page.waitForTimeout(120);
await page.click('[data-action="delete-item"]');
await page.waitForTimeout(120);
check('cannot delete an item a recipe depends on',
  (await state()).items.length === 2,
  await page.textContent('#toast'));

/* ------------------------------------------------------------ round-trips */

await page.click('[data-action="cancel-item"]');
await page.reload();
await page.waitForFunction(() => window.__souschef);
const afterReload = await state();
check('survives a reload',
  afterReload.items.length === 2 && afterReload.recipes.length === 1,
  JSON.stringify({ i: afterReload.items.length, r: afterReload.recipes.length }));

await page.click('#lib-list .item >> nth=1');
await page.waitForTimeout(120);
await page.click('[data-action="save-item"]');
await page.waitForTimeout(150);
const reSaved = (await state()).items.find((i) => i.name === 'Queso panela');
check('editing does not silently re-scale nutrition',
  reSaved.nutrition.calories === 180 && reSaved.nutrition.protein === 10.5 &&
  reSaved.verified === true,
  JSON.stringify(reSaved.nutrition));

/* ------------------------------------------------------------------ report */

console.log(`\nPASS (${pass.length})`);
pass.forEach((p) => console.log(`  ✓ ${p}`));
if (fail.length) {
  console.log(`\nFAIL (${fail.length})`);
  fail.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log(`\nConsole errors: ${consoleErrors.length ? `\n  ${consoleErrors.join('\n  ')}` : 'none'}`);

await browser.close();
process.exit(fail.length || consoleErrors.length ? 1 : 0);
