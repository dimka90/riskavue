# Riskavue

*Your limits. In sight.*

**A prop-firm rule guard on Even Realities G2 smart glasses.** It watches your trading rules during a live session, so one heated moment can't cost you a funded account.

The implementation is in `app/`, `server/`, and `shared/`. The full product scope remains in `PLAN.md`; provider research is in `research/`.

## Run locally

Requires Node.js **24.4+** (uses built-in SQLite).

```bash
git clone https://github.com/dimka90/riskavue.git
cd riskavue
npm ci
# Preserve your existing .env. If starting fresh: cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:5173**. Paper mode is the default and uses synthetic data only. The companion page includes a 576 × 288 text preview and clearly labelled scenario controls. Click **Load $190 scenario**, check a ticket with quantity `0.1`, limit `60000`, stop `57600`, and confirm the rejection. Use **Reset paper session** to clear the synthetic scenario.

```bash
npm run build
npm start                 # production app + API at http://127.0.0.1:3001
npm run simulate          # official Even Hub simulator (desktop required)
npm test                  # rules, persistence, action safety, fill accounting
npm run test:browser      # app must be running; Chrome expected at /usr/bin/google-chrome
```

To test the production app in the official simulator:

```bash
node node_modules/@evenrealities/evenhub-simulator/bin/index.js http://127.0.0.1:3001 --automation-port 9900
SIMULATOR_URL=http://127.0.0.1:9900 npm run test:simulator
```

Simulator tests deliberately run against **paper mode only**. Raw G2 screenshots use alpha for brightness: text and background both have green RGB values. The screenshot script preserves transparency and renders it over black for inspection.

## Integrations

Secrets stay in the server's `.env`; none are bundled into the web app.

| Integration | Configuration | Behavior |
|---|---|---|
| Binance Futures Demo | `BINANCE_API_KEY`, `BINANCE_API_SECRET` (also accepts `BINANCE_SECRET_KEY`), `EXCHANGE_MODE=binance` | Hard-coded demo hosts; one-way, single-asset accounts. REST reconciliation plus user and mark-price stream refreshes. |
| Telegram | `TELEGRAM_BOT_TOKEN`, **`TELEGRAM_OWNER_ID`** | Owner-only commands, five-minute pairing codes, confirmation buttons, matching action results. |
| Deepgram | `DEEPGRAM_API_KEY` | Hold to record 16 kHz mono PCM; release to transcribe with Nova-3. Audio is not persisted. |
| Claude | `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL` | Short review grounded in the decision log; no autonomous trade decisions. |
| Server access | `APP_TOKEN`, `APP_ORIGIN` | Token required outside localhost; origin checks, authenticated WebSocket, expiring paired sessions. |

Run `npm run check:binance` for a **read-only** account check. It never submits an order. The demo adapter uses bounded local DNS and, on failure, bounded Google/Cloudflare DNS queries, with DNS-over-HTTPS as a final fallback, for its two hard-coded demo hosts. Only public hostnames go to the resolvers; exchange credentials remain on the Binance connection. Answers expire according to TTL, HTTPS certificate verification stays enabled, and no system DNS configuration is changed. Slow or failed account reads still block trading.

On 24 November, the real Binance demo account passed the oversized-ticket rejection, explicit confirmation, post-only entry plus quantity-bound reduce-only stop, duplicate-confirmation, cancellation, and final empty-account checks. Both private and market WebSockets connected, and market messages arrived. Initial close-all stops were rejected by the demo exchange with `-4509` before an entry filled; entry stops now use explicit quantity and `reduceOnly=true`. Break-even replacement still uses close-all protection on an existing position. The outside-order watcher and confirmed reduce-only close also passed against a filled demo position. Deepgram transcription-to-confirmed-paper-lock and Claude review generation/persistence also passed with synthetic fixtures. Break-even replacement, live G2 microphone capture, and Telegram still need end-to-end verification.

```bash
npm run test:binance -- --execute-demo
# Separate filled-position watcher/close test, also demo only:
npm run test:binance-close -- --execute-demo
```

This opt-in integration test **places demo orders**, requires an empty demo account, keeps the entry below $200 notional, and reconciles/cancels its orders afterward. It writes sanitized receipts to `.artifacts/binance-verification.json`. Do not run it alongside manual trading. New Binance sessions initialize the default rule balance from the actual demo wallet; saved user rules are preserved.

Voice phrases: **“close all”**, **“lock me”**, **“why locked”**, **“move stop BTC”**, **“override: [reason]”**, or **“buy 0.01 BTC at 60000 stop 59000”**. All writes require a further tap. Hard locks cannot be overridden. A soft override preserves the audit counters and permits continuing until the next additional entry/loss triggers the rule again.

Telegram commands: `/status`, `/rules`, `/lock`, `/review`, `/pair CODE`, `/buy 0.01 BTC 60000 stop 59000`, and the corresponding `/sell`. Only the configured owner can complete pairing or run trading commands. Pairing is unnecessary for local paper use.

## Execution boundaries

- **Through Riskavue:** validated ticket, server-side risk check, expiring confirmation, fresh risk check, then demo order submission. Entries are post-only limit orders; crossing the market is rejected. One entry/position per symbol is supported. Protective-stop placement is a separate provider request; a failed stop triggers a cancellation attempt and an explicit uncertain result, never a protection guarantee.
- **Directly on Binance:** observe and react; cancel remaining pending quantity or offer to close an unprotected filled position. A filled trade cannot be undone. Locks cannot disable the Binance account.
- **Risk estimates:** current equity to stop, pending exposure, configured fees and slippage. Missing stops block new entries. Stops and buffers cannot guarantee realized loss in a gap.
- **Session history:** missing day-start balance is labelled estimated. Binance entry/loss counting begins at first connection; prior daily fills are not assumed known. Partial fills aggregate into position cycles, with fees included. Existing-position entry fees before connection are unknown.
- **Resilience:** locks, baselines, fill IDs, decisions and action IDs persist in SQLite. A dispatched action interrupted by a crash becomes `unknown` and is not automatically retried. Inspect the exchange before requesting another action. Stale data blocks writes and replaces the G2 balance.
- **Presets:** custom, FTMO 2-Step style, HyroTrader daily style, The5ers example tier, Topstep Combine style. Assumptions and official sources are visible in the code/UI. Confirm your account tier, maximum-loss type and reset zone. These are rule models, not firm integrations.

## Deployment and packaging

The root for deployment is **`riskavue/`**. `Dockerfile` and `railway.json` are included. Set `HOST=0.0.0.0`, a strong `APP_TOKEN`, the HTTPS `APP_ORIGIN`, provider keys, and a persistent volume mounted at `/data`. One server instance owns the SQLite database and Telegram polling. No public deployment or repository push has been performed.

```bash
npm run configure:manifest   # writes APP_ORIGIN and matching WebSocket origin to app/app.json
npm run pack                # embeds APP_ORIGIN as the API origin and builds riskavue.ehpk
```

For direct Vite builds, `VITE_API_ORIGIN` can select an explicit backend; otherwise the app uses its current origin. `npm run pack` automatically embeds `APP_ORIGIN` so a packaged WebView connects to the server rather than looking for a local `/api`. The checked-in manifest targets local development. Set the real server origin and repackage before sideloading a deployed app. The browser UI and API are served from the same origin. Phone/G2 testing needs an accessible HTTPS deployment or a deliberately configured LAN origin; localhost on a phone is not this computer.

## Submission provenance

Implementation started during the hackathon on 24 November 2026. Open-source SDKs, libraries, and the official Even Hub minimal example existed before the event. The app/server implementation was written with AI assistance (Codex). The bridge setup follows the [official minimal example](https://github.com/even-realities/evenhub-templates/tree/main/minimal); no `cc-g2` or unlicensed competitor code was copied.

A captioned 71-second core walkthrough is available at `.artifacts/riskavue-core-demo.webm`. It records the official simulator framebuffer, labels paper scenarios, and distinguishes separately verified Binance execution from unverified providers. Reproduce it with the simulator on port 9900: `SIMULATOR_URL=http://127.0.0.1:9900 npm run test:simulator`, then `npm run record:demo`. Install the encoder with `npx playwright install ffmpeg` if needed.

