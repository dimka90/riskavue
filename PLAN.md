# Riskavue: build plan

Read `README.md` first for the hackathon rules and why we chose this idea. This file covers **what we build, how, and in what order.**

## 0. Status (updated 24 Nov 2026)

**Where the project lives:** `~/glass/riskavue`, now its own Git repository. The owner selected `dimka90`; the public remote is https://github.com/dimka90/riskavue. The parent workspace remains separate.

**Name confirmed:** Riskavue (pronounced “risk-a-view”), combining risk and vue (view/sight). Tagline: **Your limits. In sight.** The owner approved the name on 24 Nov 2026. Domain and trademark availability have not been established.

**Done:**
- [x] Research: prop-firm rules, Even Hub SDK, Binance demo + Telegram + Deepgram (`research/`)
- [x] Idea, tracks, rivals and plan written (`README.md`, this file)
- [x] **Binance Demo Trading works from Nigeria**, so we stay on Binance (no Bybit fallback needed)
- [x] Binance demo API key created; the owner put `BINANCE_API_KEY` and `BINANCE_API_SECRET` in `~/glass/riskavue/.env`
- [x] `.gitignore` blocks `.env`, `.env.*` (except `.env.example`), `*.key` and `*.pem`; `.env` is locked to the owner (mode 600); `.env.example` lists the setting names

**Setup and authorization:**
- [x] Choose the new name: **Riskavue**; project folder renamed to `~/glass/riskavue`
- [ ] Telegram bot via @BotFather → `TELEGRAM_BOT_TOKEN` in `.env` (optional, can wait)
- [ ] Deepgram key → `DEEPGRAM_API_KEY` (optional, can wait)
- [ ] Choose the GitHub account (dimka90 or Yilkash)
- [x] The owner authorized building the full planned scope; no features deferred
- [x] Outside review (24 Nov) applied: honest guard-vs-watcher boundaries, locks cancel only entries and keep stops, risk from current price to stop, no-stop = unbounded, Topstep cap and touch-breach, verify each preset and disclose unresolved assumptions, reliability criteria R1–R5

**First build steps (implementation in progress):**
1. Copy the official starter into `~/glass/riskavue/app` (`npx degit even-realities/evenhub-templates/minimal app`) and upgrade to SDK 0.0.16, CLI 0.2.0, simulator 0.9.5. Show one line in the simulator; check a single tap works; take screenshots.
2. Write the rules engine in `~/glass/riskavue/server` (pure functions plus a unit test for every formula in §2).
3. Run a **read-only** Binance demo check: `GET /fapi/v3/account`, showing balance, equity and "$X to floor". **No orders.**

**Deadline: Sun 29 Nov 2026, 19:59 UTC.** Aim to submit by **Sun 12:00 UTC**, leaving buffer.


### Implementation checkpoint (24 Nov)

- [x] TypeScript/Vite companion app, actual Even Hub SDK bridge and 576 × 288 text views.
- [x] Node server, SQLite persistence, rule formulas, full preset selection with assumption labels.
- [x] Paper scenarios, pre-trade checks, expiring confirmations, pending-order cancellation, close, break-even stop, session locks and decision log.
- [x] Binance demo account, entry plus reduce-only stop, duplicate confirmation, cancellation and cleanup verified against the exchange. Private and market sockets connected; market events received. Scoped DNS recovery added. The outside-order watcher and filled-position reduce-only close also passed. Break-even replacement remains unverified on the exchange.
- [x] Telegram owner pairing/commands/buttons, Deepgram PCM transcription/voice commands, Claude review code; **Deepgram/Claude keys and synthetic provider checks passed; Telegram and live G2 microphone checks pending**.
- [x] Production build; regression suite and 2 browser flows passed. Regression tests cover R1–R5, partial-fill accounting, signed demo requests, DNS expiry/recovery, actual starting balance and stop replacement failures. Official simulator tap rejection and swipe navigation verified; screenshots captured with alpha preserved.
- [x] Railway/Docker configuration, configurable API origin and packaged `riskavue.ehpk` (local development origin; repackage for deployment).
- [x] Captioned core demo recorded from the official simulator (paper mode; verified Binance result separately identified).
- [ ] Complete remaining provider-backed tests, deployed verification, public repository and final submission video with provider flows.

---

## 1. What we learned from the research (one screen)

