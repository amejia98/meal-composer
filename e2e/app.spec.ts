/**
 * End-to-end tests against the real React app + a real Supabase project.
 * No auth — the app talks to Supabase with the anon key directly, so these
 * tests just need VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY configured (see
 * .env.local) and a dev server running.
 *
 * Tests reach into window.__mealComposer for assertions, never for actions:
 * actions go through real clicks so the component wiring is covered. This
 * mirrors the old window.__souschef pattern from the vanilla-JS app.
 *
 *   npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test';

async function clearData(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__mealComposer);
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    await supabase.from('recipes').delete().not('id', 'is', null);
    await supabase.from('food_items').delete().not('id', 'is', null);
    await supabase.from('goals').delete().not('id', 'is', null);
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__mealComposer);
}

test.beforeEach(async ({ page }) => {
  await clearData(page);
});

test('label paste, serving conversion, save', async ({ page }) => {
  await page.getByText('Food item', { exact: false }).click();
  await page.getByText('Paste label text').click();
  await page.fill('#i-paste', `Información Nutricional
Tamaño por porción 30 g
Calorías 120
Grasa total 9 g
Carbohidratos totales 2 g
Fibra dietética 1 g
Proteínas 7 g`);
  await page.getByText('Read the label').click();

  await expect(page.locator('#i-cal')).toHaveValue('120');
  await expect(page.locator('#i-lblamt')).toHaveValue('30');

  // 30g label → 45g serving = ×1.5 → 180 cal, 10.5g protein
  await page.fill('#i-name', 'Queso panela');
  await page.fill('#i-servlabel', '1 slice');
  await page.fill('#i-myamt', '45');

  const preview = page.locator('.prev .val').first();
  await expect(preview).toContainText('180 cal');
  await expect(preview).toContainText('10.5g protein');

  await page.locator('.chip[data-slot="breakfast"]').click();
  await page.getByText('Save item').click();

  await expect(page.getByText('Queso panela')).toBeVisible();
});

test('a second parse clears what it cannot find', async ({ page }) => {
  await page.getByText('Food item', { exact: false }).click();
  await page.getByText('Paste label text').click();
  await page.fill('#i-paste', 'Calories 500');
  await page.getByText('Read the label').click();

  await expect(page.locator('#i-cal')).toHaveValue('500');
  await expect(page.locator('#i-pro')).toHaveValue('');
});

test('manual entry saves', async ({ page }) => {
  await page.getByText('Food item', { exact: false }).click();
  await page.fill('#i-name', 'Arepa');
  await page.fill('#i-lblamt', '1');
  await page.fill('#i-cal', '180');
  await page.fill('#i-pro', '4');
  await page.fill('#i-carb', '38');
  await page.fill('#i-fat', '2');
  await page.fill('#i-fib', '2');
  await page.fill('#i-servlabel', '1 arepa');
  await page.fill('#i-myamt', '1');
  await page.getByText('Save item').click();

  await expect(page.getByText('Arepa')).toBeVisible();
});

test('recipe math and step phase-flip', async ({ page }) => {
  // Seed two items via the API to keep this test focused on the recipe form.
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    await supabase.from('food_items').insert([
      { name: 'Queso panela', category: 'dairy', serving_label: '1 slice', calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0 },
      { name: 'Arepa', category: 'carb', serving_label: '1 arepa', calories: 180, protein: 4, carbs: 38, fat: 2, fiber: 2 },
    ]);
  });

  await page.reload();
  await page.getByText('Recipe', { exact: false }).click();
  await page.fill('#r-name', 'Arepa breakfast');
  await page.fill('#r-servings', '2');

  await page.selectOption('#r-picker', { label: 'Queso panela' });
  await page.getByText('Add').first().click();
  await page.locator('.ing .qty').first().fill('2');

  await page.selectOption('#r-picker', { label: 'Arepa' });
  await page.getByText('Add').first().click();

  const preview = page.locator('.prev .val').first();
  // 2 × queso (180/10.5) + 1 × arepa (180/4) = 540 cal / 25g over 2 servings
  await expect(preview).toContainText('270 cal');
  await expect(preview).toContainText('12.5g protein');

  await page.fill('#r-steptext', 'Marinate the queso');
  await page.getByText('Add').last().click();
  await page.locator('.step .ph').click();
  await expect(page.locator('.step .ph')).toHaveText('make-ahead');

  await page.getByText('Save recipe').click();
  await expect(page.locator('h1')).toContainText('Your library');
});

test('cannot delete an item a recipe depends on', async ({ page }) => {
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    const { data: items } = await supabase.from('food_items').insert([
      { name: 'Queso panela', category: 'dairy', serving_label: '1 slice', calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0 },
    ]).select();
    await supabase.from('recipes').insert({
      name: 'Uses queso', servings: 1,
      ingredients: [{ itemId: items![0].id, qty: 1, unit: 'serving' }],
      steps: [], calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0,
    });
  });

  await page.reload();
  await page.getByText('Queso panela').click();
  await page.getByText('Delete this item').click();
  await expect(page.locator('.toast')).toContainText('remove it there first');
});

test('editing does not silently re-scale nutrition', async ({ page }) => {
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    await supabase.from('food_items').insert({
      name: 'Queso panela', category: 'dairy', serving_label: '1 slice',
      calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0,
      label_amount: 30, label_unit: 'g', label_my_amount: 45,
      source: 'label-scan',
    });
  });

  await page.reload();
  await page.getByText('Queso panela').click();
  await page.getByText('Save item').click();

  await page.getByText('Queso panela').click();
  await expect(page.locator('#i-cal')).toHaveValue('180');
  await expect(page.locator('#i-pro')).toHaveValue('10.5');
});
