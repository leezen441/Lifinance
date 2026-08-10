# Lifinance

**Clear the debt. Keep the life.** · **ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้**

A personal finance app that plans the fastest realistic route out of debt — where
*realistic* means the plan is built from what you actually spend, not from what a
spreadsheet wishes you spent.

Thai / English, switchable anywhere in the app. Neon green on near-black, with a
light mode. Mobile-first, scaling to iPad and desktop.

```bash
npm install
npm run dev          # http://localhost:3000
```

Open Settings → **Load demo data** for a populated example (a Bangkok office
worker, ฿58k take-home, three debts, 60 days of spending).

---

## The idea

Most payoff calculators ask for your income and your debts and then tell you to
throw ฿20,000 a month at your credit card. You do it for six weeks, miss a coffee
too many, fall off, and never open the app again.

Lifinance inverts that. It measures what you actually spend, protects the part of
your life you said you wanted to keep, and only *then* reports what is genuinely
spare:

```
available extra = income
                − essentials            (measured, never squeezed)
                − lifestyle × keepRatio (the hobbies you're keeping)
                − goal contributions    (emergency fund first)
                − safety buffer         (% of income, for the unexpected)
                − minimum payments
```

That number feeds the payoff simulation. Log a ฿120 coffee and the payoff date
moves — visibly, immediately. The dial the user controls is `keepRatio`: *how
much of the fun am I willing to trade?* — and the dashboard shows the months
gained or lost as they drag it.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15** (App Router, React 19) | Static-exportable, instant route transitions, one deploy target |
| Language | **TypeScript** (strict) | The money math is the product; types are the first test |
| Styling | **Tailwind CSS v4** | Token-driven theming via `@theme`; dark/light from CSS vars only |
| Components | Hand-rolled, **shadcn-compatible** | Same `cn()` + variant conventions, no CLI or Radix weight for this surface |
| Icons | **lucide-react** | Consistent 1.5–2.5px stroke set |
| State | React Context + `localStorage` | Offline-first; no financial data leaves the device |
| Persistence (server) | **Prisma + Postgres** schema included | Models mirror the client types 1:1 — syncing is an insert, not a mapping layer |
| Tests | `node --test` | Zero test-framework dependency |

**Deliberately not used:** a charting library (four small SVGs beat 40 kB),
`next-intl` (a typed dictionary and a context is the whole requirement here), and
a state library (one store, no cross-tree writes).

### Commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run test:engine  # 20 tests over the debt + budget engines
```

---

## Architecture

```
src/
├─ lib/
│  ├─ debt-engine.ts     ← avalanche / snowball / auto simulation
│  ├─ budget-engine.ts   ← spend profile + realistic payment capacity
│  ├─ types.ts           ← shared shapes (mirror of the Prisma models)
│  ├─ date.ts            ← local-calendar-day helpers (never UTC)
│  ├─ format.ts          ← locale + currency formatting
│  └─ seed.ts            ← default categories + demo data
├─ i18n/
│  ├─ dictionaries.ts    ← full TH/EN dictionary, key-complete by type
│  └─ I18nProvider.tsx   ← t() + money() + date helpers bound to the language
├─ store/FinanceProvider.tsx  ← single source of truth, all derived values memoised
├─ components/
│  ├─ ui/                ← Card, Button, Progress/Ring/MilestoneBar, Field, Sheet, Toast
│  ├─ dashboard/         ← the eight dashboard cards
│  ├─ debts/ expenses/   ← entry sheets
│  └─ AppShell.tsx       ← sidebar ≥lg, top bar + bottom tabs <lg
└─ app/                  ← /, /debts, /expenses, /goals, /settings
prisma/schema.prisma     ← server-side schema
```

Every derived number — spend profile, budget, payoff plan, strategy comparison —
is computed once in `FinanceProvider` and memoised. A 200-month simulation runs
on data change, not on render.

---

## The debt engine

`simulatePayoff(debts, extraPerMonth, strategy)` steps month by month:

1. **Interest accrues** on each balance (`balance × apr / 12`) — you are charged
   before you pay.
2. **Every debt gets its minimum**, capped at its payoff amount.
3. **Everything left over** — the extra *plus* the minimums freed by
   already-cleared debts — goes to one target, cascading to the next debt the
   moment the target hits zero, within the same month.

Step 3 is the snowball *effect*, and it applies to both strategies. The only
difference between them is which debt is the target:

- **Avalanche** (`Cheapest`) — highest APR first. Provably the lowest total interest.
- **Snowball** (`Quickest wins`) — smallest balance first. Worse on paper, better
  on adherence, because the first debt disappearing is what keeps people going.
- **Auto** (`Smart pick`) — simulates both, prefers whichever *clears sooner*,
  breaking ties on cost.

Guards that matter:

- A payment that cannot cover the monthly interest is reported as
  `feasible: false` with a `shortfall`, up front — not discovered after looping
  for 60 simulated years.
- `extraNeededForTarget()` binary-searches the inverse question: *"debt-free in
  18 months — what does that cost per month?"*

### Why the budget engine is separate

The debt engine answers *how fast can this go*. The budget engine answers *what
can this person actually sustain*. Keeping them apart means the aggressive math
stays aggressive and the realism lives in one auditable place.

Two details that are easy to get wrong and are handled explicitly:

- **Recurring items count once per month.** Log rent twice inside a 60-day window
  and a naïve average doubles your rent.
- **Fixed bills are excluded from the pace check.** Comparing today's variable
  spending against a target that includes rent reads "on pace" every single day.

---

## Data model

Full schema in [`prisma/schema.prisma`](prisma/schema.prisma); the client types in
[`src/lib/types.ts`](src/lib/types.ts) mirror it exactly.

```
User ─┬─ UserSettings   language, theme, currency, monthlyIncome, payday,
      │                  strategy, lifestyleKeepRatio, safetyBufferPct,
      │                  spendWindowDays
      ├─ Debt[]         balance, principal, apr, minPayment, dueDay, archivedAt
      │    └─ Payment[] amount, paidOn, isExtra   ← reality, vs. the projection
      ├─ Category[]     key, group, emoji, isEssential, quickAmounts[]
      │    └─ Expense[] amount, date (@db.Date), recurrence, note
      └─ Goal[]         target, saved, deadline, monthlyContribution,
                        isEmergencyFund
