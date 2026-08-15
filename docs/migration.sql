-- Meal Composer schema. No auth — this is a personal, single-user app and
-- the anon key is used directly. RLS is enabled with permissive policies
-- (protection is the obscurity of the Supabase URL + anon key, not a login).
-- Paste this into the Supabase SQL editor (Project → SQL Editor → New
-- query) and run it once, after creating the project.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ------------------------------------------------------------- food_items
create table food_items (
  id uuid primary key default gen_random_uuid(),
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
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

-- ------------------------------------------------------------------ goals
-- Singleton row — the app always reads/writes the one row with this fixed id.
-- Profile fields (age/gender/weight/height/activity/goal type) feed the
-- suggested-targets calculator in src/lib/targets.ts; calories/protein/etc
-- are editable and may diverge from what the calculator would currently
-- suggest for the same profile.
create table goals (
  id text primary key default 'singleton',
  age integer not null,
  gender text not null check (gender in ('male','female')),
  weight_lb numeric not null,
  height_in numeric not null,
  activity_level text not null check (activity_level in ('sedentary','light','moderate','very-active')),
  goal_type text not null check (goal_type in ('bulk','maintain','lean')),
  calories numeric not null,
  protein numeric not null,
  carbs numeric not null,
  fat numeric not null,
  fiber numeric not null,
  protein_floor_per_meal numeric not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- meals
-- Not built yet (composer UI is out of scope for this migration), included
-- per spec §6 so the table exists ahead of that feature. Nutrition
-- intentionally NOT a column — always derived from components at read time.
create table meals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner','snack')),
  components jsonb not null default '[]',  -- [{refId, refType, servings}]
  created_at timestamptz not null default now()
);

create index meals_date_idx on meals(date);

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
-- Enabled with fully permissive policies — no login, so there's no auth.uid()
-- to scope by. The anon key + RLS-enabled-but-open combination is Supabase's
-- documented pattern for "no auth, but still go through RLS" rather than
-- disabling RLS outright.
alter table food_items enable row level security;
alter table recipes    enable row level security;
alter table goals      enable row level security;
alter table meals      enable row level security;

create policy "public food_items" on food_items for all using (true) with check (true);
create policy "public recipes"    on recipes    for all using (true) with check (true);
create policy "public goals"      on goals      for all using (true) with check (true);
create policy "public meals"      on meals      for all using (true) with check (true);
