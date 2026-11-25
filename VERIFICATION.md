# Verification — updated 25 November 2026

## Verified against Binance Futures Demo

- Authenticated account reads: wallet/equity 5,000 USDT, initially no positions or orders. After the final DNS/read-recovery changes, three consecutive fresh-process account checks passed and each confirmed zero positions and zero orders.
- Oversized ticket discarded without sending an entry.
- Allowed ticket remained unsent until explicit confirmation.
- Post-only BTCUSDT entry and a separate quantity-bound, reduce-only protective stop accepted.
- Repeated confirmation did not create another entry.
- Cancellation acknowledged by Binance.
- A separate small market-order fixture filled on demo. Riskavue detected the unprotected position, proposed closing it, and its confirmed reduce-only close filled successfully.
- Final reconciliation: zero positions and zero orders, including protective algo orders.
- Private and market WebSockets opened; six market refresh messages arrived in a six-second observation.

The successful run completed at 21:00:05 UTC. Sanitized local receipts are in `.artifacts/binance-verification.json`. That run verifies resting-order acceptance/cancellation. The separate filled-position watcher/close receipts are in `.artifacts/binance-close-verification.json`; its close was confirmed at 21:14:08 UTC. Stop triggering and break-even replacement remain unverified. No production exchange endpoint was used.

## Local verification

All 58 unit/integration tests pass. The suite covers risk formulas, missing stops, stale data, repeated confirmations, persistent locks, crash recovery, partial-fill accounting, stop replacement ordering, DNS scope/TTL/failure, and actual demo starting balance. Two browser workflows cover rejection, confirmation, fill/close in paper mode, locks, connection loss and mobile layout. Actual official-simulator tap rejection and swipe navigation passed.

The captioned core recording is `.artifacts/riskavue-core-demo.webm` (1280 × 720, approximately 71 seconds). Its green display is the actual simulator framebuffer, not a recreated UI. Synthetic scenarios are labelled paper mode. It is a reviewable core demo, not the final all-provider submission recording.

## Remaining external requirements

1. All provider credentials and TELEGRAM_OWNER_ID are configured locally. Telegram /start, /status, and confirmed /lock have been verified by user screenshots. Do not paste secrets into chat or commit them.
2. Authenticate Railway locally with `railway login`. The current CLI session is unauthorized. Deploy a single server with `/data` persistent storage, HTTPS `APP_ORIGIN`, and a generated `APP_TOKEN`.
3. Public source is available at https://github.com/dimka90/riskavue.
4. Telegram pairing and confirmation are verified. Live microphone capture on G2, break-even replacement, and deployed G2/WebView access remain separate checks.
5. Record the final provider scenes and submit the public repository and video links on DoraHacks.

## Changes prompted by real testing

- Local DNS could not reliably resolve the documented demo hostname. Demo-only DNS recovery uses bounded public DNS queries, an HTTPS resolver fallback, expiring answers and verified TLS; no IP is pinned and no trade request is automatically retried.
- Binance rejected `closePosition=true` stops before a position existed (`-4509`, GTE). Entry protection uses quantity-bound reduce-only stops instead. Failed protection is reported as uncertain and triggers an entry-cancellation attempt.
- Default paper balance was $10,000 while the actual demo wallet was $5,000. First connection now initializes unsaved default rules from the wallet, preserving explicitly saved rules.
- Slow fill-history reads could age a snapshot before publication. History is now fetched before the current account snapshot.

- Slow signed reads can exceed Binance’s timestamp window. Read requests use a 10-second receive window and retry once after clock resynchronization only on explicit `-1021` rejection. Write requests retain the 5-second window and are never replayed automatically.

- Transient network failures on GET requests receive one bounded retry with a fresh signature. No POST, PUT, or DELETE request is replayed. This network has intermittent failures, so deployed connectivity still needs sustained verification.

## Deepgram and Anthropic verification

Both configured provider keys were exercised successfully on 24 November. Receipts are in `.artifacts/providers/verification.json`.

- Deepgram Nova-3 transcribed a synthetic 16 kHz mono PCM fixture as "Lock me.". The parser proposed a lock, left the paper session unlocked before confirmation, and applied the lock only after confirmation.
- Early synthetic samples were misheard as "Lot me" or "Walk me" and were rejected without creating an action. Nova-3 keyterm hints now include the supported command vocabulary; unknown phrases remain rejected. This is not evidence of real microphone accuracy or G2 microphone capture.
- Claude returned a three-line review of a synthetic decision log, and the review was persisted. Markdown on the required labels is normalized; missing or extra lines fail validation rather than silently dropping content.
- Provider HTTP connections use IPv4 with normal TLS verification because this network intermittently fails short address-family connection attempts.

Reproduce with `npm run fixture:voice` (generates a short synthetic voice using Deepgram TTS), then `npm run test:providers` (real Deepgram STT and Claude API calls against synthetic data; no exchange trades). The fixture and receipts are gitignored. Live user microphone audio is not recorded by these tests.

