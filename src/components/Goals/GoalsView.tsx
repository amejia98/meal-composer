import { useEffect, useState } from 'react';
import type { Goals } from '../../lib/types';
import { toast } from '../shared/toastBus';

export function GoalsView({ goals, onSave }: { goals: Goals; onSave: (g: Goals) => Promise<string | null> }) {
  const [form, setForm] = useState(goals);

  useEffect(() => { setForm(goals); }, [goals]);

  function set<K extends keyof Goals>(key: K, value: Goals[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    const error = await onSave(form);
    if (error) return toast(error);
    toast('Goals saved');
  }

  return (
    <section>
      <div className="card">
        <h2>Daily targets</h2>
        <div className="row">
          <div className="field"><label htmlFor="g-cal">Calories</label>
            <input id="g-cal" type="number" inputMode="decimal" step="any" value={form.calories} onChange={(e) => set('calories', parseFloat(e.target.value) || 0)} /></div>
          <div className="field"><label htmlFor="g-pro">Protein (g)</label>
            <input id="g-pro" type="number" inputMode="decimal" step="any" value={form.protein} onChange={(e) => set('protein', parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="g-carb">Carbs (g)</label>
            <input id="g-carb" type="number" inputMode="decimal" step="any" value={form.carbs} onChange={(e) => set('carbs', parseFloat(e.target.value) || 0)} /></div>
          <div className="field"><label htmlFor="g-fat">Fat (g)</label>
            <input id="g-fat" type="number" inputMode="decimal" step="any" value={form.fat} onChange={(e) => set('fat', parseFloat(e.target.value) || 0)} /></div>
        </div>
        <div className="field"><label htmlFor="g-fib">Fiber (g)</label>
          <input id="g-fib" type="number" inputMode="decimal" step="any" value={form.fiber} onChange={(e) => set('fiber', parseFloat(e.target.value) || 0)} /></div>
        <div className="field"><label htmlFor="g-floor">Protein floor per meal (g)</label>
          <input id="g-floor" type="number" inputMode="decimal" step="any" value={form.proteinFloorPerMeal} onChange={(e) => set('proteinFloorPerMeal', parseFloat(e.target.value) || 0)} /></div>
      </div>

      <div className="card">
        <h2>Why these numbers</h2>
        <p className="hint">The thing that ends "what are my goals again" — write it in plain language so future-you never has to re-derive it.</p>
        <div className="field">
          <label className="sr-only" htmlFor="g-rationale">Rationale</label>
          <textarea id="g-rationale" rows={10} value={form.rationale} onChange={(e) => set('rationale', e.target.value)} />
        </div>
      </div>

      <button className="btn" onClick={handleSave}>Save goals</button>
    </section>
  );
}
