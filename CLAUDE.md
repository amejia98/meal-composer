# Working on Meal Composer

Read `docs/spec.md` before making design decisions. It's the source of truth for
what this app is and — more importantly — what it deliberately isn't. This file
covers how the code works.

## What this is

A meal *composer*: you pick the thing you actually feel like eating, and the app
helps you build a complete meal around it that lands on your nutrition targets.
Not a planner, not a tracker. Single user, built for one person's phone.

**Built so far:** the food library (add/edit food items and recipes, with
nutrition-label parsing and serving-size conversion) and the Goals screen
(`src/goals.js`, spec §9).

**Not built yet:** the composer itself (spec §4), Sunday Prep (§10). The data
model already has the fields these need; don't remove fields that look unused
(`pairsWith`, `lastEaten`, `Step.phase`) — they're load bearing for features
that aren't here yet.

## Status (as of 2026-08-14)

**Alexis's numbers, for the Goals screen (spec §9):** 130 lb (59 kg), 5'5"
(165 cm), 28, female. Training: 3 zone-2 running days + 2–3 strength days/week,
4 months post-surgery and still under PT — the running progression itself is
PT's/surgeon's call, not this app's. Goal: lean recomposition, not aggressive
cutting. Current saved targets: 1,800 cal · 125g protein (35g/meal floor) ·
190g carbs · 60g fat · 26g fiber — derivation is in the `rationale` field on
the Goals screen itself, don't re-derive it from scratch.

**Design:** accent color is blue (`#2f8fe0` light / `#6fb8f5` dark), not the
original coral/terracotta — Alexis's explicit preference, tried coral first
and rejected it. Cream/warm-white background, kept light and cheerful on
purpose ("lighter and happier" was the ask that started the palette rework in
`src/styles.css`). Respects `prefers-color-scheme` for dark mode.

**Migration executed — moved off localStorage-only:** Alexis wanted real sync
across devices instead of manual export/import, using Supabase (already
familiar from the Spanish-tutor-business project), and asked for "most
conventional, actually usable, cool" — so the rewrite went to React + Vite +
TypeScript rather than bolting Supabase onto the old vanilla-JS files. This is
a deliberate, explicit departure from the old "no backend, no dependencies"
principle below (kept here for history, not as a current rule).

Status of the migration:
1. GitHub repo + Vercel deploy — **user-driven, pending**: create the repo,
   push, connect Vercel with auto-deploy from GitHub. Env vars needed on
   Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Supabase project — **user-driven, pending**: create the project, run
   `docs/migration.sql` in the SQL editor, enable the Email provider for
   magic-link auth, copy the Project URL + anon key into `.env.local` (see
   `.env.example`).
3. App code — **done**: React/Vite/TS app in `src/`, old vanilla app preserved
   in `src-legacy/` until parity is confirmed, then delete it.
4. One-time data import — **pending**, needs a live Supabase project first:
   `src/components/Migrate/MigrateFromLocalStorage.tsx` reads the old
   `localStorage['souschef.v1']` blob and imports it once Alexis is signed in
   on a real Supabase-backed session.

Neither Supabase nor Vercel credentials/projects exist yet — nothing has been
created on Alexis's behalf, per policy on account creation.

## Architecture

React + Vite + TypeScript, backed by Supabase (Postgres + auth). Single user,
magic-link email sign-in, RLS-scoped data. No router — four views, toggled by
local state, same as the old `.active`-class approach.

```
index.html          Vite entry shell
src/
  main.tsx          mounts <App/>, imports global CSS, dev-only test hook
  App.tsx           view switch (lib/item/recipe/goals), owns the data hooks
  lib/
    supabase.ts     Supabase client singleton
    label.ts        nutrition label parser — pure, no DOM (ported verbatim)
    nutrition.ts    serving-ratio scaling + recipe totals — pure, ported from items.js/recipes.js
    types.ts        FoodItem/Recipe/Step/Goals/Meal, mirrors spec §6
  hooks/            useAuth, useFoodItems, useRecipes, useGoals — plain hooks over Supabase, not React Query (dataset is tiny, a cache library is unjustified)
  components/       Library, ItemForm, RecipeForm, Goals, Auth, Migrate, shared
  styles/index.css  everything visual, ported from the old styles.css
src-legacy/         the retired vanilla-JS app — reference only, delete once the rewrite is confirmed to have full parity
docs/
  spec.md           the design spec
  migration.sql     Supabase schema — run once in the SQL editor
test/label.test.ts  unit tests for the parser (node --test)
e2e/app.spec.ts     browser tests via Playwright, needs a Supabase test account (E2E_TEST_EMAIL/PASSWORD env vars)
```

