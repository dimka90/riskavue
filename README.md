# Riskavue

It's 14:32. Tunde has $40 left before his prop firm's daily loss limit. One revenge trade and the funded account is gone.

*Illustrative persona, not a customer testimonial or a claim about every firm's rules.*

**Other G2 trading apps show your risk. Riskavue enforces your rules.**

Riskavue checks the whole account against the trader's configured limits before sending a trade placed through its glasses controls, Telegram bot, or browser ticket. A glance shows the remaining loss allowance; a tap confirms an allowed action. It is a guard for its own entries and a watcher for trades sent directly to Binance.

## Start here: the 60-second judge path

Open `/judge` on a server running this revision (locally: `http://127.0.0.1:3001/judge`). No token or secrets are required. The existing private trading companion is at https://riskavue.up.railway.app; its private APIs require authentication.

1. Load the **$190 paper scenario**. This is separate from Tunde's illustrative $40 story.
2. Check the oversized ticket. Expect **NOT SENT**, with zero paper orders.
3. Tap **Discard**. No order should appear.
4. Trigger two synthetic losses, then tap to try another trade. Expect **STILL LOCKED**.
5. Show the Telegram `/status` preview and the three-line review.
6. Scroll to **Proof that could have failed** for timestamped Binance Demo receipts.

For a local judge-only review, build then start a separate paper process (choose an unused port):

```bash
npm run build
EXCHANGE_MODE=paper HOST=127.0.0.1 PORT=3007 DATA_DIR=/tmp/riskavue-judge-review TELEGRAM_BOT_TOKEN= DEEPGRAM_API_KEY= ANTHROPIC_API_KEY= npm start
# Open http://127.0.0.1:3007/judge; no access token is needed for the judge route.
```

This explicitly disables a second Telegram poller even if your private `.env` contains its token.

The judge route uses the real Service/rule engine with a separate in-memory Paper adapter for each walkthrough. It never receives the live service or credentials, never calls Binance, Telegram or AI, and cannot change the owner's account. The review is a deterministic paper summary, labelled as such; the status uses the same formatter as Telegram. Sessions expire after ten idle minutes and are capacity-limited. It is a browser walkthrough, not footage from physical glasses.

## Evidence, not invented market statistics

