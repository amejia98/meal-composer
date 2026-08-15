import { useEffect, useState } from 'react';
import type { FoodItem, MealSlot, Nutrition } from '../../lib/types';
import { computeRatio, macroLine, round1, scaleNutrition } from '../../lib/nutrition';
import { parseNutritionLabel } from '../../lib/label';
import { toast } from '../shared/toastBus';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORIES: FoodItem['category'][] = ['protein', 'carb', 'fruit', 'veg', 'dairy', 'fat', 'condiment'];

type FormState = {
  name: string;
  category: FoodItem['category'];
  labelAmount: string;
  labelUnit: string;
  myAmount: string;
  cal: string; pro: string; carb: string; fat: string; fib: string;
  servingLabel: string;
  mealSlots: Set<MealSlot>;
  alwaysHave: boolean;
  entryMode: 'type' | 'paste';
  pasteText: string;
  parseResult: string;
  fromLabel: boolean;
};

function blankForm(): FormState {
  return {
    name: '', category: 'protein',
    labelAmount: '', labelUnit: '', myAmount: '',
    cal: '', pro: '', carb: '', fat: '', fib: '',
    servingLabel: '',
    mealSlots: new Set(),
    alwaysHave: false,
    entryMode: 'type',
    pasteText: '',
    parseResult: '',
    fromLabel: false,
  };
}