Still required for submission: Telegram checks, live G2 microphone verification, deployed verification, a public repository chosen by the owner, and a final recording including those provider flows. See `VERIFICATION.md` for precise evidence and remaining requirements. The original hackathon and product brief follows.

## The hackathon

| | |
|---|---|
| Name | Heads Up: Even Realities Hackathon by TVM Ventures & Daos Hub (DoraHacks) |
| Page | https://dorahacks.io/hackathon/even-realities/detail |
| Deadline | **Sun 29 Nov 2026, 19:59 UTC** (23:59 Dubai) |
| Judging | 30 Nov – 1 Dec; finalists announced |
| Demo Day | 3 Dec 2026, 14:00–18:00 Dubai (GMT+4), Daos Hub. **Remote demo allowed.** |
| Prize pool | $10,000 in USDT on TON (no KYC) + up to 10 pairs of G2 |
| Team | 1–4 people. Up to 2 projects, but they advise focusing on one. |

### Prizes

| Prize | Cash | G2 |
|---|---|---|
| Grand Prize | $2,000 | 2 pairs |
| 1st in each of 4 tracks | $1,250 | 1–2 pairs |
| 2nd in each of 4 tracks | $375 | |
| Best Telegram integration (any track) | $1,000 | |
| Community Partner Award | up to $500 | |

