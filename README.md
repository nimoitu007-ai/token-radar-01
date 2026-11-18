# Token Radar — model radar-2

Entry for make.fun bounty **token-radar-01** — "Build the best token launch
radar" ($1,325, ends 2026-12-14 10:00 UTC). Built fresh for Dwii
(@dwii06, GitHub nimoitu007-ai) from the official kit's sealed snapshot.
No other entrant's work was copied; the starter was used only as the
reference for the gate's shape.

## What it does

`main.ts` (Node 22, standard library only, no network) reads the sealed
DefiLlama snapshot at `/input/snapshot.json`, scores every pre-token
protocol, and writes:

- `board.json` — 226 rows: all 40 watchlist protocols plus all 186
  rankable pre-token protocols below the $50M floor (9 more below the
  floor are versioned pools, so they are not rankable). Each row carries an
  implied value, a risk score, a confidence level and a 7-step farm plan.
- `data.js` + `dashboard/` — a static, offline dashboard: sortable board,
  search, category and chain filters, watchlist-only toggle, pagination,
  a detail view for every protocol, and a separate live-token view.
- `screenshots/` — board, detail view, filtered view (1440x900).
- `dossier.json` — built with the kit's `vendor/makefun-board.ts`.

## The model (radar-2)

One function scores every row; no protocol name is special-cased:

```
implied = round( tvl_usd x 0.25
  x (1 + clamp(change_7d, -60, 120) / 100 x 0.5)
  x (0.6 + min(age_days, 1095) / 1095 x 0.4)
  x (1 + 0.03 x min(chains - 1, 10)) )
```

- **TVL** is the value already trusted to the protocol.
- **Seven-day growth** is the only momentum the snapshot carries, clamped
  so one hot week cannot dominate.
- **Maturity** is how long the protocol has run with no token, with
  diminishing returns past three years; an unlisted age uses 365 days.
- **Chain spread** rewards TVL spread across chains (up to +30%):
  multi-chain TVL is stickier than single-chain TVL.

**Risk (5–95)** is shown beside the value, never inside it: single chain
+15, young or unlisted age +10, falling week +10, TVL under $100M +10,
missing growth reading +5. **Confidence** is high when growth and age are
both reported, medium when one is, low when neither is.

A protocol "records no token" in this snapshot — that is not proof it has
none. Implied value is this board's own claim, never a price.

## Farm plans

Seven steps per protocol, derived from its own category, chains, TVL and
age: a fresh wallet, the category's main action with a capital tier
($50 / $100 / $150 / $250 by TVL), a category-specific weekly action, a
hold of 30–60 days, a weekly points-page check, a claim-safety check
(never pay to claim, never follow a claim link from a DM), and a farm log
with a one-transaction unwind. Every step states its cost and its time.

## How to run

```sh
node --version   # 22.18 or later (24 works too)
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-kit>/input/snapshot.json
```

The program runs twice in grading and both runs must write the same
bytes; it is deterministic (sorted by implied value, slug tie-break).

Check the output the same way the gate does (a local checker is in
`tools/check-gate.mjs`):

```sh
node tools/check-gate.mjs out
```

Then open the dashboard offline and retake screenshots (1440x900):

```sh
node tools/shoot.mjs out
# board: .../index.html
# detail:  .../index.html#p=steakhouse-financial
# filtered: .../index.html#category=Risk%20Curators
# then re-run main.ts so dossier.json matches the new screenshots
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-kit>/input/snapshot.json
```

## Live data note

In production the same model would read a fresh DefiLlama protocol
index (`api.llama.fi/protocols`) and re-score on the same formula; the
graded program reads only the sealed snapshot and makes no network calls.

## Submit (Dwii only — not done yet)

1. Create a public GitHub repo under **nimoitu007-ai**, created after the
   competition opened (2026-11-14), MIT license, with these files at the
   root (`main.ts`, `lib/`, `vendor/`, `dashboard/`, `screenshots/`,
   `.makefun/owner.json` naming payout wallet
   `9RhbHNPNhQT8a2ypuMMYmAgqWLTatR4W8ntovaeyPFi4`).
2. Commit, note the full 40-character commit SHA.
3. From the unpacked kit: `node cli/makefun.mjs bundle` (transcripts),
   then `node cli/makefun.mjs submit --repo <repo> --commit <sha>`.
4. At most 5 submissions a day, 10 in all; the last submission before the
   deadline is the final entry.