| Topic | Key fact | Effect on us | Source file |
|---|---|---|---|
| Prop-firm daily limit | Every firm computes it differently (balance vs equity, reset time, % of initial vs of day start) | Our "firm presets" are real value; traders often don't know their own formula | `research/01` |
| Breach timing | Almost all firms breach on **live equity** (incl. open P/L and fees), instantly | We must show live equity against the floor, not closed P/L | `research/01` |
| Pass rates | Topstep 2025: 16.8% of challenges pass (official). One aggregator: ~79% of failures are daily-loss breaches (original source not found) | Strong pitch numbers. Quote only the official one as fact. | `research/01` |
| Exchange | Big crypto prop firms run on **Bybit / BloFin / own terminals**, not the trader's own Binance account | Pitch as **"your rules + presets of real firms"**, not "connects to your prop firm" | `research/01` |
| Binance testnet | Use **USDⓈ-M Futures Demo Trading** (`https://demo-fapi.binance.com`, `wss://demo-fstream.binance.com`), HMAC keys from demo.binance.com | Leverage + positions, like prop trading | `research/03` |
| Binance stops (changed Dec 2025) | Stops now go to `POST /fapi/v1/algoOrder` (`algoType=CONDITIONAL`, `triggerPrice`). The old way returns `-4120`. No modify: place new, then cancel old. | Many tutorials are wrong; follow `research/03` | `research/03` |
| Binance region | Demo Trading is open only in some regions | **Day 1: check it works from Nigeria.** Fallbacks: Bybit testnet (also in our track) or Binance Spot testnet | `research/03` |
| Even Hub SDK | `@evenrealities/even_hub_sdk` 0.0.16, CLI 0.2.0, simulator 0.9.5. The template pins old versions, so upgrade. | Use the setup commands below | `research/02` |
| Display | Max 12 boxes, 4 images, one font, no emoji. ~400–500 characters on screen. Updates ~83 ms each; keep to a few per second. | Big simple numbers; update the meter at most ~2×/s | `research/02` |
| Input | Tap, double tap, swipe up/down, long press (+ release); the R1 ring sends the same events (`eventSource` 2) | **Double tap on the root page = system exit**, so never use it for confirm. Confirm = single tap. Lock override = long press. | `research/02` |
| Mic | Raw PCM 16 kHz, 16-bit mono, 100 ms chunks | Stream to our server → **Deepgram Nova-3** ($0.0048/min, accepts raw PCM; $200 free credit) | `research/02`, `03` |
| Telegram | grammY 1.48, long polling, inline Confirm/Cancel buttons; `callback_data` ≤ 64 bytes; check sender id | Fallback channel + Telegram prize | `research/03` |
| Wording | "No financial advice" (hackathon + Even Hub review) | Every warning quotes **the trader's own rule**, never says "you should" | `research/02` |
| Rivals | Six entries in the later screenshot; WickSight and Riskline also document trading actions. | Differentiate on account-wide rule checks and persistent locks; do not claim exclusive trading actions | `README.md` |
| Reference code | `wmoto-ai/cc-g2` (MIT) has tap/voice approve-deny dialogs; `fabioglimb/even-market` uses a Worker proxy (no licence, so ideas only) | Copy patterns from cc-g2 only (MIT); credit it in the README | `research/02` |

---

## 2. The product

### Who it's for
A trader doing a prop-firm challenge (or any trader with personal risk rules) who can't afford one heated minute. The pitch: **"Prop traders don't lose accounts on analysis. They lose them in one heated minute."**

### What Riskavue can and can't control (honest boundaries, from the 24 Nov review)

| Trade placed… | What Riskavue does | What it can't do |
|---|---|---|
| **Through Riskavue** (glasses, Telegram, or our trade ticket page) | **Real pre-trade guard:** the backend checks the trade against the rules **before** sending it to Binance. A trade that would break a rule is never sent. | n/a: this is full control |
| **Directly on Binance** (outside our app) | **Watches and reacts:** sees it via the user-data stream, warns, and offers to cancel what's still pending or close the position | **Can't stop it.** A market order or a fill can't be undone. If it's already filled, the screen says **"Already filled: −$X. Close position?"**, never "caught". |

- **Lock wording:** "**New trades through Riskavue are locked**", not "your account is locked." We can't disable a Binance account.
- **What a lock cancels:** only **exposure-increasing** orders (new entries, adds). It **keeps protective stops** while positions are open; removing a stop would increase risk.
- **Pitch wording:** "a guard for trades placed through it, plus a watcher for everything else." Don't claim "it stops you breaking rules on Binance."

### Rules engine (the heart of the app)
Let `B0` = initial balance, `eq` = equity = wallet balance + unrealized P/L − fees (on Binance futures: `totalMarginBalance`).