- A project wins **one** cash prize only (the highest it places for).
- **Community Partner Award:** the community with the most points wins (1 per participant with a valid submission and demo, +3 per finalist, +5 per winner; minimum 3 valid submissions). Each member names the community under "How did you hear about this hackathon?". **Idea: get 3+ Blockfuse Labs members to submit and write "Blockfuse Labs".**

### Judging criteria

1. **Usefulness on G2 · 30%.** A real everyday moment; works at a glance and hands-free.
2. **Read and write · 25%.** Fast action: a short phrase, one tap or the ring; smart defaults or AI drafts.
3. **Technical execution · 20%.** Works end to end, reliable, clean code.
4. **UX for display and voice · 15%.** Clear on a 576 × 288 monochrome display, natural by voice.
5. **Business potential and safety · 10%.** Real users and demand, careful with data and money.

Judges: Even Realities, TVM Ventures, partner VCs, sponsors, Daos Hub.

### Rules we must follow

- **Build during the hackathon** (from 23 Nov). Open-source libraries and existing APIs are fine. The README must say what existed before 23 Nov.
- Core integration must use the apps listed in our track (**Binance** for Exchanges & Stocks). Extra tools (LLM, speech-to-text) are fine on top.
- **Money safety:** testnet, paper trading or read-only data only. Don't hold user funds. No financial advice. **Never commit API keys or secrets.**
- Respect the services' terms and people's privacy.

### What to submit

- A public GitHub repo with a README that explains setup.
- A demo video, up to 3 minutes, in the simulator or on G2.
- A short description: the problem, who it's for, how it works, the track.
- Optional: up to 5 feature requests for the APIs we used.
- Optional: a packaged `.ehpk` build.

### Platform limits (from the brief)

