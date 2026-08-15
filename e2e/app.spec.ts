/**
 * End-to-end tests against the real React app + a real Supabase project.
 *
 * Requires a dedicated Supabase test user (password auth enabled just for
 * this one account — magic links can't be scripted without an email inbox
 * to poll). Set these env vars before running:
 *
 *   E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 *
 * Tests reach into window.__mealComposer for assertions, never for actions:
 * actions go through real clicks so the component wiring is covered. This
 * mirrors the old window.__souschef pattern from the vanilla-JS app.
 *
 *   npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.skip(!EMAIL || !PASSWORD, 'Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD to run e2e tests against a live Supabase project.');

async function signIn(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__mealComposer);
  // Password sign-in bypasses the magic-link UI for test speed; the
  // Supabase test account has the email+password provider enabled.
  await page.evaluate(
    async ({ email, password }) => {
      await (window as any).__mealComposer.supabase.auth.signInWithPassword({ email, password });
    },
    { email: EMAIL, password: PASSWORD },
  );
  await page.reload();
  await expect(page.locator('h1')).toContainText('Your library');
}

async function clearAccountData(page: Page) {
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('recipes').delete().eq('user_id', user.id);
    await supabase.from('food_items').delete().eq('user_id', user.id);
    await supabase.from('goals').delete().eq('user_id', user.id);
  });
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await clearAccountData(page);
  await page.reload();
  await page.waitForFunction(() => (window as any).__mealComposer);
});

test('label paste, serving conversion, save as unverified', async ({ page }) => {
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

  await expect(page.getByText('unverified')).toBeVisible();
});

test('a second parse clears what it cannot find', async ({ page }) => {
  await page.getByText('Food item', { exact: false }).click();
  await page.getByText('Paste label text').click();
  await page.fill('#i-paste', 'Calories 500');
  await page.getByText('Read the label').click();

  await expect(page.locator('#i-cal')).toHaveValue('500');
  await expect(page.locator('#i-pro')).toHaveValue('');
});

test('manual entry saves as verified', async ({ page }) => {
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

  await expect(page.getByText('unverified')).not.toBeVisible();
});

test('recipe math and step phase-flip', async ({ page }) => {
  // Seed two items via the API to keep this test focused on the recipe form.
  await page.evaluate(async () => {
    const { supabase } = (window as any).__mealComposer;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('food_items').insert([
      { user_id: user.id, name: 'Queso panela', category: 'dairy', serving_label: '1 slice', calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0, source: 'manual', verified: true },
      { user_id: user.id, name: 'Arepa', category: 'carb', serving_label: '1 arepa', calories: 180, protein: 4, carbs: 38, fat: 2, fiber: 2, source: 'manual', verified: true },
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
    const { data: { user } } = await supabase.auth.getUser();
    const { data: items } = await supabase.from('food_items').insert([
      { user_id: user.id, name: 'Queso panela', category: 'dairy', serving_label: '1 slice', calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0, source: 'manual', verified: true },
    ]).select();
    await supabase.from('recipes').insert({
      user_id: user.id, name: 'Uses queso', servings: 1,
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
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('food_items').insert({
      user_id: user.id, name: 'Queso panela', category: 'dairy', serving_label: '1 slice',
      calories: 180, protein: 10.5, carbs: 3, fat: 12, fiber: 0,
      label_amount: 30, label_unit: 'g', label_my_amount: 45,
      source: 'label-scan', verified: false,
    });
  });

  await page.reload();
  await page.getByText('Queso panela').click();
  await page.getByText('Save item').click();

  await page.getByText('Queso panela').click();
  await expect(page.locator('#i-cal')).toHaveValue('180');
  await expect(page.locator('#i-pro')).toHaveValue('10.5');
});
