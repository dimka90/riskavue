# Verification — 25 November 2026

This document supersedes earlier notes saying Railway was not deployed or the package still targeted localhost. The existing live service is https://riskavue.up.railway.app. The owner approved pushing this judge/UI update on November 26. Repository visibility and video uploads remain unchanged. Deployment is verified separately after the push.

## Recorded Binance Futures Demo evidence

- `.artifacts/binance-verification.json`: oversized ticket rejected with 0 exchange orders at 2026-11-24T20:59:41.152Z; entry #28694211519 and protective stop accepted at 20:59:53.184Z; repeated confirmation did not duplicate; cancellation confirmed; 0 positions and 0 orders at 21:00:05.828Z.
- `.artifacts/binance-close-verification.json`: outside fixture #28694222135 filled at 21:14:01.029Z; watcher proposed “already filled”; confirmed reduce-only close at 21:14:08.109Z; 0 positions and 0 orders at 21:14:13.689Z.
- `app/src/proof.json` contains only allowlisted timestamps, descriptions and order numbers, plus hashes of those two receipts. The judge page renders this saved evidence; it does not replay exchange calls.
- `.artifacts/binance-breakeven-verification.json`: attempts did not reach a valid market price in the allotted time. Replacement execution and stop triggering remain unverified. Fixture cleanup passed.

## Provider and hardware boundaries

- Deepgram: synthetic PCM speech transcribed, parsed, and confirmed against paper. No physical G2 microphone verification.
- Claude: actual API and persistence verified with a synthetic log. The original receipt contains old “Unknown” wording; it is not evidence of the revised prompt's quality. Revised formatter and grounding are tested separately.
- Telegram: real user screenshots show status, lock, repeated-lock replies and review; deployed browser pairing receipt at 2026-11-25T15:37:59.409Z records an accepted session token. Current rapid double-confirm regression is offline with mocked Telegram responses, not a newly sent live message.
- Official simulator: tap/swipe/hold checks and earlier 71-second recording exist. Physical G2/R1 operation remains unverified.
- Browser microphone attempt previously timed out without a user audio submission; not a pass.

## Current revision checks

- `npm test`: **69 passed, 0 failed** (full named tests, Node test runner).
- `npm run test:browser`: **9 passed**, including the complete judge path, unchanged owner account, rule-edit cancellation, silent entry/back, double-confirm behavior, and mobile overflow checks. Ran against isolated paper port 3007.
- `npm run build`: passed TypeScript and Vite multi-page build.
- Docker build plus `scripts/test-deployment.ts`: passed anonymous `/judge`/judge-start access, rejection of unsupported judge actions, private `/api/state` returning 401 without a token, authenticated access, origin rejection, and lock persistence across restart.
- Local runtime inspection: all four pre-existing Riskavue server processes explicitly disable `TELEGRAM_BOT_TOKEN`; the new test/recording server also disables Telegram and all provider credentials. No second local Telegram poller was started.
- Configured `.env` APP_ORIGIN to `https://riskavue.up.railway.app`, then ran `configure:manifest` and `pack`. Package: `riskavue.ehpk`, 61,809 bytes, SDK 0.0.16 / minimum app 2.2.10. Not uploaded or sideloaded.
- Scanned changed source/docs against configured secret values: no matches. No `.env` contents printed or staged. Git HEAD is unchanged; no commit/push, visibility change or deployment was performed.
- No new exchange trades or live Telegram messages were sent. The rapid Telegram double-confirm regression uses actual bot handlers with mocked API responses, including a 400 “message is not modified”.

## Remaining before submission

Owner approval for publishing/deploying, deployed judge-route check, final video review/upload, physical-device checks if hardware is available, and DoraHacks submission. Keep the distinction between paper results, recorded Binance Demo evidence, and unverified device behavior visible.

## New judge recording

`.artifacts/riskavue-judge-demo.webm`: **79.24 seconds, 1280 × 900, 25 fps**, captioned, no audio narration. It records the actual browser judge route, not physical glasses or the official simulator. Seven requests went only to the isolated `/api/judge/` routes. Recorded Binance receipts are explicitly presented as separate evidence. The rejection frame and end card were inspected; transcript and verification metadata are in `.artifacts/judge-video/`. Reproduce with `TEST_URL=http://127.0.0.1:3007 node --import tsx scripts/record-judge.ts` against the isolated paper server.

The earlier official-simulator video remains `.artifacts/riskavue-core-demo.webm`. Choose or combine the final submission scenes only with accurate environment labels and a total duration under three minutes.

A late browser rerun initially failed with connection-refused errors because the temporary local server had stopped. Restarting an isolated paper process allowed the complete nine-workflow suite to run again; this was a test-server lifecycle issue, not a passing run hidden as success.

## UI and right-alignment pass

71 unit/integration tests and ten browser workflows passed. The focus-view check verifies shared right-edge geometry, desktop/mobile fit, navigation, confirmation visibility and cancellation. The first mobile check found three pixels of overflow; scaling text to its frame fixed it. Build/type checking passed. Framebuffer screenshots for the native value-column renderer are in `.artifacts/ui-polish/`. Physical G2 remains unverified. The owner is handling the final video manually; no new video was recorded during this UI pass.

## Native menu and Back

The simulator Menu button now receives native Back and Open actions entries on startup and every page rebuild. Menu clicks are navigation only; Back dismisses a pending confirmation without executing it. Returning from the native menu no longer leaves display updates paused. Official simulator checks verified both entries, opening actions after leaving the menu open for more than five seconds, returning to the overview, and dismissing a pending paper lock with no lock or new orders. Physical hardware remains unverified.

## Pairing dialog regression

Build/type checking, the full unit/integration suite and all 11 browser workflows passed before deployment. A regression test checks that repeated unauthorized responses cannot reopen dismissed connection settings or cover the Telegram pairing code.
