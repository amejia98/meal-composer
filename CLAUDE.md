# Working on Sous Chef

Read `docs/spec.md` before making design decisions. It's the source of truth for
what this app is and — more importantly — what it deliberately isn't. This file
covers how the code works.

## What this is

A meal *composer*: you pick the thing you actually feel like eating, and the app
helps you build a complete meal around it that lands on your nutrition targets.
Not a planner, not a tracker. Single user, built for one person's phone.

**Built so far:** the food library — add/edit food items and recipes, with
nutrition-label parsing and serving-size conversion.

**Not built yet:** the composer itself (spec §4), goals and targets (§9), Sunday
Prep (§10). The data model already has the fields these need; don't remove
fields that look unused (`pairsWith`, `lastEaten`, `Step.phase`) — they're load
bearing for features that aren't here yet.

## Architecture

Static site. **No build step, no framework, no dependencies in the app itself.**
Native ES modules, served as files. This is a deliberate choice: the app is
small, it must run offline on a phone, and a toolchain is a tax on a project
whose main risk is being abandoned. Don't add a bundler, and don't add React
unless the composer genuinely forces it.

```
index.html          markup only — zero inline JS
src/
  app.js            entry point: navigation, event wiring, boot
  state.js          state + localStorage persistence (with fallback)
  label.js          nutrition label parser — pure, no DOM
  items.js          add/edit food item screen
  recipes.js        add/edit recipe screen
  library.js        list, search, export/import
  styles.css        everything visual
scripts/dev.js      zero-dep static server, binds LAN for phone testing
test/
  label.test.js     unit tests for the parser (node --test)
  e2e.js            browser tests via Playwright
docs/spec.md        the design spec
```

## Conventions that matter

**No inline event handlers.** Module scope isn't global, so `onclick="foo()"`
silently does nothing. Every interaction is a `data-action="name"` attribute
handled by the single delegated listener in `app.js`. To add one: put the
attribute in the markup, add a case to `ACTIONS`. Delegation also means
dynamically rendered rows work without rebinding.

**The module graph stays acyclic.** `items.js` and `recipes.js` never import
`library.js` and vice versa. They communicate through the tiny event bus in
`util.js` (`emit`/`on`), routed by `app.js`. If you find yourself wanting a
cross import, emit an event instead.

**`esc()` everything that reaches `innerHTML`.** Food names are user input.

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
100g or per manufacturer serving; you eat one slice. `items.js` stores nutrition
*per your serving*, scaled by `myAmount / labelAmount`. When editing an existing
item the ratio is forced to 1:1 so a round-trip through the form can't
re-scale — there's a test pinning this. Break it and the library drifts wrong in
a way nobody notices for months.

**Recipe ingredient quantities are in servings of a food item, not grams.** That
sidesteps a unit-conversion layer entirely. If you ever need real weights, add a
grams-per-serving field to `FoodItem` rather than teaching `recipes.js` unit
math.

**`state.js` wraps every localStorage call.** Some sandboxed contexts throw on
access rather than returning null. The app degrades to session-only memory and
says so in the UI. Don't unwrap these.

## Running it

```bash
npm install        # only needed for tests; the app has no runtime deps
npm run dev        # http://localhost:5173 — also prints a LAN URL for your phone
npm test           # parser unit tests, fast
npm run test:e2e   # browser tests, needs the dev server (script starts one)
```

Add a parser test *before* fixing a parse bug. `test/label.test.js` is cheap to
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

- Add a build step or framework without a concrete reason the current setup fails
- Add fridge/inventory tracking (spec §11 explains why it's out)
- Turn the composer into a tracker — logging is a side effect of composing, never
  a chore the user performs
- Show more than three suggestions at a time (spec §3, principle 6)
- Use red/warning styling for going over budget (principle 5)
