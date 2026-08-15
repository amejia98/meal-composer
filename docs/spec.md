# Meal Composer — Design Spec v0.2

*A meal composer for Alexis. Drafted August 2026.*

*v0.2 — added §7 (adding food items), moved barcode scanning from "not doing" to v2, rewrote §13 as an explicit web-vs-native decision.*

---

## 1. The problem

Not "I don't know how to cook." The actual failure happens in a narrow window:

> I need to eat something right now, I've forgotten what my goals even are, and I'm about to have the same conversation with an AI for the fifth time about what those goals should be and what I could make that fits them.

Three separate failures stacked on top of each other:

1. **Context loss.** The goals exist, but not at the moment of decision. They're in a chat log somewhere.
2. **Reconstruction tax.** Every decision starts from zero — re-explain the goals, re-derive the options, re-litigate the same tradeoffs.
3. **Blank-page overwhelm.** "What should I eat" is an unbounded question. Unbounded questions at 7pm when you're hungry produce takeout.

The app's job is to make all three go away. Most of its value is delivered before you tap anything — just by *remembering*.

---

## 2. What this is (and isn't)

**It's a meal composer.** You bring an anchor — the thing you actually feel like eating — and it helps you build a complete meal around it that lands on your targets.

It is **not**:

- **A meal planner.** Planners assign you Tuesday's dinner on Sunday and you resent them by Wednesday. The composer works in the present tense.
- **A tracker.** Trackers make you log after the fact — pure chore, payoff deferred. Here, *composing is logging*. You build the meal in the app because that's genuinely the easiest way to decide what to eat, and the log falls out for free. The app earns its data by being useful first.
- **A recipe app.** The recipe walkthrough is a feature, not the product.

---

## 3. Design principles

These are load-bearing. When a decision is unclear later, resolve it against these.

**1. The app is your memory, not your coach.**
It holds the goals, the numbers, the food you like, what you already ate today. You should never have to reconstruct context. Opening the app should feel like resuming, not starting.

**2. Never a blank page.**
Every screen opens with a proposal already on it. You're always editing a suggestion, never authoring from scratch. Editing is easy; authoring is what makes you order Thai food.

**3. Running budget, not per-meal quotas.**
One daily target set. The app always shows what's *left*, and composes against the remainder. If you fix breakfast at 40g protein you'll miss it once and feel like you failed before 9am. A light lunch should just mean a bigger dinner — self-correcting, no guilt loop.

**4. Your foods only.**
No infinite searchable database. A curated library of 60–80 things you actually eat. Small libraries produce better suggestions than large ones, because everything in them is already something you'd say yes to.

**5. It suggests, never forbids.**
No red warnings, no "you've exceeded." If you're over, it says so neutrally and moves on. The app should never make eating feel like failing an audit.

**6. Three options, not thirty.**
The suggestion list is short and ranked. Long lists recreate the overwhelm the app exists to eliminate.

---

## 4. The core loop

The whole product is five steps. Everything else is support.

### Step 1 — Open
The app knows the time. Before you do anything it says:

> **Lunch?**
> You've got **1,180 cal** and **96g protein** left today.

Time windows: breakfast until 11, lunch 11–4, dinner 4–9, snack outside that. Tappable to override — the guess should be right ~85% of the time and wrong cheaply.

### Step 2 — Anchor
You pick the thing you actually want. Not a full meal — the *centerpiece*.

The list is ranked, not alphabetical: recent favorites for this meal slot first, then things tagged for this slot, then everything else. A search box exists but should rarely be needed.

> You tap **Arepa with queso panela**.

### Step 3 — Gap
The app computes what's missing and states it in one line, plainly:

> **Arepa with queso panela** — 310 cal, 14g protein, 34g carbs, 2g fiber
> *Good start. You're light on protein — about 16g short for this meal, and no fruit or veg yet.*

### Step 4 — Fill
Three ranked additions, each with the reason it's being suggested:

> **+ 2 scrambled eggs** — +13g protein · pairs with what you picked
> **+ Greek yogurt (¾ cup)** — +17g protein, +fiber if you add berries
> **+ Black beans (½ cup)** — +7g protein, +7g fiber · already in the pantry

Tap to add, and the gap recomputes. Loop until you're satisfied or bored — the app never requires you to close the gap.

### Step 5 — Commit
One tap logs it. Daily budget updates. Done. If anything you picked is a recipe, this is where the walkthrough offers itself.

**Target interaction cost: four taps from opening the app to a decided meal.** If a change pushes past that, it's wrong.

---

## 5. Screens (v1)