## Telegram verification — 25 November

The user confirmed real /start and /status replies from @RiskavueBot, then /lock with an inline confirmation. A subsequent /status showed the session lock persisted. This was an isolated paper session, not a Binance trade.

That test exposed competing message edits from the action-result event and callback handler, causing Telegram's benign “message is not modified” error to appear after a successful lock. Both paths now share a serialized, deduplicating updater. The specific already-applied response counts as success; other API errors remain errors. Three regression tests cover concurrent edits, already-applied updates after restart, and recovery from other failures. The bot was restarted with the same paper database to preserve the lock. User-side retesting of the corrected callback is pending; Telegram pairing is also still pending.

## Readable session text — 25 November

Locked status now leads with the lock, exact reset time and timezone offset, and remaining hours/minutes; available-entry counts are hidden while locked. Repeated manual locks report the existing deadline without another confirmation, extra warning, deadline extension, or hard-lock downgrade. Pending prompts and completed results use distinct text. Automatic lock warnings still include the deadline; a manual confirmation produces only its result.

Review prompts now describe manual locks as user requests, use "No rule violations recorded" instead of an Unknown placeholder, and offer one concrete session-grounded next step or omit it. The real Claude check returned the expected manual-lock wording plus a suggestion to connect before session start because the baseline was estimated. Unsupported Unknown placeholders and malformed review layouts are rejected. Two required review lines plus an optional next step replace the former rigid three-line requirement.

55 automated tests and both browser flows pass. The official simulator's final lock screen was inspected and saved at `.artifacts/text-refresh/locked-final.png`. The user's bot was restarted using its existing SQLite database, and the lock remained active.

## Telegram pairing verified — 2026-11-25

The owner sent a fresh six-digit pairing command to @RiskavueBot and received the success reply. The browser test completed, received its session token, and verified the matching hashed token and expiry in the server database. Evidence: `.artifacts/telegram/pairing.json` and `.artifacts/telegram/paired.png`. This verifies browser pairing; it does not establish physical G2 connectivity.

Pasted commands are now recognized by message text even when Telegram supplies no command entity. Missing digits and expired codes receive explicit replies. The updated suite has 58 passing tests, including owner authorization, single-use codes, token expiry, and pasted-command handling. Pairing is no longer pending; live microphone capture, actual break-even replacement, and deployed G2/WebView access remain separate checks.

## Publication and refreshed artifacts — 2026-11-25

Published the secret-scanned source to `dimka90/riskavue`. All 58 tests, the production build, both browser workflows, and official simulator input checks passed. Refreshed the captioned simulator video and local `.ehpk` package with current display text and provider verification labels. The package still targets localhost and must be rebuilt for a deployed HTTPS origin.

A physical browser microphone test was opened but timed out without an audio submission; it is not marked verified. Railway CLI is still unauthorized. The first Docker build hit an npm registry read timeout. The retry succeeded; the container smoke test passed locally and on GitHub. It verifies UI serving, unauthorized-request rejection, origin rejection, and lock persistence across a server restart.

## Break-even attempt and CI — 2026-11-25

Two protected Binance Demo fixtures waited for a valid break-even trigger (two minutes, then ten minutes). Neither reached the required price, so replacement execution is **not verified**. Both runs closed the fixture and reconciled zero positions and orders; the second cleanup completed at 09:18:12 UTC. Receipt: `.artifacts/binance-breakeven-verification.json`. Unit tests still verify replacement ordering and preservation of the original stop on replacement failure.

GitHub CI caught a Node/ICU formatting difference (`UTC+0` rather than `UTC`). Normalizing zero offsets fixed it. All 58 tests and the production build passed on GitHub: https://github.com/dimka90/riskavue/actions/runs/45583934685. The updated local package is attached to https://github.com/dimka90/riskavue/releases/tag/v0.1.0-preview.

The complete GitHub check, including Docker build and smoke test, passed: https://github.com/dimka90/riskavue/actions/runs/45584774881. A separate Binance-mode browser session at local port 3005 also displayed a fresh real demo account with zero orders and positions; evidence is in `.artifacts/binance/live-account.json` and `live-account.png`. The Telegram bot remains on its preserved paper session.

## Silent glasses controls — 2026-11-25

Added a tap/swipe menu for locking, new trades, position close/break-even, pending-entry cancellation, close-all, reviews, rule viewing and lock details. Soft overrides require a selected reason, a deliberate three-second hold and server validation; hard locks remain blocked. No microphone is opened for menu actions.

65 unit/integration tests pass. Seven browser workflows cover existing behavior plus silent lock/override, cancellation/close and digit-by-digit trade entry with separate confirmation. The official simulator passed tap/swipe/hold interaction checks; screenshots were inspected for readability on the actual 576×288 framebuffer. Evidence: `.artifacts/silent-controls/`. No live account actions were used in these tests. Physical G2 testing remains outstanding.
