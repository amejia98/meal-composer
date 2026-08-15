import { useState } from 'react';
import type { FoodItem, Recipe } from '../../lib/types';
import { toast } from '../shared/toastBus';

type Tab = 'items' | 'recipes';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function ItemRow({ item, onOpen }: { item: FoodItem; onOpen: (id: string) => void }) {
  return (
    <div className="item" onClick={() => onOpen(item.id)}>
      <div>
        <div className="nm">
          {item.name}
          {!item.verified && <span className="tag unv">unverified</span>}
          {item.alwaysHave && <span className="tag">pantry</span>}
        </div>
        <div className="sub">{item.servingLabel} · {item.nutrition.protein}g protein · {item.nutrition.fiber}g fiber</div>
      </div>
      <div className="kcal">{item.nutrition.calories} cal</div>
    </div>
  );
}

function RecipeRow({ recipe, onOpen }: { recipe: Recipe; onOpen: (id: string) => void }) {
  const ahead = (recipe.steps ?? []).filter((s) => s.phase === 'make-ahead').length;
  return (
    <div className="item" onClick={() => onOpen(recipe.id)}>
      <div>
        <div className="nm">
          {recipe.name}
          {ahead > 0 && <span className="tag">{ahead} make-ahead</span>}
        </div>
        <div className="sub">
          {plural(recipe.servings, 'serving')} · {plural(recipe.ingredients.length, 'ingredient')} · {recipe.nutrition.protein}g protein
        </div>
      </div>
      <div className="kcal">{recipe.nutrition.calories} cal</div>
    </div>
  );
}

export function LibraryView({
  items, recipes, onOpenItem, onOpenRecipe, onImport,
}: {
  items: FoodItem[];
  recipes: Recipe[];
  onOpenItem: (id: string) => void;
  onOpenRecipe: (id: string) => void;
  onImport: (items: FoodItem[], recipes: Recipe[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('items');
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();

  const source = tab === 'items' ? items : recipes;
  const rows = source
    .filter((x) => x.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ items, recipes }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meal-composer-library.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup downloaded');
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.items) || !Array.isArray(parsed.recipes)) {
          throw new Error('bad shape');
        }
        await onImport(parsed.items, parsed.recipes);
        toast(`Imported — ${plural(parsed.items.length, 'item')}, ${plural(parsed.recipes.length, 'recipe')}`);
      } catch {
        toast("That file didn't look like a Meal Composer backup");
      }
    };
    reader.readAsText(file);
  }

  return (
    <section>
      <div className="seg">
        <button className={tab === 'items' ? 'on' : ''} onClick={() => setTab('items')}>Food items</button>
        <button className={tab === 'recipes' ? 'on' : ''} onClick={() => setTab('recipes')}>Recipes</button>
      </div>

      <div className="field">
        <label className="sr-only" htmlFor="search">Search</label>
        <input id="search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div>
        {rows.length === 0 ? (
          <div className="empty">
            {source.length
              ? `Nothing matches "${query}".`
              : tab === 'items'
                ? <>No food items yet.<br />Start with the five things you eat most weeks.</>
                : <>No recipes yet.<br />Recipes are built from food items, so add a few of those first.</>}
          </div>
        ) : tab === 'items' ? (
          (rows as FoodItem[]).map((i) => <ItemRow key={i.id} item={i} onOpen={onOpenItem} />)
        ) : (
          (rows as Recipe[]).map((r) => <RecipeRow key={r.id} recipe={r} onOpen={onOpenRecipe} />)
        )}
      </div>

      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn-ghost btn-sm" style={{ flex: 1 }} onClick={exportBackup}>Export backup</button>
        <label className="btn-ghost btn-sm" style={{ flex: 1, textAlign: 'center' }}>
          Import
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        </label>
      </div>
      <p className="note">Synced to your account via Supabase — no manual backup needed day to day, but export now and then anyway.</p>
    </section>
  );
}