- Display: monochrome green, 576 × 288 per eye. Input: microphone, touch on the glasses, R1 ring. No camera, no speaker.
- The app is a web app (HTML/CSS/TS) in a WebView inside the Even Realities phone app, talking to G2 over Bluetooth via the Even Hub SDK.
- **One app on screen at a time.** When the user switches away, our app can't show anything or pop alerts. (This is why we have a Telegram fallback.)
- No access to other apps' notifications. Call services through their APIs.
- Bring your own speech-to-text: the SDK gives raw mic audio.
- Use a backend: external calls must be whitelisted in `app.json` and pass CORS. **Never ship API keys inside the app.**
- Google sign-in doesn't work in the WebView. Use a pairing code or a separate login page.
- No glasses needed: the free Even Hub simulator works.

## Why this idea (the research so far, 24 Nov)

### Ideas we dropped, and why

| Idea | Why dropped |
|---|---|
| "Allow?": approve your AI agent from the glasses | **OcuClaw** (#2 trending on Even Hub) already does "approve actions right on your glasses" and alerts when an agent is stuck. |
| A brief before your next meeting | **IRIS** (#10 trending) already does "a brief before you meet someone". |
| Telegram inbox with AI replies | ~17 hackathon entries already, plus the popular **Messages** app in the catalogue. |
| A price ticker | 5 in the catalogue (ER Market, My Markets, Nexcore Markets, Market Dashboard, Market News) and 2 hackathon entries. |

### Competition by track (early snapshot; superseded by the later screenshot)

The later screenshot shows six Exchanges & Stocks entries: WickSight, Riskline, Binance Glance, TickGlance, Binance Session, and FUSE Session. The early table below is historical, not a current competitor count. [WickSight](https://github.com/artomily/wicksight) documents testnet trading actions; [Riskline](https://github.com/eliezercombi/riskline) documents position management and an optional testnet bridge. Riskavue's differentiation is account-level rule checks and persistent locks, not being the only app that acts. Features absent from a competitor's documentation are **not documented**, rather than proven absent.

| Track | Builds | What they are |
|---|---|---|
| Messaging & News | ~17 | Almost all "Telegram triage + AI reply". Kerbcue (one-tap claim of Telegram delivery jobs) is the only clearly different one. |
| Crypto & DeFi | 12 | Mostly tickers and Polymarket viewers |
| **Exchanges & Stocks** | **2** | TickGlance and Binance Session. **Both read-only price tickers.** |
| AI Assistants & Work | 4 | Only FixGuide AI (phone-repair helper) as its main track; 3 Telegram apps use it as a second track |

**Likely third rival in Exchanges & Stocks (not submitted yet):** `pikrimahardhika-alt/even-market-glance` ("Market Glance"), a read-only Coinbase BTC/ETH/SOL brief with a ±1% price marker. It has no orders, no rules and no accounts, so it's another ticker, built carefully. It has a public pre-hackathon prototype (made 20 Nov) and says it will rebuild during the event. Expect a polished, simulator-verified entry.

**Even Hub catalogue check:** searches for "stocks", "prop" and "risk" found **no app that guards trading rules**. All the market apps only show prices. (Search runs in the browser, so this was checked by hand in screenshots.)

## The idea

**The person:** a funded trader at a prop firm, a company that lends traders capital under strict rules. Break a rule once, for example losing more than the daily limit, and **the account is gone.** Most traders don't blow accounts on bad analysis. They blow them in a heated moment: chasing a loss, sizing up, skipping a stop.

**What the glasses show during a session (Binance testnet):**

| Moment | On the glasses | Action |
|---|---|---|
| Always | "Daily loss: $310 of $500 · 2 trades left" | Glance |
| Before a risky trade placed through Riskavue | "This trade can lose $240, which breaks your daily limit. NOT SENT." | One tap to discard (it never reaches Binance) |
| An order placed directly on Binance | Pending: "Can lose $240. Cancel it?" Already filled: "Already filled: −$X. Close position?" | One tap; "Cancelled" shows only after Binance confirms |
| After 2 losses in a row | "New trades through Riskavue locked. Entries cancelled, stops kept." | Locked until the daily reset; a soft rule can be overridden with a hold plus a spoken reason (logged) |
| Data goes stale | "CONNECTION LOST": the old balance is hidden | Glance |
| Quick safe action | "Move stop to break-even? Yes / No" | One tap |
| End of day | Claude's short review: rules kept and broken | Read |
| Glasses app closed | The same warning arrives by Telegram, with buttons | Tap in Telegram |

### Tracks

| | Track | Why |
|---|---|---|
| **Main** | **Exchanges & Stocks** | Built on Binance (testnet). Only 2 rivals, both tickers. The brief asks for "PnL, positions and price alerts during a trading session" and "Confirm quick actions like 'Move $500 from spot to margin? Yes / No'", which we do. |
| Second (optional) | AI Assistants & Work | Claude writes the end-of-day review |
| Any track | Best Telegram integration ($1,000) | Warnings and confirmations through a Telegram bot |

**Pitch line:** "Prop traders don't lose accounts on analysis. They lose them in one heated minute. Riskavue sits in your line of sight and holds the line for you."

**Business angle (for the VC judges):** prop firms could give it to their traders, since fewer blown accounts means happier customers. It also works for anyone with personal risk rules. It's the same idea as Till's spending limits, applied to a trader's own behaviour.

## The three services, in plain words

| Service | What it does for us | Required? |
|---|---|---|
| **Binance (Demo Trading, futures)** | Where the trades happen. Riskavue **watches** the trader's account and **acts** on it after a tap: cancels a risky order, closes a position, moves a stop. We use the **practice account with fake money** (the hackathon forbids real funds) and the **futures** version, because prop traders use leverage and open positions. Binance is on our track's approved app list. | **Yes.** If Binance demo doesn't open from Nigeria, switch to **Bybit's** test account (also on the approved list). |
| **Telegram bot** | 1) **Backup:** the glasses go blank when our app isn't open (platform rule), so the same warning arrives on the phone with Cancel / Keep buttons. 2) **A $1,000 prize** for the best Telegram integration, open to any track. 3) **Easy sign-in:** Google login doesn't work in the glasses app, so the glasses show a 6-digit code and you send it to the bot to link your account. | No, but it's cheap to build and is a second shot at a prize. On the cut list if time runs short. |
| **Deepgram** | **Turns speech into text.** The glasses' mic gives raw sound only; Deepgram turns "close all" or "lock me" into words. It takes the glasses' sound format directly, costs about $0.005/min, and new accounts get $200 free credit. Backup: OpenAI transcription. | No. Taps alone make a complete app. **First thing cut** if short on time, but voice earns points under "UX for display and voice" (15%). |

## Honest boundaries (from the 24 Nov review)

- Riskavue is a **real guard only for trades placed through it** (glasses, Telegram, trade ticket): it checks them before they reach Binance.
- For trades placed **directly on Binance**, it's a **watcher**: it can cancel what's still pending or offer to close a position, but it can't undo a fill.
- Locks say "**New trades through Riskavue are locked**". We can't disable a Binance account. Locks cancel only entries and **keep protective stops**.
- Full details and the reliability rules (R1–R5) are in `PLAN.md` §2.

## Accounts and safety notes

- GitHub account for this repo: **not decided yet.** Ask before creating or pushing.
- Secrets (Binance testnet keys, Telegram bot token, Claude key, speech-to-text key) go in `.env`, which the owner fills in. Never commit them. List only the setting names.
- README must disclose that AI wrote code.

## Files

- `PLAN.md`: build plan, day by day (written after the research).
- `research/01-prop-firm-rules.md`: how prop-firm rules work, real numbers, competitors, feature ideas.
- `research/02-even-hub-sdk.md`: Even Hub SDK, simulator, input events, limits.
- `research/03-binance-telegram.md`: Binance testnet API, live streams, Telegram bot, speech-to-text.

Provider verification: run `npm run fixture:voice`, then `npm run test:providers`. These make real provider API calls using synthetic speech and a paper decision log; no Binance trades are submitted.