## Conventions that matter

**`App.tsx` owns the data hooks, screens are dumb.** `useFoodItems`/`useRecipes`/
`useGoals` are called once in `App.tsx` and passed down as props/callbacks —
this replaces the old event-bus pattern (`items.js`/`recipes.js`/`library.js`
talking through `emit`/`on` to stay acyclic). No event bus in the new code;
React's data flow makes it unnecessary.

**No React Query, no state-management library.** The whole dataset (~80 items,
a dozen recipes) fits in memory. Plain `useState`+`useEffect` hooks with a
`refresh()` after mutations is enough — don't reach for heavier machinery at
this scale.

**JSX escapes by default — no `dangerouslySetInnerHTML` anywhere.** The old
`esc()` helper doesn't have a new-code equivalent because it isn't needed;
don't reintroduce raw HTML injection.

**16px minimum font size on inputs.** Anything smaller makes iOS Safari zoom on
focus, which feels broken.

**Nutrition on `Meal` is derived, never stored.** Fixing a bad library entry
should silently correct every past meal. Same principle applies to the composer
when you build it.

## Things that will bite you

**`\w` doesn't match accented characters in JavaScript.** `/calor\w*/` fails on
"Calorías". The parser handles English and Spanish labels; spell endings out
explicitly rather than reaching for `\w`. There's a regression test for this.

**Parser pattern order is significant.** "Total Fat" must be tried before bare
"Fat", or the "Saturated Fat" line below it wins. Also tested.

**The parser returns `null`, never `0`, for values it can't find.** A `0` would
be indistinguishable from a label that genuinely says zero. Callers must clear
the form before applying results — otherwise a miss silently keeps the previous
product's number. This was a real bug.

**Serving-size conversion is the subtle part of the item form.** Labels are per
100g or per manufacturer serving; you eat one slice. `lib/nutrition.ts`
(`computeRatio`/`scaleNutrition`, called from `ItemForm.tsx`) stores nutrition
*per your serving*, scaled by `myAmount / labelAmount`. When editing an existing
item the ratio is forced to 1:1 so a round-trip through the form can't
re-scale — there's an e2e test pinning this. Break it and the library drifts
wrong in a way nobody notices for months.

**Recipe ingredient quantities are in servings of a food item, not grams.** That
sidesteps a unit-conversion layer entirely. If you ever need real weights, add a
grams-per-serving field to `FoodItem` rather than teaching `lib/nutrition.ts`
unit math.

**Data lives in Supabase now, not localStorage.** `hooks/useFoodItems.ts` /
`useRecipes.ts` / `useGoals.ts` are async and RLS-scoped to the signed-in user
— there's no offline fallback like the old `state.js` had. `src-legacy/state.js`
is kept only for reference on the old localStorage-wrapping pattern.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev         # http://localhost:5173
npm test            # parser unit tests, fast, no Supabase needed
npm run test:e2e    # browser tests, needs a live Supabase project + E2E_TEST_EMAIL/PASSWORD
```

Add a parser test *before* fixing a parse bug. `test/label.test.ts` is cheap to
extend because the parser is pure — keep it that way.

## When you add the label-photo feature

Spec §7 Path B. This is the first thing that needs a backend, because a vision
API key can't live in client-side code. Two notes:

- iOS won't grant camera access over plain http from a non-localhost origin.
  Testing on a phone against the dev server will need https — a tunnel
  (cloudflared, ngrok) or mkcert.
- Auto-filled values must land in the editable form with `verified: false`, not
  save directly. The UI already flags unverified rows.

## Don't

- Add fridge/inventory tracking (spec §11 explains why it's out)
- Turn the composer into a tracker — logging is a side effect of composing, never
  a chore the user performs
- Show more than three suggestions at a time (spec §3, principle 6)
- Use red/warning styling for going over budget (principle 5)
