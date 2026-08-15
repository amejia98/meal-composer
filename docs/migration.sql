-- Meal Composer schema. Single-user app; every table scoped to auth.uid()
-- via RLS. Paste this into the Supabase SQL editor (Project → SQL Editor →
-- New query) and run it once, after creating the project and before first
-- sign-in.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------- food_items
create table food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  category text not null check (category in
    ('protein','carb','fruit','veg','fat','dairy','condiment')),
  serving_label text not null,
  -- nutrition, per one serving as labeled
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber numeric not null,
  -- label basis (how the serving was derived from the printed label)
  label_amount numeric,
  label_unit text,
  label_my_amount numeric,
  meal_slots text[] not null default '{}',       -- MealSlot[]
  pairs_with uuid[] not null default '{}',        -- FoodItem.pairsWith, unused today, kept for a future feature
  always_have boolean not null default false,
  last_eaten date,                                -- FoodItem.lastEaten, unused today, kept
  source text not null check (source in ('manual','label-scan','barcode')),
  barcode text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_items_user_id_idx on food_items(user_id);

-- ---------------------------------------------------------------- recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  servings integer not null default 4,
  ingredients jsonb not null default '[]',   -- [{itemId, qty, unit}]
  steps jsonb not null default '[]',         -- [{text, phase, minutes?}]
  active_minutes integer,
  total_minutes integer,
  -- nutrition snapshot per serving, computed at save time (NOT derived live —
  -- unlike meals.nutrition, this one is a stored snapshot)
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber numeric not null,
  meal_slots text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_user_id_idx on recipes(user_id);

-- ------------------------------------------------------------------ goals
create table goals (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber numeric not null,
  protein_floor_per_meal numeric not null,
  rationale text not null default '',
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- meals
-- Not built yet (composer UI is out of scope for this migration), included
-- per spec §6 so the table exists ahead of that feature. Nutrition
-- intentionally NOT a column — always derived from components at read time.
create table meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  components jsonb not null default '[]',  -- [{refId, refType, servings}]
  created_at timestamptz not null default now()
);

create index meals_user_id_date_idx on meals(user_id, date);

-- --------------------------------------------------------------- updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger food_items_updated_at before update on food_items
  for each row execute function set_updated_at();
create trigger recipes_updated_at before update on recipes
  for each row execute function set_updated_at();
create trigger goals_updated_at before update on goals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------- RLS
alter table food_items enable row level security;
alter table recipes    enable row level security;
alter table goals      enable row level security;
alter table meals      enable row level security;

create policy "own food_items" on food_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recipes" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own goals" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own meals" on meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
