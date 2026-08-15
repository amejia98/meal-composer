import { useEffect, useState } from 'react';
import type { FoodItem, Ingredient, Recipe, Step } from '../../lib/types';
import { computePerServing, computeTotals, macroLine } from '../../lib/nutrition';
import { toast } from '../shared/toastBus';

function blank() {
  return { name: '', servings: '4', active: '', ingredients: [] as Ingredient[], steps: [] as Step[], stepText: '' };
}

export function RecipeForm({
  items, editingRecipe, onSave, onDelete, onCancel,
}: {
  items: FoodItem[];
  editingRecipe: Recipe | null;
  onSave: (recipe: Recipe, isNew: boolean) => Promise<string | null>;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(blank());
  const [pickerId, setPickerId] = useState('');

  useEffect(() => {
    if (editingRecipe) {
      setForm({
        name: editingRecipe.name,
        servings: String(editingRecipe.servings),
        active: editingRecipe.activeMinutes ? String(editingRecipe.activeMinutes) : '',
        ingredients: editingRecipe.ingredients.map((g) => ({ ...g })),
        steps: editingRecipe.steps.map((s) => ({ ...s })),
        stepText: '',
      });
    } else {
      setForm(blank());
    }
    setPickerId('');
  }, [editingRecipe]);

  const findItem = (id: string) => items.find((i) => i.id === id);
  const servingsNum = Math.max(1, parseInt(form.servings, 10) || 1);
  const totals = computeTotals(form.ingredients, findItem);
  const perServing = computePerServing(totals, servingsNum);

  function addIngredient() {
    if (!pickerId) return;
    if (form.ingredients.some((g) => g.itemId === pickerId)) return toast('Already in the list');
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { itemId: pickerId, qty: 1, unit: 'serving' }] }));
  }

  function setQty(index: number, value: string) {
    const qty = parseFloat(value) || 0;
    setForm((f) => ({ ...f, ingredients: f.ingredients.map((g, i) => (i === index ? { ...g, qty } : g)) }));
  }

  function removeIngredient(index: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  }

  function addStep() {
    if (!form.stepText) return;
    setForm((f) => ({ ...f, steps: [...f.steps, { text: f.stepText, phase: 'day-of' }], stepText: '' }));
  }

  /** Flip a step between day-of and make-ahead. Sunday Prep reads this field. */
  function flipStep(index: number) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === index ? { ...s, phase: s.phase === 'make-ahead' ? 'day-of' : 'make-ahead' } : s)),
    }));
  }

  function removeStep(index: number) {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!form.name) return toast('Give it a name first');
    if (!form.ingredients.length) return toast('Add at least one ingredient');

    const isNew = !editingRecipe;
    const recipe: Recipe = {
      id: editingRecipe?.id ?? '',
      name: form.name,
      servings: servingsNum,
      ingredients: form.ingredients,
      steps: form.steps,
      activeMinutes: form.active ? parseFloat(form.active) : null,
      totalMinutes: editingRecipe?.totalMinutes ?? null,
      nutrition: perServing,
      mealSlots: editingRecipe?.mealSlots ?? [],
    };

    const error = await onSave(recipe, isNew);
    if (error) return toast(error);
    toast(isNew ? 'Saved' : 'Updated');
    setForm(blank());
  }

  return (
    <section>
      <div className="card">
        <h2>The recipe</h2>
        <div className="field"><label htmlFor="r-name">Name</label>
          <input id="r-name" placeholder="Marinated chicken bowls" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="row">
          <div className="field"><label htmlFor="r-servings">Makes how many servings</label>
            <input id="r-servings" type="number" inputMode="numeric" min={1} value={form.servings} onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))} /></div>
          <div className="field"><label htmlFor="r-active">Active time (min)</label>
            <input id="r-active" type="number" inputMode="numeric" placeholder="25" value={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value }))} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Ingredients</h2>
        <p className="hint">Pulled from your food items — quantities are in servings of that item. Add the item first if it isn't here yet.</p>
        <div>
          {form.ingredients.length === 0 ? (
            <p className="note">Nothing added yet.</p>
          ) : form.ingredients.map((g, i) => {
            const item = findItem(g.itemId);
            return (
              <div className="ing" key={i}>
                <span className="nm">{item ? item.name : '(missing item)'}<br /><span className="macros">{item?.servingLabel ?? ''}</span></span>
                <input className="qty" type="number" inputMode="decimal" step="any" min={0} value={g.qty} onChange={(e) => setQty(i, e.target.value)} />
                <button className="x" aria-label="Remove" onClick={() => removeIngredient(i)}>×</button>
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <label className="sr-only" htmlFor="r-picker">Food item</label>
          <select id="r-picker" style={{ flex: 2 }} value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
            <option value="">{items.length ? 'Choose a food item' : 'No food items yet — add some first'}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button className="btn-ghost btn-sm" style={{ flex: 'none' }} onClick={addIngredient}>Add</button>
        </div>
        <div className="prev" style={{ marginTop: 14 }}>
          <div className="lab">Per serving</div>
          <div className="val">{form.ingredients.length ? macroLine(perServing) : 'Add ingredients to see this.'}</div>
        </div>
      </div>

      <div className="card">
        <h2>Steps</h2>
        <p className="hint">Tap a step's tag to flip it between day-of and make-ahead. Make-ahead steps are what Sunday prep will pull from later.</p>
        <div>
          {form.steps.length === 0 ? (
            <p className="note">No steps yet.</p>
          ) : form.steps.map((s, i) => (
            <div className="step" key={i}>
              <span className="tx">{i + 1}. {s.text}</span>
              <span className={`ph${s.phase === 'make-ahead' ? ' ahead' : ''}`} onClick={() => flipStep(i)}>{s.phase}</span>
              <button className="x" aria-label="Remove" onClick={() => removeStep(i)}>×</button>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <label className="sr-only" htmlFor="r-steptext">Step</label>
          <input
            id="r-steptext" placeholder="Marinate the chicken" style={{ flex: 2 }}
            value={form.stepText}
            onChange={(e) => setForm((f) => ({ ...f, stepText: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } }}
          />
          <button className="btn-ghost btn-sm" style={{ flex: 'none' }} onClick={addStep}>Add</button>
        </div>
      </div>

      <button className="btn" onClick={handleSave}>Save recipe</button>
      <button className="btn-ghost btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={onCancel}>Cancel</button>
      {editingRecipe && (
        <p className="note">
          Editing "{editingRecipe.name}". <a href="#" onClick={(e) => { e.preventDefault(); onDelete(editingRecipe.id); }}>Delete this recipe</a>
        </p>
      )}
    </section>
  );
}