Topstep's official 2025 disclosure says **16.8% of initiated Trading Combines completed successfully**. That denominator is Combines, not individual participants; it does not establish failure causes or Riskavue's effectiveness. [Official Topstep disclosure](https://www.topstep.com/social-media-disclosure), checked 25 November 2026. No claim that 79% of failures are daily-loss breaches is used.

## Recorded exchange proof

These are earlier **Binance Futures Demo** runs, not real-money trades and not results of the public paper walkthrough.

| UTC timestamp | Recorded outcome |
|---|---|
| 2026-11-24 20:59:41.152 | Oversized ticket rejected; 0 exchange orders |
| 2026-11-24 20:59:45.221 | Allowed ticket awaited confirmation |
| 2026-11-24 20:59:53.184 | Entry #28694211519 and protective stop accepted |
| 2026-11-24 20:59:54.819 | Repeated confirmation did not duplicate the order |
| 2026-11-24 21:00:00.972 | Cancellation confirmed |
| 2026-11-24 21:00:05.828 | Account clean: 0 positions, 0 orders |
| 2026-11-24 21:14:01.029 | Outside demo fixture #28694222135 filled |
| 2026-11-24 21:14:03.727 | Watcher honestly reported “already filled” |
| 2026-11-24 21:14:08.109 | Confirmed reduce-only close filled |
| 2026-11-24 21:14:13.689 | Account clean again: 0 positions, 0 orders |

Source receipts: `.artifacts/binance-verification.json` and `.artifacts/binance-close-verification.json`. `node --import tsx scripts/build-proof.ts` creates the allowlisted, secret-free `app/src/proof.json` used by `/judge#proof`, with SHA-256 source hashes. Raw provider strings and account identifiers are not copied. These receipts are recorded test evidence, not an independent audit. Production builds use the checked-in sanitized snapshot and do not need private artifact files.

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

## Silent controls on G2

Voice is optional. Tap from a session view to open Actions, swipe up/down to choose, then tap to select. Back returns to the parent menu; Back to session closes it. Trades and account changes require a separate confirmation, and swiping dismisses a pending confirmation.

The menu includes session locking and lock details, new trade entry, position closing, break-even stops, pending-entry cancellation, close-all, session review, and rule viewing. New trades use a digit editor: swipe to change the highlighted digit, tap to advance, then choose Check trade against rules. Editing digits sends no order.

For a soft-lock override, choose a reason, then hold the control for three seconds and release. A tap or early release does not override. The server requires hold confirmation and a minimum delay; hard locks remain non-overridable. Hold-to-speak remains available outside the menu. Double-tap exits the G2 app.

In the browser, Open actions menu is separate from the confirmation button. Nothing to confirm is disabled until an action or menu selection exists. On glasses, a tap still opens the menu. Hold within menus to go back; in number entry it returns to the previous digit, or cancels on the first digit. The hold button changes to Hold 3 seconds to override when appropriate.

## Execution boundaries

- **Through Riskavue:** validated ticket, server-side risk check, expiring confirmation, fresh risk check, then demo order submission. Entries are post-only limit orders; crossing the market is rejected. One entry/position per symbol is supported. Protective-stop placement is a separate provider request; a failed stop triggers a cancellation attempt and an explicit uncertain result, never a protection guarantee.
- **Directly on Binance:** observe and react; cancel remaining pending quantity or offer to close an unprotected filled position. A filled trade cannot be undone. Locks cannot disable the Binance account.
- **Risk estimates:** current equity to stop, pending exposure, configured fees and slippage. Missing stops block new entries. Stops and buffers cannot guarantee realized loss in a gap.
- **Session history:** missing day-start balance is labelled estimated. Binance entry/loss counting begins at first connection; prior daily fills are not assumed known. Partial fills aggregate into position cycles, with fees included. Existing-position entry fees before connection are unknown.
- **Resilience:** locks, baselines, fill IDs, decisions and action IDs persist in SQLite. A dispatched action interrupted by a crash becomes `unknown` and is not automatically retried. Inspect the exchange before requesting another action. Stale data blocks writes and replaces the G2 balance.
- **Presets:** custom, FTMO 2-Step style, HyroTrader daily style, The5ers example tier, Topstep Combine style. Assumptions and official sources are visible in the code/UI. Confirm your account tier, maximum-loss type and reset zone. These are rule models, not firm integrations.

## Deployment and packaging

Use the **repository root** for deployment. `Dockerfile` and `railway.json` are included. Set `HOST=0.0.0.0`, a strong `APP_TOKEN`, the HTTPS `APP_ORIGIN`, provider keys, and a persistent volume mounted at `/data`. One server instance owns the SQLite database and Telegram polling. The repository is [dimka90/riskavue](https://github.com/dimka90/riskavue). Do not change its visibility or push without owner approval. Railway deployment uses the GitHub project-token workflow described below.

GitHub deployment follows the 10kobo setup: the `Deploy to Railway` workflow runs after `Check` succeeds on a push to `main`, and deploys that checked commit. Create a Riskavue service named `riskavue`, then add a project token for its environment to the GitHub repository secret `RAILWAY_TOKEN`. If the service has a different name, set the repository variable `RAILWAY_SERVICE`. The workflow uses Railway CLI 5.2.0, matching the existing 10kobo deployment. Local CLI login is not required for this route.

Before the first deployment, set the service variables listed above and attach the `/data` volume. Keep a single replica. Move Telegram polling to the deployed server only when it is ready, so the local and deployed bots do not compete for updates.

```bash
APP_ORIGIN=https://riskavue.up.railway.app npm run configure:manifest
APP_ORIGIN=https://riskavue.up.railway.app npm run pack                # embeds APP_ORIGIN as the API origin and builds riskavue.ehpk
```

For direct Vite builds, `VITE_API_ORIGIN` can select an explicit backend; otherwise the app uses its current origin. `npm run pack` automatically embeds `APP_ORIGIN` so a packaged WebView connects to the server rather than looking for a local `/api`. The checked-in manifest targets https://riskavue.up.railway.app. Set the real server origin and repackage before sideloading a deployed app. The browser UI and API are served from the same origin. Phone/G2 testing needs an accessible HTTPS deployment or a deliberately configured LAN origin; localhost on a phone is not this computer.

## Submission provenance

Implementation started during the hackathon on 24 November 2026. Open-source SDKs, libraries, and the official Even Hub minimal example existed before the event. AI disclosure: Codex generated and edited app/server code, tests, documentation, and demo scripts. The owner directs the work; automated tests and recorded evidence do not replace human review. No AI co-author trailers are added to commits. The bridge setup follows the [official minimal example](https://github.com/even-realities/evenhub-templates/tree/main/minimal); no `cc-g2` or unlicensed competitor code was copied.

A captioned 71-second core walkthrough is available in the [preview release](https://github.com/dimka90/riskavue/releases/tag/v0.1.0-preview), alongside the local development package. The local video is `.artifacts/riskavue-core-demo.webm`. It records the official simulator framebuffer, labels paper scenarios, and distinguishes separately verified Binance execution from the simulator scenarios. Reproduce it with the simulator on port 9900: `SIMULATOR_URL=http://127.0.0.1:9900 npm run test:simulator`, then `npm run record:demo`. Install the encoder with `npx playwright install ffmpeg` if needed.

See `VERIFICATION.md` for precise evidence and remaining device/deployment checks. `SUBMISSION.md` contains the description, track, demo sequence, and submission checklist. The original product plan and research are retained in `PLAN.md` and `research/`.


## Additional checks

```bash
npm run fixture:voice
npm run test:providers
npm run test:binance-breakeven -- --execute-demo
TEST_URL=http://127.0.0.1:3002 npm run test:microphone
```

Provider checks use synthetic speech and a paper decision log. The break-even test uses a small, protected demo position, waits up to ten minutes for a valid market price, verifies that the replacement exists before removing the old stop, then closes the position and cleans up. A market timeout is not a passing replacement test. The microphone test opens Chrome and waits for you to hold the microphone button, say “lock me”, release, then confirm in a fresh paper session. It never starts recording automatically.

## What was actually run / Not done

- **Run:** Binance Demo entry/stop acceptance, duplicate confirmation, cancellation, outside-fill watcher, reduce-only close, and clean-account checks in the dated receipts above. These were not rerun for this update.
- **Run:** official Even Hub simulator tap/swipe/hold checks and the older 71-second simulator recording. Physical G2 was not used.
- **Run:** real Telegram pairing/status/lock flows evidenced by user screenshots and deployed browser pairing receipt (25 November, 15:37:59 UTC). The rapid double-confirm regression uses a mocked Telegram API; this update does not send bot messages.
- **Run:** Deepgram STT with synthetic speech only; Claude API with a synthetic decision log. The original 24 November Claude receipt predates the improved review prompt and contains “Unknown”; it proves the API/persistence path, not current review quality. Later review formatting is covered by tests and user screenshots.
- **Not done:** physical G2 microphone capture, physical G2/R1 operation, stop triggering on Binance, and successful live demo break-even replacement. Break-even attempts timed out waiting for a qualifying price and cleaned up; they are not passes.
- **Not done by this change:** production-money trading, automated prop-firm integration, or enforcement of orders sent outside Riskavue.
- **Release pending:** this judge page, fixes, recording and package require owner review before push/upload/deployment. Existing live service is unchanged.

`VERIFICATION.md` records the final local check results. The judge recording is separate from the older official-simulator video; neither should be described as physical G2 footage.

## New local judge video

The current captioned browser walkthrough is `.artifacts/riskavue-judge-demo.webm` (79.24 seconds, no audio narration). It demonstrates the paper guard and then displays separately recorded Binance Demo receipts. It is not physical G2 or official-simulator footage. Reproduce using `TEST_URL=http://127.0.0.1:3007 node --import tsx scripts/record-judge.ts` with the isolated local paper server. The older simulator video remains available separately. This new video has not been uploaded.

Current checks: 71 unit/integration tests and ten browser workflows passed, plus TypeScript/Vite build and Docker deployment smoke checks. See `VERIFICATION.md` for scope and outstanding checks.

## Focused glasses preview

Use **Glasses view** in the companion header, or open `/?view=glasses`, to centre the glasses preview and hide setup panels. Overview, Positions, Rules and Review tabs mirror swipe navigation; pending confirmations disable those tabs until confirmed or cancelled. Companion view restores the full setup interface.

The overview keeps loss allowance, trades left, losses and reset time in a right-aligned value column. The SDK has no native text alignment field, so the glasses renderer uses a small grayscale value image alongside native text; it falls back to complete native text if image delivery fails. This has been inspected in the official simulator, not on physical G2. The browser uses the same values with a right-aligned CSS column.

The owner will record the final video manually. Earlier automated recordings predate this latest UI pass.
