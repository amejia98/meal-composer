/**
 * Unit tests for the label parser.
 *
 * These are cheap and fast because the parser is pure. Every case below is a
 * bug that actually happened — add to this file before fixing a parse bug,
 * not after.
 *
 *   npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNutritionLabel } from '../src/lib/label.ts';

test('English FDA-style panel', () => {
  const { nutrition, serving } = parseNutritionLabel(`Nutrition Facts
Serving size 2/3 cup (55g)
Calories 230
Total Fat 8g
Total Carbohydrate 37g
Dietary Fiber 4g
Protein 3g`);

  assert.equal(nutrition.calories, 230);
  assert.equal(nutrition.fat, 8);
  assert.equal(nutrition.carbs, 37);
  assert.equal(nutrition.fiber, 4);
  assert.equal(nutrition.protein, 3);
  assert.deepEqual(serving, { amount: 55, unit: 'g' });
});

test('Spanish panel — accented words must parse', () => {
  // Regression: /calor\w*​/ silently failed here because \w doesn't match í.
  const { nutrition, serving } = parseNutritionLabel(`Información Nutricional
Tamaño por porción 30 g
Calorías 120
Grasa total 9 g
Carbohidratos totales 2 g
Fibra dietética 1 g
Proteínas 7 g`);

  assert.equal(nutrition.calories, 120);
  assert.equal(nutrition.fat, 9);
  assert.equal(nutrition.carbs, 2);
  assert.equal(nutrition.fiber, 1);
  assert.equal(nutrition.protein, 7);
  assert.deepEqual(serving, { amount: 30, unit: 'g' });
});

test('Total Fat wins over the Saturated Fat line below it', () => {
  const { nutrition } = parseNutritionLabel(`Total Fat 12g
Saturated Fat 3g
Trans Fat 0g`);
  assert.equal(nutrition.fat, 12);
});

test('comma decimal separator', () => {
  const { nutrition } = parseNutritionLabel('Calorías 120,5\nProteínas 7,2 g');
  assert.equal(nutrition.calories, 120.5);
  assert.equal(nutrition.protein, 7.2);
});

test('missing nutrients come back null, never zero', () => {
  // A 0 here would be indistinguishable from "the label says zero", and the
  // form would happily save a fake value.
  const { nutrition, found } = parseNutritionLabel('Calories 100');
  assert.equal(nutrition.calories, 100);
  assert.equal(nutrition.protein, null);
  assert.equal(nutrition.fiber, null);
  assert.deepEqual(found, ['calories']);
});

test('bare "per 100 g" when there is no serving-size line', () => {
  const { serving } = parseNutritionLabel('Valores por 100 g\nCalorías 250');
  assert.deepEqual(serving, { amount: 100, unit: 'g' });
});

test('ml servings', () => {
  const { serving } = parseNutritionLabel('Serving size 240 ml\nCalories 90');
  assert.deepEqual(serving, { amount: 240, unit: 'ml' });
});

test('garbage in, nulls out', () => {
  const { nutrition, serving, found } = parseNutritionLabel('this is not a label');
  assert.deepEqual(found, []);
  assert.equal(serving.amount, null);
  for (const v of Object.values(nutrition)) assert.equal(v, null);
});