function num(s: string): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export function ItemForm({
  editingItem, onSave, onDelete, onCancel,
}: {
  editingItem: FoodItem | null;
  onSave: (item: FoodItem, isNew: boolean) => Promise<string | null>;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(blankForm());

  // Opening in edit mode: stored nutrition is already per-serving, so show
  // it 1:1 and let the scaling machinery be a no-op. Editing must never
  // silently re-scale — this is the single trickiest invariant in the app.
  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name,
        category: editingItem.category,
        labelAmount: '1',
        labelUnit: 'serving',
        myAmount: '1',
        cal: String(editingItem.nutrition.calories),
        pro: String(editingItem.nutrition.protein),
        carb: String(editingItem.nutrition.carbs),
        fat: String(editingItem.nutrition.fat),
        fib: String(editingItem.nutrition.fiber),
        servingLabel: editingItem.servingLabel,
        mealSlots: new Set(editingItem.mealSlots),
        alwaysHave: editingItem.alwaysHave,
        entryMode: 'type',
        pasteText: '',
        parseResult: '',
        fromLabel: false,
      });
    } else {
      setForm(blankForm());
    }
  }, [editingItem]);

  const ratio = computeRatio(num(form.labelAmount), num(form.myAmount));
  const rawNutrition: Nutrition = {
    calories: num(form.cal), protein: num(form.pro), carbs: num(form.carb), fat: num(form.fat), fiber: num(form.fib),
  };
  const scaled = scaleNutrition(rawNutrition, ratio);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function readLabel() {
    if (!form.pasteText) {
      set('parseResult', "Paste the label text first.");
      return;
    }
    const { nutrition, serving, found } = parseNutritionLabel(form.pasteText);
    setForm((f) => ({
      ...f,
      cal: nutrition.calories !== null ? String(nutrition.calories) : '',
      pro: nutrition.protein !== null ? String(nutrition.protein) : '',
      carb: nutrition.carbs !== null ? String(nutrition.carbs) : '',
      fat: nutrition.fat !== null ? String(nutrition.fat) : '',
      fib: nutrition.fiber !== null ? String(nutrition.fiber) : '',
      labelAmount: serving.amount !== null ? String(serving.amount) : f.labelAmount,
      labelUnit: serving.unit !== null ? serving.unit : f.labelUnit,
      parseResult: found.length
        ? `Found ${found.join(', ')}. Check the fields above — labels vary and this is a guess.`
        : "Couldn't find anything recognizable. Type it in instead — it takes about twenty seconds.",
      fromLabel: true,
    }));
  }

  function toggleSlot(slot: MealSlot) {
    setForm((f) => {
      const next = new Set(f.mealSlots);
      next.has(slot) ? next.delete(slot) : next.add(slot);
      return { ...f, mealSlots: next };
    });
  }

  async function handleSave() {
    if (!form.name) return toast('Give it a name first');
    if (num(form.cal) === 0 && num(form.pro) === 0) return toast('Add at least calories or protein');

    const isNew = !editingItem;
    const item: FoodItem = {
      id: editingItem?.id ?? '',
      name: form.name,
      category: form.category,
      servingLabel: form.servingLabel || '1 serving',
      labelBasis: {
        amount: num(form.labelAmount) || null,
        unit: form.labelUnit || null,
        myAmount: num(form.myAmount) || null,
      },
      nutrition: scaled,
      mealSlots: [...form.mealSlots],
      pairsWith: editingItem?.pairsWith ?? [],
      alwaysHave: form.alwaysHave,
      lastEaten: editingItem?.lastEaten ?? null,
      source: form.fromLabel ? 'label-scan' : 'manual',
      barcode: editingItem?.barcode ?? null,
    };

    const error = await onSave(item, isNew);
    if (error) return toast(error);
    toast(isNew ? 'Saved' : 'Updated');
    setForm(blankForm());
  }

  return (
    <section>
      <div className="card">
        <h2>What is it?</h2>
        <div className="field">
          <label htmlFor="i-name">Name</label>
          <input id="i-name" placeholder="Queso panela" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="i-cat">Category</label>
          <select id="i-cat" value={form.category} onChange={(e) => set('category', e.target.value as FoodItem['category'])}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'carb' ? 'Carb / grain' : c === 'fat' ? 'Fat / nuts' : c[0].toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <h2>{editingItem ? 'Nutrition' : 'Nutrition, as printed on the label'}</h2>
        {!editingItem && (
          <>
            <p className="hint">Enter exactly what the label says — don't adjust it yet. You'll set your real portion in the next step.</p>

            <div className="seg">
              <button className={form.entryMode === 'type' ? 'on' : ''} onClick={() => set('entryMode', 'type')}>Type it in</button>
              <button className={form.entryMode === 'paste' ? 'on' : ''} onClick={() => set('entryMode', 'paste')}>Paste label text</button>
            </div>

            {form.entryMode === 'paste' && (
              <div>
                <div className="field">
                  <label className="sr-only" htmlFor="i-paste">Label text</label>
                  <textarea
                    id="i-paste"
                    placeholder="On your phone: point the camera at the nutrition panel, tap the Live Text icon, select all the text, copy, and paste it here."
                    value={form.pasteText}
                    onChange={(e) => set('pasteText', e.target.value)}
                  />
                </div>
                <button className="btn-ghost btn-sm" onClick={readLabel}>Read the label</button>
                <p className="note">{form.parseResult}</p>
              </div>
            )}

            <div className="field">
              <label htmlFor="i-lblamt">Label serving size — amount &amp; unit</label>
              <div className="row">
                <input id="i-lblamt" type="number" inputMode="decimal" step="any" placeholder="100" value={form.labelAmount} onChange={(e) => set('labelAmount', e.target.value)} />
                <input placeholder="g" aria-label="Unit" value={form.labelUnit} onChange={(e) => set('labelUnit', e.target.value)} />
              </div>
            </div>
          </>
        )}
        <div className="row">
          <div className="field"><label htmlFor="i-cal">Calories</label>
            <input id="i-cal" type="number" inputMode="decimal" step="any" value={form.cal} onChange={(e) => set('cal', e.target.value)} /></div>
          <div className="field"><label htmlFor="i-pro">Protein (g)</label>
            <input id="i-pro" type="number" inputMode="decimal" step="any" value={form.pro} onChange={(e) => set('pro', e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="i-carb">Carbs (g)</label>
            <input id="i-carb" type="number" inputMode="decimal" step="any" value={form.carb} onChange={(e) => set('carb', e.target.value)} /></div>
          <div className="field"><label htmlFor="i-fat">Fat (g)</label>
            <input id="i-fat" type="number" inputMode="decimal" step="any" value={form.fat} onChange={(e) => set('fat', e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="i-fib">Fiber (g)</label>
          <input id="i-fib" type="number" inputMode="decimal" step="any" value={form.fib} onChange={(e) => set('fib', e.target.value)} /></div>
      </div>

      <div className="card">
        <h2>{editingItem ? 'Your serving' : 'How much do you actually eat?'}</h2>
        {!editingItem && (
          <p className="hint">The bit that quietly wrecks a library if you skip it. Labels are per 100g or per manufacturer serving; you eat one slice.</p>
        )}
        <div className="field">
          <label htmlFor="i-servlabel">Your serving, in words</label>
          <input id="i-servlabel" placeholder="1 slice" value={form.servingLabel} onChange={(e) => set('servingLabel', e.target.value)} />
        </div>
        {!editingItem && (
          <div className="field">
            <label htmlFor="i-myamt">…which is how much, in label units?</label>
            <div className="row">
              <input id="i-myamt" type="number" inputMode="decimal" step="any" placeholder="28" value={form.myAmount} onChange={(e) => set('myAmount', e.target.value)} />
              <input disabled placeholder="g" aria-label="Unit" value={form.labelUnit} style={{ opacity: 0.6 }} readOnly />
            </div>
          </div>
        )}
        <div className="prev">
          <div className="lab">One serving will be stored as</div>
          <div className="val">
            {form.servingLabel || '1 serving'}
            <div className="macros" style={{ marginTop: 5 }}>{macroLine(scaled)}</div>
            {!editingItem && Math.abs(ratio - 1) >= 0.001 && (
              <div className="macros" style={{ marginTop: 5 }}>Label values × {round1(ratio)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Details</h2>
        <div className="field">
          <label>Shows up at</label>
          <div className="chips">
            {SLOTS.map((s) => (
              <span key={s} className={`chip${form.mealSlots.has(s) ? ' on' : ''}`} data-slot={s} onClick={() => toggleSlot(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Pantry</label>
          <div className="chips">
            <span className={`chip${form.alwaysHave ? ' on' : ''}`} onClick={() => set('alwaysHave', !form.alwaysHave)}>
              I always have this
            </span>
          </div>
        </div>
      </div>

      <button className="btn" onClick={handleSave}>Save item</button>
      <button className="btn-ghost btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={onCancel}>Cancel</button>
      {editingItem && (
        <p className="note">
          Editing "{editingItem.name}". <a href="#" onClick={(e) => { e.preventDefault(); onDelete(editingItem.id); }}>Delete this item</a>
        </p>
      )}
    </section>
  );
}