**Implement Custom plus all planned presets.** Check each firm's official page again (`research/01` lists gaps). Each preset says which comparison it uses: some firms breach on **touch** (`≤`), others on **below** (`<`).

| Rule | Formula |
|---|---|
| Daily floor, FTMO style | balance at day start − pct × B0 |
| Daily floor, HyroTrader style | equity at day start − pct × B0 |
| Daily floor, The5ers style | max(prev close balance, prev close equity) × (1 − pct) |
| Max floor, static | B0 × (1 − pctMax) |
| Max floor, end-of-day trailing (FTMO 1-Step) | max(B0, highest day-start balance) − pctMax × B0; never moves down |
| Max floor, Topstep (trailing **with cap**) | **min(start balance, highest end-of-day balance − MLL)**; never moves down; **stops rising at the start balance** |
| Active floor | max(daily floor, max floor) |
| Breach | `eq < floor`, or **`eq ≤ floor` for touch-breach firms (Topstep)**; set per preset |
| Warning | eq − floor ≤ buffer (default: 20% of the daily allowance) |

**Risk of a new trade (pre-trade check), from current equity:**

```
riskOpen     = Σ over open positions: qty × max(0, current price − stop) (longs; mirrored for shorts)
               → the EXTRA loss from now to each stop, not from entry
riskPending  = Σ over pending entry orders: qty × |entry − stop| + est. fees
riskNew      = qty × |entry − stop| + est. fees + est. slippage (e.g. 0.05% of notional, configurable)
worstCase    = eq − riskOpen − riskPending − riskNew
block if worstCase < floor + buffer (or ≤ for touch-breach presets)
```

- **Position or pending entry with NO stop:** risk is unbounded. Show **"No stop on BTC: risk unknown"** and **block new trades** until a stop exists. Never treat it as zero.
- **Tilt lock:** N losing trades since day start → cancel exposure-increasing orders (keep stops), lock new trades through Riskavue until the next day reset.
- **Max trades per day:** entries since day start ≥ limit → same lock.

**Lock principle (from trader requests):** a single tap confirms safe actions but **can never undo a lock.** Overriding a soft rule needs a long press **and** a spoken reason, which is logged. A hard lock (breach risk) can't be overridden in-session.

### Reliability acceptance criteria (must pass before any extra feature)

