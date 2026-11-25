# 02 – Even Hub SDK research (for Riskavue)

Researched on 24 Nov 2026. Sources are the official docs at `hub.evenrealities.com/docs/...` (fetched with `r.jina.ai`), the npm packages (I downloaded the tarballs with `npm pack` and read their README and `.d.ts` files; nothing was installed), the official template repo, and GitHub.

How to read this file:
- Every fact has a source link next to it.
- **[UNVERIFIED]** means I could not confirm it in an official source, or I am inferring it.
- **[COMMUNITY]** means it comes from a community repo, not from Even Realities.
- "Docs" means `https://hub.evenrealities.com/docs/`.

---

## 0. The short version

- The app is a normal Vite + TypeScript web page. It runs in a WebView inside the Even Realities phone app. The glasses only draw what you send and send back taps. ([Architecture](https://hub.evenrealities.com/docs/get-started/architecture))
- You draw with **containers** (text, list, image) placed at pixel positions on a 576×288 canvas. There is no HTML/CSS on the glasses. ([Display](https://hub.evenrealities.com/docs/build/display))
- All input (taps, swipes, long press, menu picks, mic audio) arrives in **one callback**: `bridge.onEvenHubEvent(...)`. ([Device APIs](https://hub.evenrealities.com/docs/build/device-apis))
- **Double-tap on the root page must call `shutDownPageContainer(1)`** (the system exit dialog). So on the home screen, double-tap can NOT be used as "confirm". ([App Submission](https://hub.evenrealities.com/docs/ship/app-submission))
- The mic gives raw **PCM 16 kHz, 16-bit, mono**. There is no speech-to-text in the SDK. You send the audio to your own server. ([Device APIs § Audio](https://hub.evenrealities.com/docs/build/device-apis#audio))
- Network calls need **both** the `app.json` whitelist **and** correct CORS headers on the server. ([Networking](https://hub.evenrealities.com/docs/build/networking))

---

## 1. Setup

### 1.1 Packages and current versions (checked on npm today)

| Package | What it is | Latest on npm | Source |
| --- | --- | --- | --- |
| `@evenrealities/even_hub_sdk` | The SDK. A project dependency (no `-g`). | **0.0.16** (24 Sep 2026). Its npm metadata says `minAppVersion = 2.2.10`. Node `^20.0.0 \|\| >=22.0.0`. | `npm view @evenrealities/even_hub_sdk` |
| `@evenrealities/evenhub-cli` | CLI. Binaries `evenhub` and `eh`. | **0.2.0** (20 Oct 2026). Node `^20.17.0 \|\| ^22.13.0 \|\| >=23.5.0`. | `npm view @evenrealities/evenhub-cli` |
| `@evenrealities/evenhub-simulator` | Desktop simulator. Binary `evenhub-simulator`. Ships native binaries for linux-x64/arm64, darwin, win32. | **0.9.5** (1 Sep 2026) | `npm view @evenrealities/evenhub-simulator` |
| `@evenrealities/pretext` | Official pixel-accurate font measurement library for G2 | 0.1.4 | `npm search @evenrealities` |

Version notes:
- The docs changelog also lists SDK 0.0.16, CLI 0.2.0, simulator 0.9.5 as current. ([Changelog](https://hub.evenrealities.com/docs/reference/changelog))
- But many doc pages still say "SDK 0.0.14 / simulator 0.9.3". Treat 0.0.16 as current. ([Install tooling](https://hub.evenrealities.com/docs/get-started/quickstart/install-tools))
- What 0.0.15 and 0.0.16 added (from the SDK README on npm):
  - 0.0.15: needs Even App `2.2.10`. Long-press `sysEvent` now keeps `eventSource`, so you can tell **right temple, ring, or left temple** apart.
  - 0.0.16: fixes `setTimeout` / `setInterval` callbacks running more than once.
- Simulator 0.9.4 added Linux/Windows ARM64 builds. 0.9.5 fixed crashes under heavy bridge/console traffic. (simulator README on npm)

### 1.2 Node version

Node 20 LTS or 22+. Node 18 is not supported. ([Install Node](https://hub.evenrealities.com/docs/get-started/quickstart/install-node)). The CLI needs at least 20.17 / 22.13 / 23.5. ([CLI](https://hub.evenrealities.com/docs/cli/))

### 1.3 Official install (global tools)

```bash
npm install -g @evenrealities/evenhub-cli @evenrealities/evenhub-simulator
```
([Install tooling](https://hub.evenrealities.com/docs/get-started/quickstart/install-tools))

Without a global install, `npx` works:
```bash
npx @evenrealities/evenhub-cli qr --url "http://<your-lan-ip>:5173"
```
([Install Node § No global install](https://hub.evenrealities.com/docs/get-started/quickstart/install-node))

The CLI can also be a project dev-dependency: `npm install -D @evenrealities/evenhub-cli`, then `npx evenhub`. ([CLI § Install](https://hub.evenrealities.com/docs/cli/))

### 1.4 Create the project – two official routes

**Route B – the official minimal template (recommended by the hackathon page):**
```bash
npx degit even-realities/evenhub-templates/minimal my-first-app
cd my-first-app
npm install
```
([First App § Route B](https://hub.evenrealities.com/docs/get-started/quickstart/first-app), [Templates](https://hub.evenrealities.com/docs/get-started/quickstart/templates))

Templates available: `minimal`, `text-heavy`, `asr` (mic + STT stub), `image`. ([Templates](https://hub.evenrealities.com/docs/get-started/quickstart/templates))

**Route A – plain Vite by hand:**
```bash
npm create vite@latest my-first-app -- --template vanilla-ts
cd my-first-app
npm install
npm install @evenrealities/even_hub_sdk@latest
evenhub init        # writes app.json only
```
([First App § Route A](https://hub.evenrealities.com/docs/get-started/quickstart/first-app))

> **GOTCHA – the template pins OLD versions.** I read `minimal/package.json` on GitHub (repo HEAD `8cb0135`, 7 Aug 2026):
> ```json
> "dependencies":   { "@evenrealities/even_hub_sdk": "^0.0.10" },
> "devDependencies": { "@evenrealities/evenhub-cli": "^0.1.12",
>                      "@evenrealities/evenhub-simulator": "^0.7.2", ... }
> ```
> With npm's caret rules, `^0.0.10` resolves to exactly **0.0.10**, `^0.7.2` to **0.7.3**, `^0.1.12` to **0.1.14** (I checked with `npm view <pkg>@'<range>' version`).
> So a fresh template has **no long press, no contextual menu, no `textColor`** (all SDK 0.0.14+), and its local simulator cannot simulate them (simulator 0.9.0+). You must bump the versions (see the commands in §1.6).
> Source: https://github.com/even-realities/evenhub-templates/blob/main/minimal/package.json

The template also has a `vite.config.ts` that is already right for phone access:
```ts
export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'esnext' },
})
```
(https://github.com/even-realities/evenhub-templates/blob/main/minimal/vite.config.ts)

Template npm scripts: `dev`, `build` (`tsc --noEmit && vite build`), `pack` (`npm run build && evenhub pack app.json dist`), `simulate` (`evenhub-simulator http://localhost:5173`). (same `package.json`)

### 1.5 Project layout

```
my-first-app/
├── src/main.ts       ← entry point
├── public/icon.png   ← greyscale app icon (24×24)
├── index.html        ← keep as-is
├── package.json
├── vite.config.ts    ← keep as-is
├── tsconfig.json
└── app.json          ← Even Hub manifest (needed for packaging)
```
([First App § Project structure](https://hub.evenrealities.com/docs/get-started/quickstart/first-app))

### 1.6 Commands we will actually use (scaffold → simulator)

These avoid global installs (the tools live in the project's devDependencies):
```bash
npx degit even-realities/evenhub-templates/minimal riskavue-app
cd riskavue-app
npm install
npm install @evenrealities/even_hub_sdk@0.0.16
npm install -D @evenrealities/evenhub-cli@0.2.0 @evenrealities/evenhub-simulator@0.9.5

# terminal 1
npm run dev                                   # Vite on http://localhost:5173
# terminal 2
npx evenhub-simulator http://localhost:5173   # same as: npm run simulate
```
The two-terminal flow is from [First App § 5](https://hub.evenrealities.com/docs/get-started/quickstart/first-app). The version bumps are my recommendation based on the gotcha above. **[UNVERIFIED]** I did not run these commands (research only).

After bumping, also set `"min_sdk_version": "0.0.16"` in `app.json` ("match it in app.json's min_sdk_version" – [Install tooling](https://hub.evenrealities.com/docs/get-started/quickstart/install-tools)).

### 1.7 Run on real glasses (QR sideload, hot reload)

```bash
npm run dev
evenhub qr --url "http://<your-lan-ip>:5173"     # Linux LAN IP: hostname -I | awk '{print $1}'
```
Scan with **Scan QR** in the Even Hub tab of the phone app. ([Local Testing](https://hub.evenrealities.com/docs/test/local-testing))
- Developer Mode has no toggle: sign in at hub.evenrealities.com/login with the same account as the phone app, then force-quit and reopen the phone app. ([Hardware § Developer Mode](https://hub.evenrealities.com/docs/get-started/quickstart/hardware))
- If it scans but nothing loads: firewall, or Wi-Fi "AP isolation". Use a phone hotspot or Tailscale. ([Hardware § Network](https://hub.evenrealities.com/docs/get-started/quickstart/hardware))
- If HMR stalls, pin `server.hmr.host` to your LAN IP in `vite.config.ts`. ([Local Testing § HMR recovery](https://hub.evenrealities.com/docs/test/local-testing))
- QR sideload **dies when the phone locks**. ([Local Testing](https://hub.evenrealities.com/docs/test/local-testing))

`evenhub qr` options: `--url`, `--ip`, `--port`, `--path`, `--https/--http`, `--external` (save PNG), `--clear` (clear cached URL). ([CLI Project](https://hub.evenrealities.com/docs/cli/project))

### 1.8 Package `.ehpk` and upload

```bash
npm run build
evenhub pack app.json dist -o riskavue.ehpk --sdk-ver 0.0.16
```
- `--sdk-ver` makes the CLI stamp the right `min_app_version` (it reads `minAppVersion` from npm). Without it, the CLI uses the npm `latest` SDK. ([Packaging § Auto-derive](https://hub.evenrealities.com/docs/ship/packaging))
- `-c` / `--check` checks the `package_id` is free (needs login). ([CLI Builds](https://hub.evenrealities.com/docs/cli/builds))
- The `.ehpk` is a zip of the built files plus the manifest. ([Glossary](https://hub.evenrealities.com/docs/reference/glossary))
- Practical size cap ~10 MB. ([FAQ](https://hub.evenrealities.com/docs/reference/faq))

Upload / beta (needs `evenhub login`, CLI 0.2.0):
```bash
evenhub login
evenhub create riskavue.ehpk --name "Riskavue" --tagline "..." --icon icon.png   # first build
evenhub upload riskavue.ehpk -m "What changed"                                      # later builds
evenhub promote 0.1.1 --to beta
evenhub testers add you@example.com
```
([CLI](https://hub.evenrealities.com/docs/cli/), [CLI Apps](https://hub.evenrealities.com/docs/cli/apps))
- A beta install needs **both** the build on the beta channel **and** the tester status `Active`; otherwise the phone says "test version expired". ([Beta Testing](https://hub.evenrealities.com/docs/test/beta-testing))
- Only beta and published apps appear on the **glasses menu**. Private builds launch from the phone. ([Private Testing](https://hub.evenrealities.com/docs/test/private-testing))
- The `.ehpk` is **optional** for the hackathon. ([Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail))

### 1.9 `app.json` (manifest)

Minimum from the docs:
```json
{
  "package_id": "com.exampleco.exampleapp",
  "name": "My First App",
  "version": "0.1.0",
  "edition": "202601",
  "min_sdk_version": "0.0.12",
  "entrypoint": "index.html",
  "permissions": [],
  "supported_languages": ["en"]
}
```
([First App § 4](https://hub.evenrealities.com/docs/get-started/quickstart/first-app))

Field rules ([Packaging § Field reference](https://hub.evenrealities.com/docs/ship/packaging), [App Submission § Manifest](https://hub.evenrealities.com/docs/ship/app-submission)):

| Field | Rule |
| --- | --- |
| `package_id` | Reverse-DNS, lowercase letters and numbers only, each segment starts with a letter, ≥2 segments, **no hyphens, no underscores**. Permanent once published. |
| `edition` | Must be `"202601"`. |
| `name` | ≤ 20 characters. **Must not contain "Even"** (auto-reject). |
| `version` | `x.y.z`, no `v`, no suffix. |
| `min_sdk_version` | Required. Match your installed SDK. |
| `min_app_version` | Optional. The CLI derives it at pack time. |
| `entrypoint` | Must exist inside the build folder, e.g. `dist/index.html`. |
| `permissions` | **Array of objects**, not a map. Each needs `name` and `desc` (1–300 chars). |
| `supported_languages` | Any of `en, de, fr, es, it, zh, ja, ko`. |

Permission names: `network`, `location`, `g2-microphone`, `phone-microphone`, `album`, `camera`. ([Packaging § Permissions](https://hub.evenrealities.com/docs/ship/packaging))
Every declared permission must actually be used, or review flags it. ([App Submission](https://hub.evenrealities.com/docs/ship/app-submission))

**Network whitelist** – what Riskavue needs:
```json
"permissions": [
  {
    "name": "network",
    "desc": "Reads your trading account's daily P&L from the Riskavue server.",
    "whitelist": ["https://api.riskavue.example"]
  },
  {
    "name": "g2-microphone",
    "desc": "Lets you confirm or explain a trade by voice."
  }
]
```
Rules for the whitelist ([Networking](https://hub.evenrealities.com/docs/build/networking)):
- One entry per **full origin** (`https://api.example.com`). No bare hostnames, **no wildcards**.
- HTTPS in production. `http://` only for local LAN dev.
- The whitelist is enforced by the Even app **before** the request leaves. It is **not a CORS bypass**.
- WebSockets follow the same rules ([FAQ](https://hub.evenrealities.com/docs/reference/faq)). The `asr` template puts a `wss://` origin in the whitelist ([asr README](https://github.com/even-realities/evenhub-templates/tree/main/asr)).
- `evenhub pack` rejects an **empty** whitelist – leave the `network` entry out until you have a domain. ([asr README](https://github.com/even-realities/evenhub-templates/tree/main/asr))
- If you change the whitelist, re-pack and re-upload. ([Networking § Debugging](https://hub.evenrealities.com/docs/build/networking))
- **[UNVERIFIED]** Whether the whitelist is enforced during QR sideload / in the simulator. The docs only talk about "production". Test the packaged build once.

---

## 2. SDK API

### 2.1 Boot: always wait for the bridge

```ts
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
const bridge = await waitForEvenAppBridge()
```
Calling SDK methods before the bridge is ready **silently does nothing**. ([First App § 3](https://hub.evenrealities.com/docs/get-started/quickstart/first-app))
Outside the Even app WebView you get `Flutter handler not available`. (SDK README on npm)

### 2.2 The display

- 576 × 288 px per eye. Origin top-left. 4-bit greyscale shown as 16 levels of green. Black = off (see-through). ([Display § Canvas](https://hub.evenrealities.com/docs/build/display))
- No HTML, CSS, DOM or flexbox on the glasses. Only containers at absolute pixel positions. (same)

**Container limits** ([Display § Containers](https://hub.evenrealities.com/docs/build/display), SDK README):
- Max **4 image** + **8 other** (text/list) containers per page; `containerTotalNum` is 1–12.
- **Exactly one** container has `isEventCapture: 1`. It receives the input.
- `containerName` max **16 chars**, unique. `containerID` unique.
- Borders: `borderWidth` 0–5, `borderColor` 0–15, `borderRadius` 0–10, `paddingLength` 0–32. **No background fill.** The border is the only decoration.
- `zOrderIndex` (SDK 0.0.12+): all containers set it or none; values unique; larger = in front.

**Text containers** ([Display § Text containers](https://hub.evenrealities.com/docs/build/display)):
- Plain text, left- and top-aligned. **No alignment, no font size, no bold/italic.**
- Wraps at container width. `\n` = new line. If it overflows and has event capture, the firmware scrolls it.
- A full-screen text container holds about **400–500 characters**.
- "Centering" = pad with spaces.
- Max characters per call: `createStartUpPageContainer` **1,000**, `rebuildPageContainer` **1,000**, `textContainerUpgrade` **2,000**.
- `textColor` (SDK 0.0.14+) = brightness **0–4** (4 is brightest and the default). 0 may be nearly invisible.

```ts
new TextContainerProperty({
  xPosition: 0, yPosition: 0, width: 576, height: 288,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 1, containerName: 'main',
  content: 'Your text here',
  textColor: 4,
  isEventCapture: 1,
})
```
([Display](https://hub.evenrealities.com/docs/build/display))

**List containers:** up to 20 items, 64 chars each, firmware moves the highlight, no in-place update (rebuild the page to change). ([Display § List](https://hub.evenrealities.com/docs/build/display)) The simulator caps items at 63 bytes. ([Changelog](https://hub.evenrealities.com/docs/reference/changelog))

**Image containers:** max 288 × 144 each, 4-bit grey. Cannot be filled at create time: create empty, then `updateImageRawData`. No concurrent sends. ([Display § Image](https://hub.evenrealities.com/docs/build/display))

**Font:** one LVGL font in firmware. No choice, no size, **not monospaced**. Unknown characters are silently dropped. **No emoji.** ([Display § Font](https://hub.evenrealities.com/docs/build/display), [FAQ](https://hub.evenrealities.com/docs/reference/faq))
- Line height and characters-per-line are **not documented**. **[UNVERIFIED]** Measure in the simulator or use `@evenrealities/pretext` (official measurement library on npm) / the `font-measurement` skill in the `everything-evenhub` Claude Code plugin ([Claude Code page](https://hub.evenrealities.com/docs/learn/claude-code)).

### 2.3 Page lifecycle methods

| Method | Use | Returns |
| --- | --- | --- |
| `createStartUpPageContainer` | First page. Call **once** at startup. | int: 0 ok, 1 invalid, 2 oversize, 3 out of memory |
| `rebuildPageContainer` | Replace the whole page (layout change). Brief flicker on hardware. | boolean |
| `textContainerUpgrade` | Change text in place. Flicker-free. `containerID` + `containerName` must match or it silently does nothing. | boolean |
| `updateImageRawData` | Push pixels to an image container. | `success` / `imageException` / `imageSizeInvalid` / `imageToGray4Failed` / `sendFailed` |
| `shutDownPageContainer(mode)` | Exit. `1` = system exit dialog (required on root). `0` = immediate (internal pages only). | boolean |

([Page Lifecycle](https://hub.evenrealities.com/docs/build/page-lifecycle))

In-place update (what the loss meter will use most):
```ts
await bridge.textContainerUpgrade(new TextContainerUpgrade({
  containerID: 1,
  containerName: 'main',
  content: 'Updated text',
}))
```
([Display § In-place updates](https://hub.evenrealities.com/docs/build/display))

### 2.4 Refresh rate and update limits

Official:
- **No display refresh rate (Hz) is documented.** **[UNVERIFIED]**
- Full-screen image refresh ≈ **800 ms**. Image sends are paced at a **100 ms** floor (SDK 0.0.14+); extra calls are held, not dropped. ([Display § Image pacing](https://hub.evenrealities.com/docs/build/display), [FAQ](https://hub.evenrealities.com/docs/reference/faq))
- No animations; you can fake them by sequencing updates. ([FAQ](https://hub.evenrealities.com/docs/reference/faq))
- The official `asr` template debounces glasses text renders to **120 ms** because "the BLE queue can't keep up with per-token writes". ([asr README](https://github.com/even-realities/evenhub-templates/tree/main/asr))

**[COMMUNITY]** measurements (G2 fw 2.2.7.14, app 2.2.7, SDK 0.0.13) from [even-g2-notes/docs/performance.md](https://github.com/nickustinov/even-g2-notes/blob/main/docs/performance.md):
- `textContainerUpgrade` ≈ **83 ms** per call; `rebuildPageContainer` ≈ **165 ms** flat; `createStartUpPageContainer` ≈ 100–135 ms; `updateImageRawData` ≈ 104 ms + 3.9 ms/KB.
- Each call has a big fixed cost; payload size barely matters. **Fewer calls beats smaller calls.**
- Updating 1–2 text containers in place is cheaper than a rebuild; 3+ → a single rebuild is cheaper.
- Image "animation" tops out around **9 fps** for one container.

Practical rule for Riskavue: update the meter **on change, at most ~2–4 times per second**, one `textContainerUpgrade` per update, and never call image sends in parallel.

### 2.5 Input events

All events come through one subscription:
```ts
bridge.onEvenHubEvent(event => { /* event.textEvent | listEvent | sysEvent | audioEvent | menuItemClickEvent */ })
```
([Device APIs § Handling events](https://hub.evenrealities.com/docs/build/device-apis))

**Event types** (`OsEventTypeList`, full enum from the SDK 0.0.16 `index.d.ts`):

| Name | Value | Meaning |
| --- | --- | --- |
| `CLICK_EVENT` | 0 | Single press (temple or ring) |
| `SCROLL_TOP_EVENT` | 1 | Swipe up / scroll hit top |
| `SCROLL_BOTTOM_EVENT` | 2 | Swipe down / scroll hit bottom |
| `DOUBLE_CLICK_EVENT` | 3 | Double press |
| `FOREGROUND_ENTER_EVENT` | 4 | Came to the front (also when the OS menu opens) |
| `FOREGROUND_EXIT_EVENT` | 5 | Left the front (also when the OS menu closes) |
| `ABNORMAL_EXIT_EVENT` | 6 | Unexpected exit/disconnect |
| `SYSTEM_EXIT_EVENT` | 7 | System exit |
| `IMU_DATA_REPORT` | 8 | IMU sample |
| `LONG_PRESS_EVENT` | 9 | Long press started (SDK 0.0.14+, app 2.2.9+) |
| `LONG_PRESS_RELEASE_EVENT` | 10 | Long press released |

Values 0–3, 8–10 are in [Device APIs § Event types](https://hub.evenrealities.com/docs/build/device-apis); 4–5 are in [Contextual Menu](https://hub.evenrealities.com/docs/build/contextual-menu); 6–7 only in the SDK `.d.ts` (meaning of 6/7 is my reading of the names – **[UNVERIFIED]**).

**Where the event shows up** ([Device APIs § Event routing](https://hub.evenrealities.com/docs/build/device-apis)):
- Capture container is a **text** container → `event.textEvent` (`containerID`, `containerName`, `eventType`).
- Capture container is a **list** → `event.listEvent` (adds `currentSelectItemName`, `currentSelectItemIndex`).
- **Long press** always arrives on `event.sysEvent`.
- **Menu picks** arrive on `event.menuItemClickEvent` (`itemID`).

**Which input device?** `eventSource` (`EventSourceType` in the `.d.ts`):
`TOUCH_EVENT_FROM_GLASSES_R = 1`, `TOUCH_EVENT_FROM_RING = 2`, `TOUCH_EVENT_FROM_GLASSES_L = 3`. It lives on `Sys_ItemEvent`. Since SDK 0.0.15 long-press events keep `eventSource`. (SDK README + `index.d.ts` on npm.) The docs say temple and R1 events "carry distinct sources, so you can route glasses-vs-ring input to different handlers" ([Device APIs § Inputs](https://hub.evenrealities.com/docs/build/device-apis)). **[UNVERIFIED]** whether `textEvent` / `listEvent` (which have no `eventSource` field in the `.d.ts`) let you tell the ring apart – test on hardware.

**The R1 ring** has the **same gestures** as the temples: press, double press, swipe up, swipe down, long press and release. There is **no separate ring API** – same event names, different `eventSource`. ([Overview](https://hub.evenrealities.com/docs/get-started/overview), [Glossary](https://hub.evenrealities.com/docs/reference/glossary))

**No haptics** on glasses or ring. ([FAQ](https://hub.evenrealities.com/docs/reference/faq))

**Gotchas with taps (important):**
1. `CLICK_EVENT` is `0`, and protobuf drops zero values, so a tap often arrives with `eventType === undefined`. Treat a **present envelope with no `eventType` as a click**. ([First App](https://hub.evenrealities.com/docs/get-started/quickstart/first-app), template commit `8cb0135`)
2. In the simulator a tap arrives as `{"sysEvent":{"eventSource":1}}`; on hardware it may come as `textEvent`/`listEvent`. **Handle taps in all envelopes.** (template commit message; **[COMMUNITY]** [even-g2-notes input-events](https://github.com/nickustinov/even-g2-notes/blob/main/docs/input-events.md))
3. Check `DOUBLE_CLICK_EVENT` before the click fallback. (template)
4. Scroll events can fire fast – add a ~300 ms cooldown. **[COMMUNITY]** (even-g2-notes)
5. On real hardware, **list swipe direction is reversed** and cannot be changed. **[COMMUNITY]** ([cc-g2 known-limitations](https://github.com/wmoto-ai/cc-g2/blob/main/docs/known-limitations.md))
6. `currentSelectItemIndex` is missing for item 0 – track the index yourself. **[COMMUNITY]** (even-g2-notes)
7. "Tap then long press" opens the **OS contextual menu**, so a long press only reaches you when the OS doesn't claim it. Don't make long press the only way to do something. ([Device APIs § Long press](https://hub.evenrealities.com/docs/build/device-apis))

The pattern from the official template (copy this):
```ts
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

bridge.onEvenHubEvent(event => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)
  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)   // root page: system exit dialog
    return
  }
  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    // tap
  }
})
```
(https://github.com/even-realities/evenhub-templates/blob/main/minimal/src/main.ts)

Long press pair:
```ts
bridge.onEvenHubEvent(event => {
  const type = event.sysEvent?.eventType
  if (type === OsEventTypeList.LONG_PRESS_EVENT) pressStartedAt = Date.now()
  if (type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) fire(Date.now() - pressStartedAt)
})
```
([Device APIs § Long press](https://hub.evenrealities.com/docs/build/device-apis))

### 2.6 Contextual menu (your own items in the OS menu)

- Opened by the user with **tap then long press**. You add up to **10 action items**; each `itemName` ≤ **32 UTF-8 bytes** (keep it under ~16 ASCII chars); `itemID` non-zero and unique. SDK 0.0.14+, app 2.2.9+. ([Contextual Menu](https://hub.evenrealities.com/docs/build/contextual-menu))
- Items are fire-and-forget: one event, menu closes. Labels don't update unless you re-declare the menu.
- `rebuildPageContainer` **without** `menuObject` **clears** your items. Always pass it again.
- Opening the menu sends `FOREGROUND_ENTER_EVENT`, closing sends `FOREGROUND_EXIT_EVENT` – your app is still alive. Don't tear down state on those.
- Don't add your own "Exit" item; "Close [app name]" is a system slot.

```ts
await bridge.createStartUpPageContainer({
  containerTotalNum: 1,
  textObject: [{ /* ... */ isEventCapture: 1 }],
  menuObject: { menuItems: [ { itemName: 'Pause trading', itemID: 1 }, { itemName: 'Log note', itemID: 2 } ] },
})
bridge.onEvenHubEvent(e => { const id = e.menuItemClickEvent?.itemID; if (id) handlers[id]?.() })
```
([Contextual Menu](https://hub.evenrealities.com/docs/build/contextual-menu))

### 2.7 Microphone audio

```ts
import { AudioInputSource } from '@evenrealities/even_hub_sdk'
await bridge.audioControl(true, AudioInputSource.Glasses)  // start, G2 mics (default)
// await bridge.audioControl(true, AudioInputSource.Phone) // start, phone mic
await bridge.audioControl(false)                           // stop

bridge.onEvenHubEvent(event => {
  const audio = event.audioEvent
  if (!audio) return
  // audio.audioPcm: Uint8Array – PCM 16 kHz, signed 16-bit little-endian, mono
})
```
([Device APIs § Audio](https://hub.evenrealities.com/docs/build/device-apis))

- Format on both sources: **PCM 16 kHz, s16le, mono**. One stream from the 4-mic array. ([Device APIs](https://hub.evenrealities.com/docs/build/device-apis), [Overview](https://hub.evenrealities.com/docs/get-started/overview))
- Chunk size: **100 ms per event = 3,200 bytes = 1,600 samples** (stated for the simulator, "matches what the device emits"). ([Simulator § Audio](https://hub.evenrealities.com/docs/test/simulator))
- Glasses mic needs `createStartUpPageContainer` to have run first; otherwise `audioControl` returns `false`. (SDK README)
- Extra fields (SDK 0.0.14+): `direction` (raw int16 tag or `null`), `speakerRole` (`self`/`other`/`unknown`, an app-side guess). ([Changelog](https://hub.evenrealities.com/docs/reference/changelog))
- Permissions: `g2-microphone` for glasses, `phone-microphone` for phone. ([Device APIs](https://hub.evenrealities.com/docs/build/device-apis))
- The mic only captures while `audioControl(true)` is on. ([FAQ](https://hub.evenrealities.com/docs/reference/faq))
- There is **no speech-to-text in the SDK**. "Bring your own speech-to-text… send it to your own server (e.g. Whisper)." ([Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail))

**How to stream it:** forward each `audioPcm` chunk over a WebSocket (`wss://`, whitelisted) to our server, or buffer it and POST a WAV. The official `asr` template does exactly this shape: `sendPcm(chunk)` per event, `close()` at end, snapshots `{finalText, interimText, finished}` back. ([asr template](https://github.com/even-realities/evenhub-templates/tree/main/asr)). cc-g2 has working Groq (REST batch), OpenAI Realtime and Soniox (WebSocket) clients plus a PCM→WAV helper: `src/stt/*.ts`, `src/audio/wav.ts`. **[COMMUNITY]** ([cc-g2](https://github.com/wmoto-ai/cc-g2/tree/main/src))

### 2.8 Lifecycle: open, close, background

- **Open:** the app is launched from the phone app or (beta/published only) the glasses menu. `bridge.onLaunchSource(cb)` tells you `'appMenu'` or `'glassesMenu'`; it is pushed **once** after load, so subscribe early. (SDK README)
- **Close:** root-page double-tap → `shutDownPageContainer(1)` → system dialog. After confirm, the phone WebView must close too. ([App Submission § Exit](https://hub.evenrealities.com/docs/ship/app-submission))
- **Menu overlay:** `FOREGROUND_ENTER_EVENT`/`FOREGROUND_EXIT_EVENT` fire when the OS menu opens/closes. ([Contextual Menu](https://hub.evenrealities.com/docs/build/contextual-menu))
- **Background** ([Background & Lifecycle](https://hub.evenrealities.com/docs/build/background-lifecycle)):
  - iOS (WKWebView): keeps running; memory survives.
  - Android (Chromium): **may be suspended** under memory pressure → treat as a cold start.
  - `localStorage` always survives. WebSockets: iOS usually hold, Android usually drop. **Mic capture and location stop** if the WebView is suspended – re-start them when you come back.
  - The FAQ says "No" to network calls while backgrounded ([FAQ](https://hub.evenrealities.com/docs/reference/faq)). This conflicts a bit with the iOS row above. **[UNVERIFIED]** – plan for polling to pause.
- **Locked phone is the normal case.** Reviewers test with the phone locked; the core flow must work with glasses + ring only; app must survive 2 min idle and a 5-min lock. ([App Submission § Locked-phone](https://hub.evenrealities.com/docs/ship/app-submission))
- **Only one app on screen.** When the user switches away, your app can't show anything or pop up alerts. No push notifications. ([Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail), [FAQ](https://hub.evenrealities.com/docs/reference/faq))
- **Storage:** `bridge.setLocalStorage(key, value)` / `getLocalStorage(key)`, and the browser `localStorage` also works and survives suspend, kill and update (cleared on uninstall). ([Device APIs](https://hub.evenrealities.com/docs/build/device-apis), [FAQ](https://hub.evenrealities.com/docs/reference/faq))
- **Device status:** `getDeviceInfo()` and `onDeviceStatusChanged(cb)` give battery, wearing, charging, in-case, connect state. ([Device APIs](https://hub.evenrealities.com/docs/build/device-apis), SDK `.d.ts`)

---

## 3. Simulator

**Run it:**
```bash
evenhub-simulator http://localhost:5173          # or: npx evenhub-simulator ..., or npm run simulate
```
Options: `-g/--glow`, `--no-glow`, `-b/--bounce default|spring`, `--automation-port <port>`, `--list-audio-input-devices`, `--aid <device>`, `--print-config-path`, `-V`. ([Simulator](https://hub.evenrealities.com/docs/test/simulator))
Debug log: `RUST_LOG=debug evenhub-simulator http://localhost:5173`. Right-click the WebView window → **Inspect Element** for the console. (same)

**What it shows:** a 576×288 green canvas drawn with LVGL, plus your app's WebView (the phone-side page) in a window. It is **not** a hardware emulator: no real BLE timing, performance or permissions. ([Simulator § Not an emulator](https://hub.evenrealities.com/docs/test/simulator))

**What it simulates:**

| Feature | In the simulator? | Source |
| --- | --- | --- |
| Tap, double tap, swipe up/down | Yes – window controls: Up, Down, Click, Double Click | [Simulator § Caveats](https://hub.evenrealities.com/docs/test/simulator) |
| Long press + release | Yes (0.9.0+): hold the control or a keyboard shortcut | same |
| Contextual menu | Yes (0.9.0+), drawn and navigable, returns `menuItemClickEvent` | same |
| R1 ring as a separate source | **No.** `eventSource` is hard-coded to `1` (right temple) | [Changelog 0.6.1](https://hub.evenrealities.com/docs/reference/changelog) |
| Microphone | **Yes** – uses your computer's mic (`--aid` to pick one); 16 kHz s16le, 100 ms per event | [Simulator § Audio](https://hub.evenrealities.com/docs/test/simulator) |
| `textColor` levels | Yes, but not light-accurate | same |
| Device status / user events | **No** – hard-coded | same |
| Background / lock / real permissions | **No** | [Test](https://hub.evenrealities.com/docs/test/) |
| Emoji | Shows some (0.7.2) – **but the glasses can't render emoji** | [Changelog](https://hub.evenrealities.com/docs/reference/changelog), [FAQ](https://hub.evenrealities.com/docs/reference/faq) |
| Font/greyscale | Close, not pixel-perfect | [Simulator § Caveats](https://hub.evenrealities.com/docs/test/simulator) |

**Automation HTTP API** (start with `--automation-port 9898`) ([Simulator § Headless automation](https://hub.evenrealities.com/docs/test/simulator)):
- `GET /api/ping` → `pong`
- `GET /api/screenshot/glasses` → 576×288 RGBA PNG (keep RGBA; lit pixel = `alpha > 0`)
- `GET /api/screenshot/webview` → PNG of the phone-side page
- `GET /api/console?since_id=N`, `DELETE /api/console`
- `POST /api/input` with `{"action":"up|down|click|double_click|long_press|long_press_release|context_menu"}`
- Input is ignored until an event-capturing container exists – wait ~4 s or for a "ready" log line.

```bash
curl -X POST http://127.0.0.1:9898/api/input -H 'Content-Type: application/json' -d '{"action":"click"}'
```

**Recording a demo video:**
- Official: the simulator has a **screenshot button** that saves an RGBA PNG to the current folder (v0.5.0+), and `/api/screenshot/glasses`. Store screenshots should be taken this way. ([Simulator § Screenshot](https://hub.evenrealities.com/docs/test/simulator), [App Submission](https://hub.evenrealities.com/docs/ship/app-submission))
- **There is no built-in video recording.** I found none in the docs, the README or the CLI flags.
- The hackathon accepts a demo video **up to 3 minutes, in the simulator or on G2**. ([Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail))
- Suggested ways **[UNVERIFIED]**:
  1. Record the simulator window with OBS Studio, or GNOME's built-in screen recorder (Ctrl+Shift+Alt+R on many Ubuntu versions), or `ffmpeg -f x11grab` (X11 only; on Wayland use OBS with PipeWire).
  2. Script the taps with `POST /api/input` so the demo is the same every take, and record the window meanwhile.
  3. For crisp glasses-only footage: poll `/api/screenshot/glasses` ~10×/s into numbered PNGs, then `ffmpeg -framerate 10 -i frame_%05d.png -c:v libx264 -pix_fmt yuv420p glasses.mp4`. Flatten RGBA onto black first, or the background may come out wrong.
  4. Add voice in the demo by speaking into the laptop mic – the simulator feeds it to the app as `audioEvent`.
- **[UNVERIFIED]** Linux needs a desktop session with a webview runtime (the README says Linux uses WebKitGTK for webview screenshots); headless CI may need a virtual display.

---

## 4. Known limits and gotchas

| Topic | What to know | Source |
| --- | --- | --- |
| BLE throughput | **No official bytes/second figure.** Officially: image refresh ~800 ms, 100 ms image pacing, ASR template debounces text to 120 ms because the BLE queue can't keep up. Community: ~83 ms per text update, ~165 ms per rebuild. | [Display](https://hub.evenrealities.com/docs/build/display), [asr](https://github.com/even-realities/evenhub-templates/tree/main/asr), [COMMUNITY perf](https://github.com/nickustinov/even-g2-notes/blob/main/docs/performance.md) |
| Text vs bitmap | Text, list and image containers only. **No arbitrary pixel drawing**, no animation, images greyscale, max 4 images of 288×144. Big numbers or bars = Unicode blocks in text, or a rendered image. | [Device APIs § not exposed](https://hub.evenrealities.com/docs/build/device-apis), [Display](https://hub.evenrealities.com/docs/build/display) |
| Character limits | 1,000 chars per create/rebuild, 2,000 per text update; ~400–500 fit on screen; list 20×64; container name 16; menu item 32 bytes; app name 20. The simulator enforces a 999-byte text limit. | [Display](https://hub.evenrealities.com/docs/build/display), [Changelog](https://hub.evenrealities.com/docs/reference/changelog) |
| Glyphs | Unknown chars silently dropped; no emoji; font not monospaced. Safe set: `━ ─ █▇▆▅▄▃▂▁ ▲△▶▷▼▽◀◁ ●○ ■□ ★☆ ╭╮╯╰ │─`. | [Design Guidelines](https://hub.evenrealities.com/docs/build/design-guidelines) |
| Fixed-width columns | Font is proportional. Community trick: fullwidth chars (`０-９`, `　` space) line up. | **[COMMUNITY]** [even-g2-notes display.md](https://github.com/nickustinov/even-g2-notes/blob/main/docs/display.md) |
| CORS | Whitelist + correct CORS headers both needed. If you can't fix CORS, **proxy through your own server** and whitelist that. | [Networking](https://hub.evenrealities.com/docs/build/networking) |
| API keys | Never in the `.ehpk` – it can be unzipped. Use a server proxy. | [Packaging](https://hub.evenrealities.com/docs/ship/packaging) |
| Sign-in | Accounts for developers are made in the phone app, not the web hub. For **end-user** sign-in in our app: **Google sign-in does not work inside the WebView**; use a separate login page or a pairing code. | [Sign in](https://hub.evenrealities.com/docs/get-started/quickstart/sign-in), [Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail) (not in the Even docs) |
| User identity | `getUserInfo()` returns `uid, name, avatar, country`. The FAQ says name/email need a "user-info permission", but that permission name is **not** in the permission list. **[UNVERIFIED]** – test what it returns. Could be used to key a pairing code. | [Device APIs](https://hub.evenrealities.com/docs/build/device-apis), [FAQ](https://hub.evenrealities.com/docs/reference/faq) |
| Opening a browser | No `window.open(url, '_system')` equivalent yet – so an OAuth redirect flow is hard. | [FAQ](https://hub.evenrealities.com/docs/reference/faq) |
| Root double-tap | Must call `shutDownPageContainer(1)`. Mode 0 or a custom exit screen on root = rejection. | [App Submission](https://hub.evenrealities.com/docs/ship/app-submission) |
| No black screens | First launch must explain setup on the glasses. Remember setup in storage. | [App Submission](https://hub.evenrealities.com/docs/ship/app-submission) |
| Content rule | Review bans "financial advice". The hackathon also says paper trading / read-only, no user funds, no financial advice. Word warnings as **the user's own rules**, not advice. | [App Submission](https://hub.evenrealities.com/docs/ship/app-submission), [Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail) |
| `rebuildPageContainer` on hardware | One community app reports it **always returns `false`** on hardware but still must be called (it registers event routing), and falls back to `createStartUpPageContainer` (~3 s). Prefer `textContainerUpgrade` and a fixed layout. | **[COMMUNITY]** [cc-g2 known-limitations](https://github.com/wmoto-ai/cc-g2/blob/main/docs/known-limitations.md) |
| Slow awaits block taps | Awaiting `getAppLocation` before first paint left the glasses blank ~3 s; awaiting inside the event handler dropped taps. Paint first, fetch after. | **[COMMUNITY]** [perf notes](https://github.com/nickustinov/even-g2-notes/blob/main/docs/performance.md) |
| Dev logs | Phone app dev console in Developer Mode; don't log secrets. | [FAQ](https://hub.evenrealities.com/docs/reference/faq), [Beta Testing](https://hub.evenrealities.com/docs/test/beta-testing) |
| Version gate | If `min_app_version` > the user's app version, the plugin is blocked at open. SDK 0.0.16 → app 2.2.10. | [Versioning](https://hub.evenrealities.com/docs/reference/versioning), npm |

---

## 5. Open-source G2 apps worth copying patterns from

No public trading or "rule warning" app exists in the catalogue I could see ([catalogue](https://hub.evenrealities.com/catalogue), first page only). The closest ones:

1. **wmoto-ai/cc-g2** – approve/deny Claude Code permission prompts from G2 with **touch and voice**. This is the best **confirmation-dialog + voice reply** reference. MIT licence. 33★, active (pushed 24 Nov 2026).
   https://github.com/wmoto-ai/cc-g2
   - Look at: `src/g2/event-router.ts`, `src/g2/flows.ts`, `src/g2/screens/notification.ts` / `reply.ts` (approve/deny screens), `src/g2/recording.ts` + `src/audio/wav.ts` (mic → WAV), `src/stt/groq.ts` / `soniox-realtime.ts` (STT), `src/hub/sse-client.ts` (server push via SSE).
   - Read `docs/known-limitations.md` (list swipe reversed, rebuild fails on hardware).

2. **fabioglimb/even-market** ("ER Market") – real-time **stock / forex / crypto watchlist** and candlestick charts on G2. 10★. **No licence file** → read for ideas only, don't copy code.
   https://github.com/fabioglimb/even-market
   - Pattern: market data via a **Cloudflare Worker proxy** (fixes CORS, no key in the app); `src/data/poller.ts` (polling 5–60 s); `src/input/action-map.ts` (one function turns any SDK event into an app action, with tap/scroll debounce from `even-toolkit/gestures`); `src/state/alert-utils.ts` (price alerts).
   - Its `app.json` shows a real multi-origin whitelist.

3. **nickustinov/weather-even-g2** – polished glanceable app. 27★. **No licence file** → ideas only.
   https://github.com/nickustinov/weather-even-g2
   - Pattern: **big "dotted LED" digits rendered as an image** (`g2/dot-digits.ts`) – good for a big daily-loss number; `g2/events.ts` (event normalising); `onForegroundEnter` refresh in `g2/app.ts`; no backend because Open-Meteo is CORS-enabled.

Also useful:
- **even-realities/evenhub-templates** (MIT, official) – `minimal` for input handling, `asr` for mic → STT wiring. https://github.com/even-realities/evenhub-templates
- **fabioglimb/even-toolkit** (MIT, 101★; npm `even-toolkit` 1.7.7) – helpers for gestures debounce, keep-alive, pagination, text measurement. Linked from the official [Learn page](https://hub.evenrealities.com/docs/learn/). https://github.com/fabioglimb/even-toolkit
- **nickustinov/even-g2-notes** – the community reference the official docs link to. https://github.com/nickustinov/even-g2-notes
- **even-realities/everything-evenhub** – official Claude Code plugin (13 skills incl. `handle-input`, `glasses-ui`, `font-measurement`, `simulator-automation`). Install: `/plugin marketplace add even-realities/everything-evenhub` then `/plugin install everything-evenhub`. ([Claude Code page](https://hub.evenrealities.com/docs/learn/claude-code))
- Heads-up: **pikrimahardhika-alt/even-market-glance** – "Even G2 Market Glance pre-hackathon prototype" (pushed 20 Nov 2026). Likely another entrant in this same hackathon in the trading space. https://github.com/pikrimahardhika-alt/even-market-glance

---

## 6. Design guidance for a glanceable monochrome UI

From the official docs:
- Design in greys; the hardware shows them as green. Black = transparent (the user sees the world through it). ([Design Guidelines](https://hub.evenrealities.com/docs/build/design-guidelines), [Video EP11](https://hub.evenrealities.com/docs/learn/videos))
- **No background fill.** Structure comes only from borders, text and images. ([Design Guidelines](https://hub.evenrealities.com/docs/build/design-guidelines))
- "Hierarchy comes from position and spacing, and border brightness is your only colour control." Since SDK 0.0.14 you also have `textColor` 0–4 for dim secondary text. ([Video EP11](https://hub.evenrealities.com/docs/learn/videos), [Display § Text brightness](https://hub.evenrealities.com/docs/build/display))
- Design around **one** active input target. ([Design Guidelines](https://hub.evenrealities.com/docs/build/design-guidelines))
- Official patterns ([Design Guidelines § Common UI patterns](https://hub.evenrealities.com/docs/build/design-guidelines)):

| Pattern | How |
| --- | --- |
| Fake buttons | Prefix text with `>` as a cursor |
| Selection highlight | Toggle `borderWidth` on a text container |
| Multi-row layout | Stack text containers, e.g. 3 × 96 px |
| Progress bars | `━` and `─` (also `█▇▆▅▄▃▂▁`) |
| Page flipping | Pre-split text at ~400–500 chars |

- Menu labels: verbs ("Restart", "Mute"), not state readouts; under ~16 chars; 5–6 items max. ([Contextual Menu § Design notes](https://hub.evenrealities.com/docs/build/contextual-menu))
- Hackathon guidance: "**one thing on screen and a few words**. Think 'trading session'… not dashboards." Judging: 30% usefulness at a glance, 25% "read and write" (a short phrase, one tap or the ring). ([Hackathon rules](https://dorahacks.io/hackathon/even-realities/detail))
- Full official Figma: [Even Realities Software Design Guidelines](https://www.figma.com/design/X82y5uJvqMH95jgOfmV34j/Even-Realities---Software-Design-Guidelines--Public-?node-id=2922-80782) (not opened – Figma needs a browser; **[UNVERIFIED]** content).
- Icons: store icon is 24×24, 1-bit, built from 2×2 blocks, colour `#F4F4F4` or transparent. ([Design Guidelines § Store icon](https://hub.evenrealities.com/docs/build/design-guidelines), [CLI Apps § Icon rules](https://hub.evenrealities.com/docs/cli/apps))

What this means for Riskavue (my suggestions, not from the docs):
- Home screen = 2–3 text containers: a big loss meter line (`━━━━━━──── 62%` + `-$310 / $500`), one rule status line, one hint line in dim `textColor: 2`.
- Update the meter with `textContainerUpgrade` only; keep the layout fixed so we never need `rebuildPageContainer` in the hot path.
- **Confirm = single tap.** Swipe up/down = choose. **Double-tap on home = exit dialog** (required). On a warning screen (not root), double-tap can mean "cancel/back".
- Voice confirm: tap to start `audioControl(true)`, tap again (or ~3 s silence) to stop and send. Show "● Listening" while on.
- Put "Pause for today" and "Log note" in the contextual menu as extra shortcuts, never as the only path.

---

## 7. Things I could not verify

- Real display refresh rate (Hz) and BLE bytes/second – not published.
- Line height and characters per line of the firmware font.
- Whether the network whitelist applies during QR sideload and in the simulator.
- Whether `textEvent`/`listEvent` taps tell the R1 ring apart from the temple (only `sysEvent.eventSource` is documented).
- Exact meaning of `ABNORMAL_EXIT_EVENT` (6) and `SYSTEM_EXIT_EVENT` (7) – only names in the `.d.ts`.
- Whether `getUserInfo()` needs a permission and what it returns by default.
- Video-recording steps in §3 (my suggestions; the simulator has screenshots only).
- The scaffold commands in §1.6 were not executed (research only, nothing installed).
- The Figma design file content.