| Screen | Purpose |
|---|---|
| **Today** | Home. Time-aware prompt, remaining budget, what you've eaten so far. The only screen you need most days. |
| **Compose** | The anchor-and-fill loop. Invoked from Today. |
| **Library** | Browse and edit your food items and recipes. |
| **Add item** | Create a new food item. Three entry paths, one form — see §7. |
| **Item detail** | Nutrition, tags, notes. For recipes: ingredients and steps. |
| **Goals** | Your targets and how they were derived. Editable. Rarely visited by design — but it's the thing that ends the "what are my goals again" problem, so it must be *visible*, not buried. |

**Deliberately absent in v1:** charts, streaks, weekly reports, social anything, photo logging of meals.

---

## 6. Data model

Getting this right now is what makes Sunday Prep (§10) cheap to add later instead of a rewrite. Two things in particular are here early *only* because of prep mode: ingredient quantities, and prep-phase tagging on steps.

```ts
type FoodItem = {
  id: string
  name: string                    // "Queso panela, 1 oz slice"
  category: 'protein' | 'carb' | 'fruit' | 'veg' | 'fat' | 'dairy' | 'condiment'
  servingLabel: string            // "1 slice (28g)" — human units, always
  nutrition: Nutrition            // per one serving as labeled
  mealSlots: MealSlot[]           // where this plausibly shows up
  pairsWith: string[]             // item ids — powers "pairs with what you picked"
  alwaysHave: boolean             // pantry staple vs. sometimes
  lastEaten?: Date                // drives variety scoring
  source: 'manual' | 'label-scan' | 'barcode'   // provenance — see §7
  barcode?: string                // if known, for re-scan matching
  verified: boolean               // has a human eyeballed these numbers?
}

type Nutrition = {
  calories: number
  protein: number                 // grams
  carbs: number
  fat: number
  fiber: number
}

type Recipe = {
  id: string
  name: string
  servings: number
  ingredients: { itemId: string; qty: number; unit: string }[]
  steps: Step[]
  activeMinutes: number
  totalMinutes: number
  nutrition: Nutrition            // per serving, computed from ingredients
  mealSlots: MealSlot[]
}

type Step = {
  text: string
  phase: 'make-ahead' | 'day-of'  // ← the hook Sunday Prep hangs on
  minutes?: number                // for timers in the walkthrough
}

type Meal = {
  id: string
  date: Date
  slot: MealSlot
  components: { refId: string; refType: 'item' | 'recipe'; servings: number }[]
  // nutrition is derived, never stored — always recomputes correctly
}

type Goals = {
  // profile, feeds the suggested-targets calculator
  age: number
  gender: 'male' | 'female'
  weightLb: number
  heightIn: number
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very-active'
  goalType: 'bulk' | 'maintain' | 'lean'
  // targets — editable, pre-filled by the calculator but not locked to it
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  proteinFloorPerMeal: number     // 20–40g, see §9
}
```

Two notes worth defending:

- **Meal nutrition is derived, never stored.** If you fix a bad entry in the library, every past meal silently corrects itself.
- **`source` and `verified` exist because auto-filled data is guilty until proven innocent.** An item scanned from a label and never reviewed should be visually marked as such, so when a number looks weird six weeks later you know whether to trust it.

---

## 7. Adding food items

The library is the foundation, so adding to it has to be genuinely pleasant. But the important architectural decision is this:

> **One form, three front doors.**

There is exactly one add-item form. Manual entry, label scanning, and barcode lookup are not three flows — they are three ways of *pre-filling the same fields*, all of which remain editable before you save. Build the form first; the other two are enhancements to its initial state. Get this wrong and you have three codepaths to maintain and three places for bugs to hide.

### The form

| Field | Notes |
|---|---|
| Name | Free text |
| Serving label | Human units — "1 slice," "¾ cup," "1 medium." Never grams-only. |
| Calories, protein, carbs, fat, fiber | Per one serving as labeled |
| Category | Single select |
| Meal slots | Multi-select, defaults guessed from category |
| Always have | Toggle |
| Pairs with | Optional, skippable — can be filled in later from usage |

Only the first three groups are required. Everything else has a sane default, because a form that demands eleven fields is a form you avoid.

### Path A — Manual

The baseline, and the fallback for everything else. Also the *only* path that works for the foods that matter most to you — an arepa you make yourself has no label and no barcode. Must be fast: sane defaults, numeric keypad, save in under thirty seconds.

### Path B — Photo of the nutrition label

Point the camera at the panel, and the numbers land in the form. This is the highest-value automation because it works on **any** packaged product regardless of whether some database has heard of it — including the imported and regional products where community databases reliably come up empty.

Two details that decide whether this feels good:

- **The serving-size conversion is the actual hard part**, not the OCR. Labels state values per 100g or per manufacturer-defined serving; you eat "one slice." The form must ask "how much do you actually eat?" and rescale. Skipping this produces a library that's quietly wrong in a way you won't notice for months.
- **Always land in the editable form, never save directly.** Set `source: 'label-scan'`, `verified: false` until you've looked at it.

### Path C — Barcode

Scan the code, look up the product, pre-fill the form. Genuinely useful for shelf-stable repeat purchases — protein powder, yogurt, tortillas — where you'll re-buy the identical item for years.

Worth being clear about the ceiling: **barcodes only exist on packaged food**, which is maybe a third of your library. And lookup coverage is the weak link, not the scanning. Open Food Facts is free and needs no API key, but coverage skews European and thins out on US regional and imported products. USDA's Branded Foods dataset has better US packaged coverage with its own gaps. Expect a meaningful miss rate, and make the failure graceful: no result simply drops you into Path B or A with the barcode already stored.

### Platform note

The effort here differs sharply by platform, and it cuts against the web-first recommendation in §13 — see there for the actual decision.

- **Native iOS.** Both paths are close to free. VisionKit's `DataScannerViewController` (iOS 16+) is a single component that recognizes text *and* barcodes from a live camera feed, and the Vision framework does on-device OCR at no per-scan cost, offline, with nothing leaving the phone. Roughly a weekend for both paths.
- **Web app.** Harder on both counts. Safari implements no barcode API — and since every iOS browser is WebKit underneath, that means no browser on your phone has one — so you need a WebAssembly decoder (ZBar or ZXing) driven off `getUserMedia`. That works fine, it's just more moving parts. OCR means shipping the image to a vision API: a per-scan cost, a network dependency, and your label photos leaving the device.

---

## 8. The suggestion engine

The only genuinely algorithmic part. Runs on every gap computation.

**Step 1 — Remaining budget.**
`remaining = dailyTarget − consumedToday`

**Step 2 — Expected share for this meal.**
`mealTarget = remaining / mealsLeftToday` (including the current one), with a floor: protein for this meal is never suggested below `proteinFloorPerMeal` (§9), because protein has a per-sitting effectiveness ceiling that calories don't.

**Step 3 — Score candidates.** For each library item not already in the meal:

```
score =
    3.0 × gapClosure(protein)     // protein is the binding constraint —
  + 1.5 × gapClosure(fiber)       //   weight it hardest
  + 1.0 × gapClosure(other macros)
  + 1.0 × pairingAffinity         // is it in pairsWith of a selected item?
  + 0.8 × slotFit                 // tagged for this meal slot?
  + 0.5 × varietyBonus            // haven't eaten it in 4+ days
  + 0.3 × alwaysHave              // no grocery trip required
  − 2.0 × calorieOvershoot        // penalize blowing the calorie budget
```

`gapClosure(x)` = how much of the remaining deficit in `x` this item closes, capped at 1.0 so a 60g-protein item doesn't outrank a 15g one when you only need 15g.

**Step 4 — Return the top 3,** each with a one-line human reason drawn from whichever term dominated its score. The reason string is not decoration — it's what makes the suggestion trustworthy instead of arbitrary.

Weights are starting values. Expect to tune them once you've used it for two weeks; the protein weight is the one most likely to need adjusting.

---

## 9. Setting your targets

Where the numbers come from, so they're never mysterious again.

**Your situation is genuinely a three-way stack:** building muscle, leaning out, *and* still recovering from surgery five months ago while ramping back into running. All three independently push protein up. They converge rather than conflict, which makes this simpler than it sounds.

**Protein.** Two literatures point at the same place:

- For muscle growth, the long-standard 1.6–2.2 g/kg range has been argued upward — a recent reanalysis puts the optimum near **2.0 g/kg**, with a plausible range of 1.7–2.35 g/kg.
- For post-orthopedic-surgery rehab, the recommendation is **at least 1.6 g/kg/day, up to 2.0–3.0 g/kg** during the rehabilitation period.

**Landing zone: ~2.0–2.2 g/kg of bodyweight.** The overlap of both ranges, and the top of neither — no need to go higher.

**Per-meal protein floor: 20–40g per sitting.** This is a real finding, not a rule of thumb — protein is used more effectively when distributed across the day in meaningful doses than when back-loaded into one big dinner. This is why `proteinFloorPerMeal` exists in the data model and why the suggestion engine weights protein at 3.0×. Practically: three meals at 40g beats one at 120g.