| # | Requirement | How we test it |
|---|---|---|
| R1 | **Stale data shows "Connection lost"**, never a reassuring old balance. If no fresh account/price data for >5 s, the big number is replaced. | Kill the stream in a test; the screen must change within 5 s |
| R2 | **Each action runs once.** Repeated taps or repeated Telegram callbacks for the same action ID execute once (persistent action IDs, like Till's request IDs). | Fire the same action twice concurrently; exactly one Binance call |
| R3 | **"Cancelled" or "Closed" appears only after Binance confirms** (order status from the API or the stream). Until then: "Cancelling…". On failure: say so. | Mock a Binance error; the screen must not say "Cancelled" |
| R4 | **Locks and daily baselines survive server restarts** (stored in SQLite, not memory). | Restart mid-lock; still locked, same day-start baseline |
| R5 | **Missing day-start data is disclosed, not guessed.** If the app starts mid-day with no stored baseline, it shows "Day start unknown: using equity at HH:MM (since app start)" and labels the floor as estimated. | Fresh DB at noon; the label must show |

### Screens on the glasses (576 × 288, text only)

1. **Session (home):** big line "**$190 to floor**", then "Daily: $310 / $500 · 2 trades left · resets 3h12m" and a small open-position line. Swipe down → positions list; swipe up → rules.
2. **Pre-trade check (trade placed through Riskavue, not sent yet):** "THIS TRADE CAN LOSE $240 / Your daily rule: max $500 / You have $190 left / NOT SENT. Tap = discard". Default action is the safe one.
2b. **Outside trade spotted (placed directly on Binance):** pending → "Order outside Riskavue: can lose $240 / Tap = cancel it"; already filled → "Already filled: −$X so far / Tap = close position". After the tap, the screen shows "Cancelling…" until Binance confirms (R3).
3. **Tilt lock:** "NEW TRADES LOCKED UNTIL 00:00 UTC / Your rule: stop after 2 losses / Entries cancelled · stops kept". Long press → "Say why" (only if the rule is soft).
0. **Connection lost (R1):** replaces the big number when data is stale: "CONNECTION LOST / last good: 14:32:05 / Don't trust this screen".
4. **Quick action:** "Price hit +1R / Move stop to break-even? / TAP = yes · swipe = no".
5. **End of day:** a 3-line Claude review: "Kept: daily limit, stops on every trade. Broke: 1 trade after lock warning. Worst minute: 14:32."

### Where trades come from in the demo
Two routes, shown honestly:
1. **Main route: trades go through Riskavue.** A small **trade ticket** (web page or Telegram `/buy 0.1 BTC stop 64000`, and a short voice phrase on the glasses) sends the order to **our backend**, which checks it **before** submitting to Binance. This is the real guard.
2. **Watcher route: trades placed directly on Binance.** Riskavue sees them through the user-data stream and reacts (cancel if still pending, offer to close if filled).

**Best demo move:** the trader enters a too-big trade on the ticket. The glasses show "THIS TRADE CAN LOSE $240… NOT SENT". One tap discards it; nothing ever reached Binance. Then, for honesty, a second clip: an order placed directly on Binance is spotted, and since it's a pending limit order, one tap cancels it, with "Cancelled" showing only after Binance confirms.

### Telegram (fallback + $1,000 prize)
- When the glasses app isn't open, the same warnings go to a Telegram bot with inline **Cancel order / Keep** buttons.
- Commands: `/status` (to floor, trades left), `/rules`, `/lock` (self-lock now), `/review` (Claude end-of-day).
- Pairing: the glasses app shows a 6-digit code; send it to the bot to link. This also solves sign-in, since Google sign-in doesn't work in the WebView.
- Only the paired Telegram user id can trigger actions.

### Voice
Long press → mic → Deepgram → short phrases only: "close all", "lock me", "why locked", "override: news spike". Never long dictation (judged on that).

---

## 3. Architecture

```
[G2 glasses] ⇄ BLE ⇄ [Even App WebView: our web app (Vite + TS + even_hub_sdk)]
                                   │ HTTPS + WebSocket (whitelisted origin)
                                   ▼
                     [Our server (Node 22 + TS)]
                      ├─ rules engine (pure functions, unit-tested)
                      ├─ Binance futures demo: REST (HMAC) + user-data stream + mark price
                      ├─ Telegram bot (grammY, long polling)
                      ├─ Deepgram (speech-to-text)
                      ├─ Claude (end-of-day review; text only, never trading advice)
                      └─ SQLite: rules, day-start snapshots, trade log, decisions log
```

- **Exchange adapter interface** (`getAccount`, `positions`, `placeOrder`, `cancel`, `placeStop`, `stream`) so Bybit testnet can replace Binance if the region check fails.
- Hosting: Railway, the same way as 10kobo (`railway.json` + deploy workflow). The web app is served by the same server, so it's one origin to whitelist.
- **Secrets, names only** (the owner fills `.env`; never commit it): `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_ID`, `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `PAIRING_SECRET`, `APP_ORIGIN`.

### Setup commands (from `research/02`, no global installs)
```bash
cd ~/glass/riskavue
npx degit even-realities/evenhub-templates/minimal app
cd app && npm install
npm install @evenrealities/even_hub_sdk@0.0.16
npm install -D @evenrealities/evenhub-cli@0.2.0 @evenrealities/evenhub-simulator@0.9.5
npm run dev                                   # terminal 1
npx evenhub-simulator http://localhost:5173   # terminal 2
# app.json: "min_sdk_version": "0.0.16"; network whitelist = our server origin
# package: npx evenhub pack app.json dist -o riskavue.ehpk --sdk-ver 0.0.16
```

---

## 4. Day-by-day

| Day | Goal | Done when |
|---|---|---|
| **Tue 24 Nov** | Research ✅. Owner: create Binance **demo** account + API key, Telegram bot (BotFather), Deepgram account. | Keys in `.env` (owner does this) |
| **Wed 25** | Scaffold app + server. Simulator shows one text line and a tap works. Binance demo: read account + positions (region check already passed). Rules engine with unit tests for every formula above, incl. the Topstep cap, touch-vs-below breach, risk from current price to stop, and "no stop = unbounded". SQLite for baselines and locks (R4, R5). | Simulator shows real "$X to floor" from the demo account; stale data shows "Connection lost" (R1) |
| **Thu 26** | Live stream (user data + mark price) → meter updates ~2×/s. **Trade ticket → backend pre-trade check → Binance** (the real guard). Watcher for outside orders (cancel pending, "already filled" honestly). Action IDs so each action runs once (R2); "Cancelled" only after Binance confirms (R3). Tilt lock + max trades (cancel entries, keep stops). Custom rules + one verified preset. | A too-big ticket trade is never sent; R1–R5 tests pass |
| **Fri 27** | Telegram bot (pairing, warnings, buttons, `/status`). Long-press voice (Deepgram). Move-stop-to-break-even action. Decisions log. | Same warning works on glasses and in Telegram |
| **Sat 28** | Claude end-of-day review. Polish screens (screenshots at each step). Deploy to Railway. README (setup, what existed before 23 Nov, AI disclosure, feature requests). | Works end to end from the deployed server |
| **Sun 29** | Record 3-min video (OBS or ffmpeg of the simulator window). Submit on DoraHacks by 12:00 UTC. | Submitted, with link checked |

**Scope decision (owner, 24 Nov): build the full planned feature set. No feature-cut list.** Implementation order prioritizes a tested core, then integration verification; it does not remove features.

---

## 5. Demo video script (≤ 3 min)

1. **0:00 Problem (20 s):** "Topstep's official numbers: 16.8% of challenges pass. Traders don't lose on analysis; they lose in one heated minute." Show a daily limit formula and how confusing it is.
2. **0:20 Setup (20 s):** pick "FTMO 2-Step $10k" preset. The glasses show "$500 to floor".
3. **0:40 Live (30 s):** a trade goes against you; the meter drops live: "$190 to floor".
4. **1:10 The catch (30 s):** enter a too-big trade on the ticket. The glasses show "THIS TRADE CAN LOSE $240… NOT SENT". One tap discards it; it never reached Binance. Quick follow-up: an order placed directly on Binance is spotted, and one tap cancels it, with "Cancelled" only after Binance confirms.
5. **1:40 Tilt (25 s):** a second loss triggers "NEW TRADES LOCKED UNTIL 00:00 UTC": entries cancelled, stops kept. A tap can't unlock it.
6. **2:05 Telegram (20 s):** take the glasses off; the same warning arrives in Telegram with buttons.
7. **2:25 Review + close (35 s):** Claude's 3-line end-of-day review. "Riskavue: your rules, held for you. Testnet only, no advice, no custody."

---

## 6. Submission checklist

- [ ] Public GitHub repo (**ask the owner which account first**), README with setup, track, "what existed before 23 Nov" (nothing but libraries; cc-g2 patterns credited), **AI-written code disclosure**
- [ ] Demo video ≤ 3 min
- [ ] Description: problem, who, how, track (**Exchanges & Stocks**, second: AI Assistants & Work)
- [ ] Feature requests (optional, up to 5), e.g.: Even Hub background alerts; ring-only input source flag on text events; Binance demo stop-modify endpoint
- [ ] Optional `.ehpk` build
- [ ] "How did you hear about this hackathon?": **Blockfuse Labs** (Community Partner Award)
- [ ] No secrets in git (`git log -p | grep -i key` check), `.env` gitignored

---

## 7. Ideas to make it better (ranked)

1. **"$X to floor" as the one big number.** This is the whole product in one glance. Everything else is secondary.
2. **Pre-trade catch before it hurts.** The strongest demo moment and the clearest "read and write".
3. **Locks that one tap can't undo.** Traders explicitly asked for non-overridable lockouts. It's the anti-tilt promise.
4. **Firm presets with the exact formula shown.** Traders lose accounts by not understanding their own limit. Show "Your daily floor = $9,500 (balance at 00:00 CET − 5% of $10,000)".
5. **Reset and news countdowns.** "Resets in 3h12m"; "CPI in 4 min: your firm bans trading ±2 min" (static calendar for the demo).
6. **Fees in the math.** Some traders lost by a few dollars to fees/slippage, so include an estimated fee in the pre-trade check.
7. **Decisions log + Claude review.** "Worst minute" and kept/broken rules. Useful for traders, and it shows the AI side.
8. **Later (pitch only):** a prop-firm B2B version that firms give their traders; Bybit/BloFin adapters; a hard "flatten at buffer" mode.

## 8. Risks

| Risk | Plan |
|---|---|
| Binance demo blocked in Nigeria | Check on day 1; switch adapter to Bybit testnet (also in our track) |
| Stop-move needs two `closePosition` stops at once (unverified) | Test on day 2; fallback: cancel old, then place new, with a short gap |
| Mark-price `/market` route on the demo host (unverified) | `research/03` §8 has a fallback URL |
| Ring vs temple can't be told apart on text events | Treat both the same; it doesn't matter for us |
| 4 parallel hackathons | This one is the shortest and most winnable; suggested dropping Celo |
| A rival ships a similar guard | Nothing like it on 24 Nov; our edge is locks + presets + Telegram |
