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

On 24 November, the real Binance demo account passed the oversized-ticket rejection, explicit confirmation, post-only entry plus quantity-bound reduce-only stop, duplicate-confirmation, cancellation, and final empty-account checks. Both private and market WebSockets connected, and market messages arrived. Initial close-all stops were rejected by the demo exchange with `-4509` before an entry filled; entry stops now use explicit quantity and `reduceOnly=true`. Break-even replacement still uses close-all protection on an existing position. The outside-order watcher and confirmed reduce-only close also passed against a filled demo position. Deepgram transcription-to-confirmed-paper-lock and Claude review generation/persistence also passed with synthetic fixtures. Telegram commands, confirmation, repeated-lock handling, review, and browser pairing are also verified. Break-even replacement and live G2 microphone capture still need end-to-end verification.

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

Use the **repository root** for deployment. `Dockerfile` and `railway.json` are included. Set `HOST=0.0.0.0`, a strong `APP_TOKEN`, the HTTPS `APP_ORIGIN`, provider keys, and a persistent volume mounted at `/data`. One server instance owns the SQLite database and Telegram polling. The public repository is [dimka90/riskavue](https://github.com/dimka90/riskavue). Railway deployment still requires account login.

```bash
npm run configure:manifest   # writes APP_ORIGIN and matching WebSocket origin to app/app.json
npm run pack                # embeds APP_ORIGIN as the API origin and builds riskavue.ehpk
```

For direct Vite builds, `VITE_API_ORIGIN` can select an explicit backend; otherwise the app uses its current origin. `npm run pack` automatically embeds `APP_ORIGIN` so a packaged WebView connects to the server rather than looking for a local `/api`. The checked-in manifest targets local development. Set the real server origin and repackage before sideloading a deployed app. The browser UI and API are served from the same origin. Phone/G2 testing needs an accessible HTTPS deployment or a deliberately configured LAN origin; localhost on a phone is not this computer.

## Submission provenance

Implementation started during the hackathon on 24 November 2026. Open-source SDKs, libraries, and the official Even Hub minimal example existed before the event. The app/server implementation was written with AI assistance (Codex). The bridge setup follows the [official minimal example](https://github.com/even-realities/evenhub-templates/tree/main/minimal); no `cc-g2` or unlicensed competitor code was copied.

A captioned 71-second core walkthrough is available at `.artifacts/riskavue-core-demo.webm`. It records the official simulator framebuffer, labels paper scenarios, and distinguishes separately verified Binance execution from the simulator scenarios. Reproduce it with the simulator on port 9900: `SIMULATOR_URL=http://127.0.0.1:9900 npm run test:simulator`, then `npm run record:demo`. Install the encoder with `npx playwright install ffmpeg` if needed.

See `VERIFICATION.md` for precise evidence and remaining device/deployment checks. `SUBMISSION.md` contains the description, track, demo sequence, and submission checklist. The original product plan and research are retained in `PLAN.md` and `research/`.


## Additional checks

```bash
npm run fixture:voice
npm run test:providers
npm run test:binance-breakeven -- --execute-demo
TEST_URL=http://127.0.0.1:3002 npm run test:microphone
```

Provider checks use synthetic speech and a paper decision log. The break-even test uses a small, protected demo position, waits up to ten minutes for a valid market price, verifies that the replacement exists before removing the old stop, then closes the position and cleans up. A market timeout is not a passing replacement test. The microphone test opens Chrome and waits for you to hold the microphone button, say “lock me”, release, then confirm in a fresh paper session. It never starts recording automatically.
