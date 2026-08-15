import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTargets, type Profile } from '../src/lib/targets.ts';

const base: Profile = { age: 25, gender: 'male', weightLb: 176, heightIn: 70, activityLevel: 'moderate', goalType: 'maintain' };

test('Mifflin-St Jeor + moderate activity + maintain', () => {
  const t = computeTargets(base);
  assert.deepEqual(t, { calories: 2774, protein: 144, carbs: 356, fat: 86, fiber: 39, proteinFloorPerMeal: 36 });
});

test('bulk gives more calories and protein than maintain', () => {
  const maintain = computeTargets(base);
  const bulk = computeTargets({ ...base, goalType: 'bulk' });
  assert.ok(bulk.calories > maintain.calories);
  assert.ok(bulk.protein > maintain.protein);
});

test('lean gives fewer calories than maintain, but more protein per kg', () => {
  const maintain = computeTargets(base);
  const lean = computeTargets({ ...base, goalType: 'lean' });
  assert.ok(lean.calories < maintain.calories);
  assert.ok(lean.protein > maintain.protein);
});

test('more activity means more calories, same everything else being equal', () => {
  const sedentary = computeTargets({ ...base, activityLevel: 'sedentary' });
  const veryActive = computeTargets({ ...base, activityLevel: 'very-active' });
  assert.ok(veryActive.calories > sedentary.calories);
});

test('protein floor per meal is clamped between 20 and 40', () => {
  const smallLightPerson = computeTargets({ age: 60, gender: 'female', weightLb: 95, heightIn: 60, activityLevel: 'sedentary', goalType: 'maintain' });
  assert.ok(smallLightPerson.proteinFloorPerMeal >= 20);

  const bigBulkingPerson = computeTargets({ age: 22, gender: 'male', weightLb: 260, heightIn: 76, activityLevel: 'very-active', goalType: 'bulk' });
  assert.ok(bigBulkingPerson.proteinFloorPerMeal <= 40);
});

test('carbs never go negative even for a very low-calorie, high-protein target', () => {
  const t = computeTargets({ age: 70, gender: 'female', weightLb: 90, heightIn: 58, activityLevel: 'sedentary', goalType: 'lean' });
  assert.ok(t.carbs >= 0);
});

test('fiber scales as 14g per 1,000 calories', () => {
  const t = computeTargets(base);
  assert.equal(t.fiber, Math.round((t.calories / 1000) * 14));
});
