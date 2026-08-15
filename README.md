# Meal Composer

A meal composer. You pick the thing you actually feel like eating; it helps you
build a complete meal around it that hits your protein and fiber targets.

Right now it's the **food library builder** — the part where you catalogue the
60–80 things you actually eat, which is the foundation everything else needs.

## Running it

Requires Node 20+, and a Supabase project (see "Your data" below).

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Open http://localhost:5173.

To install it as an app: open it in Safari on your phone, tap Share → Add to
Home Screen. It runs full-screen with no browser chrome.

## Using it

**Food items** are single ingredients or standalone things — an egg, a slice of
queso panela, a banana. Three ways to add one:

- Type the numbers in
- Paste label text: on your phone, point the camera at the nutrition panel, tap
  the Live Text button, copy, and paste. Handles English and Spanish labels.
- (Later) photograph the label and have it read automatically

Whichever way, you then say **how much you actually eat** — the label says per
100g, you eat one slice — and it stores the right numbers for your portion. This
step matters more than it looks; skipping it is how a food library ends up
quietly wrong.

**Recipes** are built from food items. Quantities are in servings of that item,
and per-serving nutrition computes automatically. Tag steps as *make-ahead* or
*day-of* — Sunday prep will use that later.

## Your data

Synced via Supabase, so it follows you across devices — no login. This is a
personal single-user tool, so there's no account system; anyone with the
Supabase URL and anon key (both live in the client) could read or write the
data, same as anyone with the app's URL could use it. Treat the URL as
something you don't publish.

Run `docs/migration.sql` once in your Supabase project's SQL editor before
first use.

## Testing

```bash
npm test          # nutrition label parser
npm run test:e2e  # full browser tests
```

## Where this is going

`docs/spec.md` is the design document — the composer, nutrition targets, Sunday
meal prep, and the reasoning behind the decisions already baked in.

`CLAUDE.md` covers architecture and conventions for anyone (or anything) working
on the code.
