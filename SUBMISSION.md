# Riskavue — Your limits. In sight.

It's 14:32. Tunde has $40 left before his prop firm's daily loss limit. One revenge trade and the funded account is gone.

*Tunde is an illustrative persona, not a verified customer. The judge walkthrough uses a separate $190 synthetic account.*

**Other G2 trading apps show your risk. Riskavue enforces your rules.**

**Main track:** Exchanges & Stocks — Binance Futures Demo.
**Special award:** Best Telegram integration.
**Repository:** https://github.com/dimka90/riskavue — do not change visibility or push without owner approval.
**Existing live companion:** https://riskavue.up.railway.app — private trading APIs require authentication.
**Judge path:** `/judge` — public paper walkthrough, no token.

## Description

Riskavue helps a trader stick to account-level loss and entry limits before an emotional trade leaves the app. Even G2 shows the loss allowance at a glance. Swipe and tap to enter a ticket, lock the session or manage an open position; voice is optional. The server checks the rules again at confirmation before submitting an allowed demo order.

After two consecutive losses under the example rules, new Riskavue entries lock until the displayed reset. A single tap cannot remove that lock. Hard locks cannot be overridden; a soft override requires a reason and a deliberate three-second hold. Existing protective stops stay in place. Telegram provides status, pairing and confirmed actions when the glasses app is not open.

This is a real guard for entries placed through Riskavue's glasses, Telegram and ticket flows. For orders placed directly on Binance, it is a watcher: it can cancel remaining pending quantity, report “already filled” honestly, and offer a confirmed reduce-only close. It cannot undo fills or disable the Binance account. Rule presets are calculation models, not prop-firm connections.

Topstep reports that 16.8% of Trading Combines initiated in 2025 completed successfully. This is a Combine-level completion figure, not the share of people who passed or a measurement of daily-loss breaches. [Official disclosure](https://www.topstep.com/social-media-disclosure). We make no unsupported 79% claim or claim that Riskavue improves this rate.

## Judge sequence — about 60 seconds

1. Load the $190 paper scenario.
2. Check the oversized ticket: **NOT SENT**, zero paper orders.
3. Tap to discard; confirm that no order appears.
4. Trigger the two-loss lock, then tap to try another trade: **STILL LOCKED**.
5. Show the Telegram `/status` formatter and a clearly labelled deterministic three-line review.
6. Show recorded Binance Demo proof: entry #28694211519 plus protective stop, duplicate confirmation without duplication, cancellation, outside-order “already filled”, reduce-only close, and a clean account at both run endings. UTC timestamps and receipt hashes appear on the page.

The paper judge path uses the same server-side rule engine but an isolated in-memory account. It never uses Binance, Telegram or AI credentials. Recorded Binance receipts are separate evidence, not paper results.

## What was actually run / Not done

Run previously: real Binance Demo entry/stop/cancel/close receipts; Telegram pairing/status/confirmed lock; official simulator input checks; Deepgram with synthetic speech and Claude with a synthetic log. The older Claude receipt predates the prompt fix; current output formatting has separate tests.

Not done: physical G2/R1 verification, physical G2 microphone, Binance stop triggering, or successful end-to-end break-even replacement. Two break-even attempts timed out and cleaned up; they do not count as passes. No real-money trades are required or claimed.

## AI and prior work disclosure

Implementation began on November 24 during the hackathon. Codex generated and edited code, tests, documentation and demo scripts under the owner's direction. No AI co-author commit trailers are used. Existing libraries and APIs include the official Even Hub SDK/template and simulator, TypeScript, Vite, Express, grammY, SQLite, Binance Futures Demo, Deepgram and Anthropic. Dependency versions are in the lockfile. No competitor implementation was copied.

## Still required before submission

- Owner review and explicit approval before push, release upload or deployment. Keep current visibility unchanged.
- Verify the deployed `/judge` and private-route 401 boundary after approved deployment.
- Review `.artifacts/riskavue-judge-demo.webm` (79.24-second captioned browser walkthrough, no narration) and choose the final video. The older official-simulator recording is `.artifacts/riskavue-core-demo.webm`; do not present browser footage as a physical-device test.
- Package the live HTTPS origin, then sideload/test on physical G2 if available. Lack of hardware testing must remain disclosed.
- Submit the repository, description and a video of at most three minutes by the owner's target: 29 November 2026, 19:59 UTC.