**Calories.** Mifflin-St Jeor for basal rate × an activity multiplier for your actual training, then set close to maintenance. For recomposition — gaining muscle while losing fat — a large deficit is counterproductive; it's the high protein plus resistance training doing the work, not the deficit.

**Fiber.** 14g per 1,000 calories is the standard reference. For most target ranges that lands around 30–38g/day.

**Carbs.** Not a fixed target — they flex around running. More on run days, especially before and after. The app can handle this as a "run day" toggle that widens the carb allowance rather than as a separate goal set.

### What I need from you to finalize

Bodyweight (the one number everything scales from), height, age, and roughly what your training week looks like now — lifting days, running days, how far into the ramp you are.

**One caveat worth stating plainly:** what kind of surgery it was actually matters here, and at five months out, if you still have a PT or surgeon in the loop, their read on the running progression should outrank anything I calculate. I can set the nutrition targets; the return-to-run timeline isn't mine to set.

---

## 10. Sunday Prep mode (v2 — designed for now, built later)

Not in v1, but the data model above already supports it, so it's additive rather than a rewrite.

**The flow:**

1. **Pick the week.** Multi-select recipes and items. The composer logic runs in reverse here — it can flag "this week is light on protein" *before* you shop.
2. **Master grocery list.** Union of all `ingredients` across selected recipes, aggregated by item and unit, with `alwaysHave` items filtered out (you already have them). Grouped by store section, because that's the order you actually walk.
3. **Prep sequence.** Filter every selected recipe's steps to `phase: 'make-ahead'`, then order them intelligently — marinades first since they need the most elapsed time, then things sharing an oven temp, then chopping. Output is a single ordered checklist for Sunday afternoon, not five separate recipes to interleave in your head.
4. **During the week**, a prepped component is just a library item with its prep already done. The composer doesn't need to know the difference.

Step 3 is the one with real value and real difficulty — a good prep sequence is a scheduling problem, not a list. Worth doing properly when we get there.

---

## 11. Scope

**v1 — the composer**
Today screen · anchor-and-fill loop · library CRUD · add-item form, manual entry · goals with rationale · daily budget tracking · recipes as items with ingredients and steps shown as plain text

**v1.5**
Photo-of-label scanning into the add-item form

**v2**
Barcode lookup · Sunday Prep · guided recipe walkthrough with timers · run-day carb flex · simple history

**Explicitly not doing**
Fridge/inventory tracking — it only works if you update it after every grocery run, and you won't. `alwaysHave` is the 80% version at 2% of the cost.
Also out: photo logging of meals, social features, streaks, macro charts.

---

## 12. Open questions

1. **Snacks** — first-class meal slot, or just "add to today" without a slot? Leaning the latter, simpler.
2. **Eating out** — every real week has meals you didn't compose. Does the app get a rough "ate out, ~800 cal" escape hatch so the daily budget stays honest? Probably yes; it's the difference between a tool you use for six weeks and one you use for a year.
3. **Partial servings** — half an arepa, 1.5 servings. Needs to be one tap, not a number pad.
4. **Overshoot behavior** — when you're over budget, what does the compose screen say? Must be neutral and non-punitive per principle 5, but still informative.

---

## 13. Build path: web or native

This is now a real decision rather than a default, because §7 changed the math.

**The case for web-first.** Nothing to pay, nothing to sign, no review process, no 7-day resigning. It runs in Safari, you add it to your home screen, and it looks and behaves like an app. You could be using v1 within days of the library existing. If it turns out you don't open it, you've lost a week instead of a year.

**The case for native.** Camera work is dramatically cheaper — one VisionKit component gets you both label scanning and barcodes, OCR runs on-device for free with no network round-trip, and it's private by construction. You also get real notifications, offline by default, and a genuinely native feel. Cost: $99/year for the developer program (or weekly rebuilds on a free account), Xcode, and Swift.

**Recommendation: still web-first, but with eyes open.** The camera advantage is real, but it accrues to v1.5 and v2 features — and it's an argument for building native *once you know you'll keep using this*, not before. The single highest-risk assumption in this entire document is that you'll actually open the app at 7pm when you're hungry and tired. Nothing about native makes that more likely. Test the assumption cheaply, then invest.

If you do end up going native, none of this document is wasted — the data model, suggestion engine, and target methodology are all platform-independent. Only §13 changes.

**Suggested order:**

1. Build the food library (§6) — 60–80 items, hand-curated, accurate. The unglamorous bottleneck, and the thing that makes everything after it easy.
2. Set the targets (§9) — needs your numbers.
3. Build the composer against the real library.
4. Use it for two weeks. Tune the suggestion weights. **Decide native here, with evidence.**
5. Label scanning, then Sunday Prep.