```

Three decisions worth knowing about:

- **Money is `Decimal(14,2)`, never `Float`.** Binary floating point loses cents,
  and a debt tracker that loses cents is a debt tracker nobody trusts. The
  client uses `number` for the offline store; if you put real money through this,
  move to integer minor units at the same time you add the API.
- **`Expense.date` is a `Date`, not a timestamp.** An 11pm coffee in Bangkok
  belongs to that day, not to tomorrow in UTC.
- **Categories archive, they don't delete.** Deleting one would silently change
  every historical total that referenced it.

### Default categories

Opinionated on purpose — a tracker whose categories don't match your life is a
tracker you stop opening. Essentials are marked ✓ (never squeezed by the plan):

| Group | Categories |
| --- | --- |
| Essential living | Rent ✓, Utilities ✓, Groceries ✓, Phone & internet ✓, Insurance ✓ |
| Tech & subscriptions | AI tools, Cloud storage, Streaming, Apps & software |
| Food & beverage | Specialty coffee, Matcha, Eating out, Delivery, Snacks |
| Pet care | Cat food ✓, Pet supplies, Vet ✓ |
| Sports & hobbies | Badminton, Gym, DIY projects, Gear |
| Getting around | Fuel ✓, Transit ✓, Taxi / ride-hailing |
| Health & misc | Health ✓, Beauty, Gifts, Misc |

---

## Language support (TH / EN)

- Toggle sits in the header on **every** screen, plus Settings — language is not
  a setting you should have to hunt for.
- `en` is the source of truth. `th` is typed as `DeepStringMap<typeof en>`, so a
  **missing Thai key is a compile error**, not a runtime blank.
- Dates and money go through `Intl` per language. Thai is pinned to
  `th-TH-u-ca-gregory` — the default Thai calendar would show 2569 next to an
  English 2026, which is confusing mid-plan.
- Phrases are templated whole (`"{time} to go"` / `"เหลืออีก {time}"`) rather
  than concatenated in JSX, because Thai puts the "remaining" word *before* the
  duration.
- Thai gets a slightly taller line-height so tone marks stay readable, and the
  font stack includes Noto Sans Thai / Leelawadee UI.

---

## Design system

| Token | Dark | Light |
| --- | --- | --- |
| `--neon` | `#39FF14` | `#16A34A` |
| `--bg` | `#070A07` | `#F6F7F5` |
| `--surface` | `#101510` | `#FFFFFF` |

Pure `#39FF14` on white fails contrast badly, so light mode swaps in a darker
green — same role, same token name, so no component knows the difference.

Rules the UI follows:

- **Neon is a spotlight, not a paint.** One neon element per card, on the number
  that matters. The glow (`box-shadow`) is dark-mode only.
- **Numbers are tabular.** `font-variant-numeric: tabular-nums` everywhere money
  appears, so digits don't jitter as values change.
- **Progress moves.** Bars animate their width over 700ms — that motion *is* the
  reward loop.
- **No jargon.** "Debt-free on", not "amortisation term". "Must-pay living", not
  "fixed obligations".
- `prefers-reduced-motion` disables all of it.

### Responsive layout

| Breakpoint | Navigation | Dashboard |
| --- | --- | --- |
| base (375px+) | top bar + bottom tab bar | single column |
| `sm` (640px+) | same | same, roomier cards |
| `lg` (1024px+) | left sidebar | two columns — "what do I do" ‖ "how am I doing" |

Bottom tabs sit in thumb reach and respect `env(safe-area-inset-bottom)`. The
category row scrolls horizontally on phones and wraps into a grid from `sm`.
Verified with no horizontal page overflow at 360, 375, 768, 1280 and 1440px.

---

## What is deliberately not here

- **No accounts, no server, no analytics.** Everything is in `localStorage`; the
  export/import buttons in Settings are the whole sync story for now.
- **No bank connection.** Manual entry is the point — the two-tap log *is* the
  habit the plan depends on.
- **No investment advice.** The app plans payoffs and savings; it does not
  recommend products, and says so in Settings → About.

## Next steps if this goes further

1. Wire the Prisma schema to a real API and move money to integer minor units.
2. Record actual `Payment` rows and show projection-vs-reality drift — the most
   useful signal in the app, and the schema already supports it.
3. Push notifications on `dueDay` (the field exists and is unused).
4. PWA manifest + service worker; the app is already offline-capable in practice.
