import { useState } from 'react';
import { useFoodItems } from './hooks/useFoodItems';
import { useRecipes } from './hooks/useRecipes';
import { useGoals } from './hooks/useGoals';
import { LibraryView } from './components/Library/LibraryView';
import { ItemForm } from './components/ItemForm/ItemForm';
import { RecipeForm } from './components/RecipeForm/RecipeForm';
import { GoalsView } from './components/Goals/GoalsView';
import { NavBar } from './components/shared/NavBar';
import { Toast } from './components/shared/Toast';
import { toast } from './components/shared/toastBus';

export type View = 'lib' | 'item' | 'recipe' | 'goals';

const TITLES: Record<View, (editing: boolean) => string> = {
  lib: () => 'Your library',
  item: (editing) => (editing ? 'Edit item' : 'New food item'),
  recipe: () => 'New recipe',
  goals: () => 'Your goals',
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function App() {
  const foodItems = useFoodItems();
  const recipes = useRecipes();
  const goalsHook = useGoals();

  const [view, setView] = useState<View>('lib');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  function navigate(v: View) {
    setView(v);
    window.scrollTo(0, 0);
  }

  function openItem(id: string) {
    setEditingItemId(id);
    navigate('item');
  }

  function openRecipe(id: string) {
    setEditingRecipeId(id);
    navigate('recipe');
  }

  const editingItem = editingItemId ? foodItems.findItem(editingItemId) ?? null : null;
  const editingRecipe = editingRecipeId ? recipes.findRecipe(editingRecipeId) ?? null : null;

  const count = view === 'lib' ? `· ${plural(foodItems.items.length, 'item')}, ${plural(recipes.recipes.length, 'recipe')}` : '';

  return (
    <>
      <header>
        <h1>{TITLES[view](Boolean(editingItem))} <span id="count">{count}</span></h1>
      </header>

      <main>
        {view === 'lib' && (
          <LibraryView
            items={foodItems.items}
            recipes={recipes.recipes}
            onOpenItem={openItem}
            onOpenRecipe={openRecipe}
          />
        )}

        {view === 'item' && (
          <ItemForm
            editingItem={editingItem}
            onSave={async (item, isNew) => {
              const error = await foodItems.saveItem(item, isNew);
              if (!error) { setEditingItemId(null); navigate('lib'); }
              return error;
            }}
            onDelete={(id) => {
              const used = foodItems.recipesUsing(id, recipes.recipes);
              if (used.length) {
                toast(`Used in ${used.length} recipe${used.length > 1 ? 's' : ''} — remove it there first`);
                return;
              }
              foodItems.removeItem(id);
              setEditingItemId(null);
              navigate('lib');
              toast('Deleted');
            }}
            onCancel={() => { setEditingItemId(null); navigate('lib'); }}
          />
        )}

        {view === 'recipe' && (
          <RecipeForm
            items={foodItems.items}
            editingRecipe={editingRecipe}
            onSave={async (recipe, isNew) => {
              const error = await recipes.saveRecipe(recipe, isNew);
              if (!error) { setEditingRecipeId(null); navigate('lib'); }
              return error;
            }}
            onDelete={(id) => {
              recipes.removeRecipe(id);
              setEditingRecipeId(null);
              navigate('lib');
              toast('Deleted');
            }}
            onCancel={() => { setEditingRecipeId(null); navigate('lib'); }}
          />
        )}

        {view === 'goals' && (
          <GoalsView goals={goalsHook.goals} onSave={(g) => goalsHook.saveGoals(g)} />
        )}
      </main>

      <NavBar view={view} onNavigate={(v) => { if (v !== 'item') setEditingItemId(null); if (v !== 'recipe') setEditingRecipeId(null); navigate(v); }} />
      <Toast />
    </>
  );
}
