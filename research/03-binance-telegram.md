# 03 – Binance testnet + Telegram bot research (for Riskavue)

Researched on 24 Nov 2026. Sources: the official Binance developer docs (`developers.binance.com`, fetched with `r.jina.ai`), the Binance support FAQ, the official npm packages (I downloaded the tarballs and read the code and `.d.ts` files; nothing was installed), `core.telegram.org`, `grammy.dev`, OpenAI and Deepgram docs/pricing pages. No accounts were made and no project code was written.

How to read this file:
- Every fact has a source link next to it.
- **[UNVERIFIED]** means I could not confirm it in an official source today, or I am inferring it.
- Short links used below:
  - **GI** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/general-info
  - **ACCT** = https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/account
  - **TRADE** = https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/trade
  - **UDS-REST** = https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/user-data-streams
  - **UDS** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/user-data-streams
  - **WS-NOTICE** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Important-WebSocket-Change-Notice
  - **WS-CONNECT** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-market-streams/Connect
  - **WS-API** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/websocket-api-general-info
  - **CHANGELOG** = https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/change-log
  - **TGAPI** = https://core.telegram.org/bots/api

---

## 0. The short version

- **Use USDⓈ-M Futures "Demo Trading" (the futures testnet).** It has leverage, positions, stop orders, mark price and a "Reset funds" button. That matches how crypto prop firms work. Spot testnet has no leverage and no positions.
- **Futures testnet REST base: `https://demo-fapi.binance.com`. WebSocket base: `wss://demo-fstream.binance.com`.** (GI, "Testnet API Information"). The older host `testnet.binancefuture.com` is still in the official SDK, see §1.3.
- **Keys: normal HMAC-SHA256 keys work for every REST call.** Ed25519 is only *required* if you want `session.logon` on the WebSocket API. We don't need that. (GI, WS-API)
- **Big 2025 change: stop-loss orders moved to a new endpoint.** Since 9 Dec 2025, `STOP_MARKET` / `TAKE_PROFIT_MARKET` / `STOP` / `TAKE_PROFIT` / `TRAILING_STOP_MARKET` must go to **`POST /fapi/v1/algoOrder`** (with `triggerPrice`, not `stopPrice`). Sending them to `/fapi/v1/order` gives error `-4120 STOP_ORDER_SWITCH_ALGO`. They show up in the user stream as **`ALGO_UPDATE`**, not `ORDER_TRADE_UPDATE`. (CHANGELOG 2025-11-06, TRADE)
- **Big 2026 change: futures WebSocket URLs now need a route**: `/public`, `/market` or `/private`. Old un-routed URLs were switched off on 2026-04-23. Mark price lives on `/market`, user data on `/private`. (WS-NOTICE)
- **Futures listenKey is NOT deprecated** (it is on Spot, not on Futures). `POST /fapi/v1/listenKey`, keep alive with `PUT` every < 60 min. (UDS)
- **Library: plain `fetch` + `node:crypto` HMAC + the `ws` package.** About 40 lines. We need ~10 endpoints and full control of the demo URLs. The official SDK (`@binance/derivatives-trading-usds-futures` v39.0.5) is fine but its testnet constants point at the older hosts.
- **Telegram: grammY 1.48.0** (published 22 Nov 2026), long polling (`bot.start()`), inline keyboard with Confirm/Cancel, always call `answerCallbackQuery`.
- **Speech-to-text: Deepgram Nova-3 streaming** takes raw 16 kHz PCM as-is (`encoding=linear16&sample_rate=16000`), $0.0048/min, $200 free credit. OpenAI's new `gpt-transcribe` is $0.0045/min but needs a WAV file (or 24 kHz PCM in Realtime). `whisper-1` is deprecated (shuts down 26 Feb 2027).

---

## 1. Binance testnets

### 1.1 Spot testnet vs Futures testnet

| | Spot testnet | USDⓈ-M Futures testnet (Demo Trading) |
| --- | --- | --- |
| Website to get keys | https://testnet.binance.vision/ ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | https://demo.binance.com → API Management ([Futures Quick Start](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/quick-start), [Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd)) |
| REST base | `https://testnet.binance.vision/api` ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | `https://demo-fapi.binance.com` (GI) |
| WebSocket streams | `wss://stream.testnet.binance.vision/ws` and `/stream` ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | `wss://demo-fstream.binance.com` (GI) |
| WebSocket API | `wss://ws-api.testnet.binance.vision/ws-api/v3` ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | `wss://testnet.binancefuture.com/ws-fapi/v1` (WS-API) – note: different host, see §1.3 |
| Leverage, positions, liquidation price | No | Yes |
| Stop-loss that closes a position | Only spot stop-limit / OCO | `STOP_MARKET` with `closePosition=true` via `/fapi/v1/algoOrder` (TRADE) |
| Free funds | Auto balance in many assets on sign-up ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | Virtual funds; **[Reset]** button under Assets, per account (Spot / Futures) ([Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd)) |
| Resets | ~once a month, no warning; all orders wiped; API keys kept ([source](https://developers.binance.com/en/docs/products/spot/testnet/general-info)) | You reset it yourself (must cancel open orders first) ([Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd)). Automatic resets: **[UNVERIFIED]** |
| Who can use it | Anyone with a GitHub login **[UNVERIFIED – login method from memory]** | Needs a Binance account; "available to users in certain countries and regions only" ([Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd)) |

**Recommendation: Futures Demo Trading.** Crypto prop firms (and their rules: daily loss limit, max drawdown, max risk per trade) are built around leveraged futures. Only the futures testnet gives us positions, unrealized PnL, mark price and real stop-market orders.

**Risk to check on day 1:** Demo Trading is region-limited. If the Binance account can't open it, the fallback is the Spot testnet (with a simpler "spot only" demo). Check this first.

### 1.2 How to get Futures demo API keys

1. Log in to a Binance account at https://demo.binance.com (or Binance → More → Demo Trading). ([Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd))
2. Open API Management (account icon top right) and pick **[Create API]**, give it a name. ([Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd))
3. Enable Futures trading permission on the key (default is "Enable Reading" only). ([Quick Start § API Key Restrictions](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/quick-start))
4. The futures testnet is "only available via the API" + demo website. ([Quick Start § Futures Testnet](https://developers.binance.com/en/docs/products/derivatives-trading-usds-futures/quick-start))

Exact button names on the demo site for system-generated (HMAC) vs self-generated (Ed25519/RSA) keys: **[UNVERIFIED]**.

### 1.3 Base URLs – the full picture (there are two hosts)

| What | Docs say (GI / WS-API) | Official JS SDK constants (`@binance/common` 2.5.4, read from the tarball) |
| --- | --- | --- |
| REST | `https://demo-fapi.binance.com` | `..._REST_API_DEMO_URL = https://demo-fapi.binance.com` and `..._REST_API_TESTNET_URL = https://testnet.binancefuture.com` |
| WS streams | `wss://demo-fstream.binance.com` | `..._WS_STREAMS_TESTNET_URL = wss://fstream.binancefuture.com` |
| WS API | `wss://testnet.binancefuture.com/ws-fapi/v1` | `..._WS_API_TESTNET_URL = wss://testnet.binancefuture.com/ws-fapi/v1` |
| Production (never use) | `https://fapi.binance.com`, `wss://fstream.binance.com` | same |

What this means for us: use **`demo-fapi` + `demo-fstream`** (what the docs say today). Keys made on demo.binance.com are for these hosts. Whether the same key also works on `testnet.binancefuture.com`: **[UNVERIFIED]**. Whether the `/private` and `/market` routes (§3) also apply on `demo-fstream`: **[UNVERIFIED]**. Try `wss://demo-fstream.binance.com/market/ws/btcusdt@markPrice@1s` first, and fall back to `wss://demo-fstream.binance.com/ws/btcusdt@markPrice@1s`.

### 1.4 HMAC or Ed25519?

| Key type | REST | WS API `session.logon` | Source |
| --- | --- | --- | --- |
| HMAC-SHA256 (Binance makes the secret) | Yes | No | GI § SIGNED Endpoint Security, WS-API |
| RSA (PKCS#8) | Yes | No | GI § RSA Keys |
| Ed25519 | Yes **[UNVERIFIED for futures REST, the SDK says it supports "RSA or ED25519"]** | **Yes, only Ed25519** | WS-API ("Only Ed25519 keys are supported for this feature"), [SDK README](https://github.com/binance/binance-connector-js/tree/master/clients/derivatives-trading-usds-futures) |

**Use HMAC.** We use REST for orders and a listenKey for the user stream. Neither needs Ed25519.

How HMAC signing works (GI § SIGNED):
- Put all params into one `a=1&b=2` string, add `timestamp` (ms) and optional `recvWindow` (default 5000, max 60000).
- `signature = HMAC_SHA256(secret, thatString)` in hex. Put `signature` **last**.
- Send the key in the header `X-MBX-APIKEY`.

```ts
import { createHmac } from "node:crypto";

const BASE = "https://demo-fapi.binance.com";
async function signed(method: "GET"|"POST"|"PUT"|"DELETE", path: string, params: Record<string, string|number|boolean> = {}) {
  const qs = new URLSearchParams({ ...params, timestamp: String(Date.now() + clockOffset), recvWindow: "5000" } as any).toString();
  const sig = createHmac("sha256", process.env.BINANCE_SECRET!).update(qs).digest("hex");
  const res = await fetch(`${BASE}${path}?${qs}&signature=${sig}`, { method, headers: { "X-MBX-APIKEY": process.env.BINANCE_KEY! } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`); // body = {code, msg}
  return body;
}
```

---

## 2. Endpoints we need (USDⓈ-M Futures)

All paths are relative to `https://demo-fapi.binance.com`. All are signed (`timestamp` + `signature`) unless noted.

### 2.1 Reading the account

| Need | Method + path | Key params | Key response fields | Weight | Source |
| --- | --- | --- | --- | --- | --- |
| Equity / balance | `GET /fapi/v3/account` | `timestamp`, `recvWindow` | `totalWalletBalance`, `totalUnrealizedProfit`, `totalMarginBalance` (= wallet + unrealized, i.e. **equity**), `availableBalance`, `totalMaintMargin`, `assets[]`, `positions[]` (`symbol`, `positionAmt`, `unrealizedProfit`, `notional`) | 5 | ACCT § Account Information V3 |
| Older version | `GET /fapi/v2/account` | same | same totals, more per-position fields | – | ACCT (V2 is still listed) |
| Positions (detail) | `GET /fapi/v3/positionRisk` | `symbol` (optional) | `positionAmt`, `entryPrice`, `breakEvenPrice`, `markPrice`, `unRealizedProfit`, `liquidationPrice`, `notional`, `positionSide`. Only symbols with a position or open order are returned. | 5 | TRADE § Position Information V3 |
| Open normal orders | `GET /fapi/v1/openOrders` | `symbol` (optional) | order list | 1 with symbol, **40 without** | TRADE § Current All Open Orders |
| Open stop/TP orders | `GET /fapi/v1/openAlgoOrders` | `symbol` (optional) | algo order list | 1 with symbol, 40 without | TRADE § Current All Algo Open Orders |
| Realized PnL "today" | `GET /fapi/v1/income` | `incomeType` (`REALIZED_PNL`, `COMMISSION`, `FUNDING_FEE`, …), `startTime`, `endTime`, `limit` (max 1000, default 100), `symbol` | `incomeType`, `income`, `asset`, `time`, `tranId`, `tradeId` | **30** | ACCT § Get Income History |
| Server time | `GET /fapi/v1/time` (not signed) | – | `serverTime` | – | **[UNVERIFIED – path from memory; it is listed as "Check Server Time" in the Market Data menu]** |

Notes on `/fapi/v1/income` (ACCT):
- No `startTime`/`endTime` → last 7 days only. Data is kept 3 months.
- No `incomeType` → all types. To get "today's net" call it once with no type and sum `REALIZED_PNL + COMMISSION + FUNDING_FEE`, with `startTime` = start of the trading day in ms.
- Weight 30 is heavy. Call it **once at startup**, then keep the number up to date from the user data stream (§3).

How Riskavue can compute the numbers:
- **Equity** = `totalMarginBalance` (wallet balance + unrealized PnL).
- **Daily PnL** = equity now − equity snapshot at the day's reset time (most prop firms reset at 00:00 UTC or 17:00 New York – make it a setting). Cross-check with the income sum.
- **Per-trade risk** = `|entryPrice − stop triggerPrice| × |positionAmt|` (+ fees). Risk % = that / equity at day start.
- **Live unrealized PnL** per position = `(markPrice − entryPrice) × positionAmt` (positionAmt is negative for shorts), using the mark price stream (§3.4).

### 2.2 Placing orders

**Entry order (market or limit): `POST /fapi/v1/order`** (TRADE § New Order)

| Param | Value |
| --- | --- |
| `symbol` | `BTCUSDT` |
| `side` | `BUY` / `SELL` |
| `type` | `MARKET` or `LIMIT` (STOP types are blocked here now, see below) |
| `quantity` | required for both |
| `price`, `timeInForce=GTC` | required for `LIMIT` |
| `positionSide` | `BOTH` in one-way mode (default); `LONG`/`SHORT` only in hedge mode |
| `reduceOnly` | `true`/`false`, not allowed in hedge mode |
| `newClientOrderId` | our own id, `^[\.A-Z\:/a-z0-9_-]{1,36}$` – use it to avoid double orders |
| `newOrderRespType` | `ACK` (default) or `RESULT` (MARKET returns the final FILLED result) |

Rate cost: 1 on the 10-second and 1-minute order counters, 0 IP weight. (TRADE)

**Stop-loss / take-profit: `POST /fapi/v1/algoOrder`** (TRADE § New Algo Order)

| Param | Value |
| --- | --- |
| `algoType` | `CONDITIONAL` (required) |
| `symbol`, `side` | `side` is the **closing** side (SELL to stop a long) |
| `type` | `STOP_MARKET` (stop-loss) or `TAKE_PROFIT_MARKET`; also `STOP`, `TAKE_PROFIT`, `TRAILING_STOP_MARKET` |
| `triggerPrice` | the stop price (**new name, not `stopPrice`**) |
| `closePosition` | `true` = close the whole position when triggered. Can't be sent with `quantity` or `reduceOnly`. |
| or `quantity` + `reduceOnly=true` | stop a part of the position |
| `workingType` | `MARK_PRICE` or `CONTRACT_PRICE` (default). **Use `MARK_PRICE`** for prop-style rules. |
| `priceProtect` | `true` to block triggers when mark and last price differ too much |
| `clientAlgoId` | our own id |

Response: `algoId`, `clientAlgoId`, `algoStatus` (`NEW`), `triggerPrice`, `orderType`, … (TRADE). Limit: 200 conditional orders across all symbols (CHANGELOG 2025-12-29).

Why this matters: "Effective on 2025-12-09, USDⓈ-M Futures will migrate conditional orders to the Algo Service … `STOP_MARKET`/`TAKE_PROFIT_MARKET`/`STOP`/`TAKE_PROFIT`/`TRAILING_STOP_MARKET` … error code `-4120` STOP_ORDER_SWITCH_ALGO" (CHANGELOG 2025-11-06). Most blog posts and older libraries still show `stopPrice` on `/fapi/v1/order` – that is out of date.

```ts
// 1) entry
await signed("POST", "/fapi/v1/order", { symbol: "BTCUSDT", side: "BUY", type: "MARKET", quantity: "0.002", newClientOrderId: "rk-entry-123" });
// 2) protective stop for the whole position
await signed("POST", "/fapi/v1/algoOrder", { algoType: "CONDITIONAL", symbol: "BTCUSDT", side: "SELL", type: "STOP_MARKET",
  triggerPrice: "93500", closePosition: "true", workingType: "MARK_PRICE", clientAlgoId: "rk-sl-123" });
```

**Dry-run: `POST /fapi/v1/order/test`** – same params as New Order; "this order will not be submitted to matching engine". (TRADE § Test Order). There is no test endpoint for algo orders **[UNVERIFIED – none found in the docs]**.

### 2.3 Cancelling and moving a stop

| Need | Method + path | Params | Source |
| --- | --- | --- | --- |
| Cancel a normal order | `DELETE /fapi/v1/order` | `symbol` + (`orderId` or `origClientOrderId`) | TRADE § Cancel Order |
| Cancel all normal orders | `DELETE /fapi/v1/allOpenOrders` | `symbol` | TRADE |
| Cancel a stop/TP | `DELETE /fapi/v1/algoOrder` | `algoId` or `clientAlgoId` | TRADE § Cancel Algo Order |
| Cancel all stops/TPs | `DELETE /fapi/v1/algoOpenOrders` | `symbol` | TRADE / CHANGELOG 2025-11-06 |
| Modify an order | `PUT /fapi/v1/order` | `symbol`, `side`, `quantity`, `price`, `orderId`/`origClientOrderId`. **"currently only LIMIT order modification is supported"** | TRADE § Modify Order |
| Close position now | `POST /fapi/v1/order` with `type=MARKET`, opposite side, `quantity=|positionAmt|`, `reduceOnly=true` | | TRADE |

**Moving a stop = place new, then cancel old.** There is no "modify" for algo orders. Do it in this order so the position is never unprotected:
1. `POST /fapi/v1/algoOrder` with the new `triggerPrice` (new `clientAlgoId`).
2. If OK → `DELETE /fapi/v1/algoOrder` the old `algoId`.
3. If step 1 fails → keep the old stop and warn the user.

(With `closePosition=true` two stops can live at the same time; whichever triggers first closes the position. **[UNVERIFIED – the docs don't say if two closePosition stops on the same side are allowed; test on day 1.]**)

Nice extra: reduce-only / close-position orders are exempt from the `-1008` overload throttle, so risk-reducing actions still go through in a busy market. (GI § HTTP 503)

---

## 3. Real-time data

### 3.1 User data stream with listenKey (futures – still the way to do it)

| Step | Call | Source |
| --- | --- | --- |
| Create | `POST /fapi/v1/listenKey` (API key header only, no signature) → `{ "listenKey": "..." }`. If one is active you get the same key back, extended 60 min. | UDS-REST § Start User Data Stream |
| Keep alive | `PUT /fapi/v1/listenKey` every ~30–50 min. Key dies 60 min after the last keepalive. Error `-1125` "This listenKey does not exist" → create a new one. | UDS, UDS-REST |
| Close | `DELETE /fapi/v1/listenKey` | UDS-REST |
| Connect (prod docs) | `wss://fstream.binance.com/private/ws?listenKey=<key>&events=ORDER_TRADE_UPDATE/ACCOUNT_UPDATE/ALGO_UPDATE` or `wss://fstream.binance.com/private/ws/<listenKey>` | WS-NOTICE, UDS |
| Connect (demo) | `wss://demo-fstream.binance.com/private/ws/<listenKey>` **[UNVERIFIED – route on demo]**, fallback `wss://demo-fstream.binance.com/ws/<listenKey>` | GI + WS-NOTICE |

Other connection rules (WS-CONNECT, UDS):
- A connection lives max 24 h – reconnect on close.
- Server pings every 3 min; reply pong within 10 min (the `ws` package does this for you).
- Max 10 incoming messages per second per connection.
- Same event type is strictly ordered by `E` and `T`; use `E` to order across types.
- Docs recommend using the stream, not REST polling, for orders/positions in volatile markets.

### 3.2 2025–2026 changes to know

| Date | Change | Source |
| --- | --- | --- |
| 2025-04-07 (Spot only) | **Spot** listenKey on `stream.binance.com` deprecated → use WebSocket API `userDataStream.subscribe` (needs Ed25519 + `session.logon`), or `userDataStream.subscribe.signature` (no logon). Docs for spot listenKey removed 2025-10-24. | [Spot CHANGELOG](https://developers.binance.com/en/docs/products/spot/CHANGELOG) |
| Futures | listenKey still documented and supported: `POST/PUT/DELETE /fapi/v1/listenKey` (page last modified Nov 2026). | UDS-REST |
| 2025-12-09 | Conditional orders moved to Algo Service; new event `ALGO_UPDATE`; WS API methods `algoOrder.place` / `algoOrder.cancel`. | CHANGELOG 2025-11-06 |
| 2025-12-15 | `CONDITIONAL_ORDER_TRIGGER_REJECT` event deprecated – rejection reasons now inside `ALGO_UPDATE`. | CHANGELOG 2025-12-10 |
| 2026-03-05 → 2026-04-23 | New routed WS URLs `/public`, `/market`, `/private`. Old `wss://fstream.binance.com/ws` and `/stream` decommissioned 2026-04-23. **Un-routed connections only get `/public` data – `markPrice` and user data go silent.** | WS-NOTICE |
| 2026-08-07 / 2026-08-21 | `ALGO_UPDATE` got an `ia` field (trailing stop "is activated"). | CHANGELOG |
| WS API | `wss://ws-fapi.binance.com/ws-fapi/v1` (testnet `wss://testnet.binancefuture.com/ws-fapi/v1`); `session.logon` / `session.status` / `session.logout`; Ed25519 only for logon; connection valid 24 h. You still need a **separate** connection for user data streams. | WS-API |

### 3.3 Events and their fields

Field **names** below are verified from the official SDK types (`@binance/derivatives-trading-usds-futures` 39.0.5, `index.d.ts`) and the event list on UDS. The per-field event pages did not render, so the **meanings** are from my knowledge of Binance's docs – **[UNVERIFIED meanings, names verified]**.

**`ACCOUNT_UPDATE`** – pushed when balance or position changes (fills, funding, transfers). Not pushed for unfilled/cancelled orders. Only changed positions are included. (UDS § Balance and Position Update)

| Field | Meaning |
| --- | --- |
| `e`, `E`, `T` | event type, event time, transaction time |
| `a.m` | reason: `ORDER`, `FUNDING_FEE`, `DEPOSIT`, `WITHDRAW`, `ADJUSTMENT`, … (list verified on UDS) |
| `a.B[]` | balances: `a` asset, `wb` wallet balance, `cw` cross wallet balance, `bc` balance change except PnL and commission (`bc` meaning verified on UDS) |
| `a.P[]` | positions: `s` symbol, `pa` position amount, `ep` entry price, `bep` break-even price, `cr` accumulated realized, `up` unrealized PnL, `mt` margin type, `iw` isolated wallet, `ps` position side |

**`ORDER_TRADE_UPDATE`** – every new order and status change for normal orders (and for the market order a stop creates when it triggers). Field `o` holds:

| Field | Meaning |
| --- | --- |
| `s`, `c`, `S`, `o`, `f` | symbol, client order id, side, order type, time in force |
| `q`, `p`, `ap`, `sp` | orig qty, price, average price, stop price |
| `x`, `X` | execution type (`NEW`, `TRADE`, `CANCELED`, `EXPIRED`, …), order status (`NEW`, `PARTIALLY_FILLED`, `FILLED`, …) |
| `i`, `l`, `z`, `L` | order id, last filled qty, cumulative filled qty, last filled price |
| `N`, `n` | commission asset, commission |
| `T`, `t` | trade time, trade id |
| `R`, `cp`, `ps` | reduce only, close position, position side |
| **`rp`** | **realized profit of this trade** – add to today's PnL on every `TRADE` |
| `wt`, `ot`, `pP`, `V`, `pm`, `gtd`, `er` | working type, original type, price protect, STP mode, price match, good-till date, expire reason |

**`ALGO_UPDATE`** – stop / TP orders (new since Dec 2025). Fields in `o` (SDK `AlgoUpdateO`): `caid` client algo id, `aid` algo id, `at` algo type, `o` order type, `s`, `S`, `ps`, `f`, `q`, `X` algo status, `tp` trigger price, `p` price, `wt`, `cp` close position, `pP`, `R`, `tt` trigger time, `ai` id of the order created on trigger, `ap`/`aq` its avg price/qty, `rm` reject message, `ia` activated (trailing only), `gtd`, … Status values (`NEW`, `CANCELED`, `TRIGGERED`, `FINISHED`, `REJECTED`, `EXPIRED`) **[partly UNVERIFIED – `CANCELED/TRIGGERED/FINISHED` are named in TRADE § Query All Algo Orders]**.

Also useful: `MARGIN_CALL` (risk too high), `ACCOUNT_CONFIG_UPDATE` (leverage change), `listenKeyExpired`. (UDS, CHANGELOG)

### 3.4 Mark price stream (for the live daily-loss meter)

- Stream: `<symbol>@markPrice` (every 3 s) or `<symbol>@markPrice@1s` (every 1 s). All symbols: `!markPrice@arr@1s`. ([Mark Price Stream](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market#mark-price-stream))
- **Lives under `/market`**: `wss://fstream.binance.com/market/ws/btcusdt@markPrice@1s`, or combined `.../market/stream?streams=btcusdt@markPrice@1s/ethusdt@markPrice@1s`. Symbols lowercase. (WS-NOTICE, WS-CONNECT)
- Payload: `e`=`markPriceUpdate`, `E`, `s`, **`p` mark price**, `i` index price, `P` est. settle price, `r` funding rate, `T` next funding time. ([Mark Price Stream](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/ws-streams/market#mark-price-stream))

Live loop:
1. Startup: REST `GET /fapi/v3/account` + `/fapi/v3/positionRisk` + `/fapi/v1/openAlgoOrders` + `/fapi/v1/income` (today) → initial state.
2. `/private` stream: `ACCOUNT_UPDATE` updates wallet balance and positions; `ORDER_TRADE_UPDATE` adds `rp − n` to realized today; `ALGO_UPDATE` tracks stops.
3. `/market` stream `@markPrice@1s` for each open symbol → recompute unrealized PnL → equity → daily loss % → push to glasses / Telegram if over a threshold.
4. Every ~5 min re-sync with REST `/fapi/v3/account` (weight 5) to fix any drift.

---

## 4. Rate limits and pitfalls

| Topic | What to know | Source |
| --- | --- | --- |
| Where limits come from | `GET /fapi/v1/exchangeInfo` → `rateLimits` (types `REQUEST_WEIGHT`, `ORDER`, `RAW_REQUEST`). | GI § LIMITS |
| Current numbers | 2400 weight/min per IP, 1200 orders/min and 300 orders/10 s per account are the long-standing values. **[UNVERIFIED – read exchangeInfo]** | – |
| Headers | `X-MBX-USED-WEIGHT-1M` (IP), `X-MBX-ORDER-COUNT-10S` / `-1M` (account). | GI |
| 429 / 418 | 429 = slow down. Ignoring 429 → 418 IP ban, 2 min up to 3 days. IP limits are per IP, not per key. | GI |
| 503 "Unknown error…" | Order **may have gone through**. Don't resend blindly – check by `newClientOrderId` or the user stream. | GI § HTTP 503 |
| `-1008` throttle | Overload. Retry with backoff. Reduce-only / close-position orders are exempt. | GI |
| Timestamp | Signed requests need `timestamp` (ms). Default `recvWindow` 5000, max 60000. Laptop clock drift → error `-1021` **[UNVERIFIED code from memory]**. Fix: on startup read server time and keep a `clockOffset`. | GI § Timing Security, ACCT (max 60000) |
| WS limits | 10 incoming msgs/s per connection, max 1024 streams, 24 h max life. | WS-CONNECT |
| Un-routed WS URL | Mark price / user data silently stop if you forget `/market` or `/private`. | WS-NOTICE |
| Old stop endpoint | STOP_MARKET on `/fapi/v1/order` → `-4120`. Use `/fapi/v1/algoOrder`. | CHANGELOG 2025-11-06 |
| `stopPrice` vs `triggerPrice` | Algo orders use `triggerPrice`. | TRADE |
| Hedge mode | In hedge mode `positionSide` is required and `reduceOnly` is not allowed. Keep the demo account in **one-way mode** (`POST /fapi/v1/positionSide/dual dualSidePosition=false`). | TRADE |
| Demo funds | Reset under Assets → Futures → [Reset]; cancel open orders first. | [Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd) |
| Demo ≠ live | Chart data, order book and fills may differ from live. Futures demo has no TWAP, webhooks, Grid, exports. Customer support can't see demo orders. | [Demo FAQ](https://www.binance.com/en/support/faq/detail/9be58f73e5e14338809e3b705b9687dd) |
| Maintenance windows | Demo trading has had multi-day maintenance before (COIN-M demo, 16–23 Jun 2026). Have a recorded-demo backup for judging. | CHANGELOG 2026-06-16 |
| Spot testnet resets | ~monthly, no warning, orders wiped, keys kept. | [Spot testnet info](https://developers.binance.com/en/docs/products/spot/testnet/general-info) |
| Precision | Prices/quantities must match the symbol's tick size / step size / min notional from `exchangeInfo` filters, or the order is rejected. **[UNVERIFIED detail – standard Binance behaviour]** | – |

---

## 5. Libraries for Node/TypeScript

| Option | Version (npm, checked today) | Notes | Source |
| --- | --- | --- | --- |
| `@binance/derivatives-trading-usds-futures` (official) | **39.0.5**, published 18 Nov 2026 | Official modular connector. REST + WS API + WS streams, TypeScript types, HMAC/RSA/Ed25519, retries. Needs **Node ≥ 22.12**. Deps: `@binance/common`, `axios`, `ws`. Testnet constants: REST `testnet.binancefuture.com` (a `..._REST_API_DEMO_URL = demo-fapi.binance.com` constant also exists), WS streams `fstream.binancefuture.com`. | [JS connector page](https://developers.binance.com/en/docs/sdks-tools/connectors/javascript), [SDK README](https://github.com/binance/binance-connector-js/tree/master/clients/derivatives-trading-usds-futures), npm registry |
| `@binance/connector` (old official, all-in-one) | 3.6.1, last published 8 Jan 2025 | Old; replaced by the modular packages. Don't use. | npm registry |
| `binance` (community, by tiagosiebler) | 3.6.13, 20 Nov 2026 | Popular community SDK. Not official. | npm registry |
| Plain `fetch` + `node:crypto` + `ws` | Node built-ins + `ws` | ~40 lines for signing + REST, ~40 for the two WS connections with reconnect. | GI (signing rules) |

**Recommendation: plain `fetch` + `node:crypto` HMAC + `ws`.**
Why:
- We only need ~10 endpoints (§2) and 2 streams (§3).
- We must control the exact demo hosts (`demo-fapi`, `demo-fstream`) and the new `/market` / `/private` routes. The SDK's testnet constants point at the older hosts, and how the SDK builds routed stream URLs on demo is unknown to me **[UNVERIFIED]**.
- Easier to debug in a 5-day hackathon: one file, the error is the raw `{code, msg}` from Binance.
- If we want types, we can copy the interfaces (`AccountUpdate`, `OrderTradeUpdate`, `AlgoUpdate`) from the SDK's `index.d.ts`.

If you'd rather use the SDK: `new DerivativesTradingUsdsFutures({ configurationRestAPI: { apiKey, apiSecret, basePath: DERIVATIVES_TRADING_USDS_FUTURES_REST_API_DEMO_URL } })`. ([SDK README](https://github.com/binance/binance-connector-js/tree/master/clients/derivatives-trading-usds-futures), constant names read from `@binance/common` 2.5.4)

---

## 6. Telegram Bot API

Current Bot API version: **10.5** (22 Nov 2026). (TGAPI "Recent changes")

### 6.1 Create the bot

1. In Telegram, open **@BotFather** and send `/newbot`. It asks for a name and a username, then gives you a **token**. ([Bot features § BotFather](https://core.telegram.org/bots/features#botfather))
2. All calls go to `https://api.telegram.org/bot<token>/METHOD_NAME`. (TGAPI)
3. To get your own `chat_id`: send the bot any message, then read `message.chat.id` from the update (grammY: `ctx.chat.id`). Store it – the bot can only message users who started a chat with it **[UNVERIFIED wording – standard Telegram rule]**.

### 6.2 Send a warning with Confirm / Cancel buttons

`sendMessage` with `reply_markup` = `InlineKeyboardMarkup` (rows of `InlineKeyboardButton`). Each button has `text` and `callback_data` (**1–64 bytes**). (TGAPI § InlineKeyboardButton)

→ Put only a short id in `callback_data`, e.g. `c:7f3a` / `x:7f3a`, and keep the full pending action (move stop BTCUSDT to 93500) in server memory with an expiry.

### 6.3 Receive the button press

- A press arrives as an `Update` with `callback_query` (`id`, `from`, `message`, `data`). (TGAPI)
- Two ways, **mutually exclusive**: `getUpdates` (long polling) or `setWebhook`. Updates wait on Telegram's server max 24 h. (TGAPI § Getting updates)
  - **Long polling**: `getUpdates` with `offset`, `timeout` (seconds; >0 for long polling), `allowed_updates` (e.g. `["message","callback_query"]`). No public URL needed. (TGAPI § getUpdates)
  - **Webhook**: `setWebhook` with an HTTPS `url`, ports 443/80/88/8443 only, optional `secret_token` (sent back in header `X-Telegram-Bot-Api-Secret-Token`). While a webhook is set, `getUpdates` doesn't work. (TGAPI § setWebhook)
- **Must call `answerCallbackQuery`** for every press: "Telegram clients will display a progress bar until you call answerCallbackQuery … even if no notification to the user is needed". (TGAPI § InlineKeyboardButton note / answerCallbackQuery)
- After acting, edit the message (`editMessageText`) to "✓ Stop moved" so the buttons can't be pressed twice.

**Use long polling** for the hackathon: the backend runs on a laptop / small VPS with no HTTPS domain needed.

Limits: up to 30 messages/second broadcast by default. (TGAPI)

### 6.4 Library: grammY

- **`grammy` 1.48.0**, published 22 Nov 2026 (npm registry). Node + TypeScript guide: `npm install grammy`. ([grammY getting started](https://grammy.dev/guide/getting-started))
- `bot.start()` = built-in long polling.

```ts
import { Bot, InlineKeyboard } from "grammy";
const bot = new Bot(process.env.TG_TOKEN!);

export async function askConfirm(chatId: number, text: string, actionId: string) {
  const kb = new InlineKeyboard().text("✅ Confirm", `c:${actionId}`).text("✖ Cancel", `x:${actionId}`);
  await bot.api.sendMessage(chatId, text, { reply_markup: kb });
}

bot.callbackQuery(/^(c|x):(.+)$/, async (ctx) => {
  const [, kind, id] = ctx.match!;
  const ok = kind === "c" ? await runPendingAction(id) : (cancelPending(id), true);
  await ctx.answerCallbackQuery({ text: ok ? "Done" : "Failed" });
  await ctx.editMessageText(`${ctx.callbackQuery.message?.text}\n\n${kind === "c" ? "Confirmed" : "Cancelled"}`);
});

bot.start(); // long polling
```

(`InlineKeyboard`, `bot.callbackQuery`, `ctx.answerCallbackQuery`, `ctx.editMessageText` are grammY's standard API – **[UNVERIFIED against today's grammY docs; I only fetched the getting-started page]**.)

Safety: check `ctx.from.id` equals the trader's stored Telegram user id before running any order action.

---

## 7. Speech-to-text for voice commands

The G2 mic gives raw **PCM 16 kHz, 16-bit, mono** (see `02-even-hub-sdk.md` §0). Voice commands are short (2–5 s).

| Option | Raw PCM? | Price | Notes | Source |
| --- | --- | --- | --- | --- |
| **Deepgram Nova-3** (streaming WebSocket or pre-recorded) | **Yes**: `encoding=linear16&sample_rate=16000` for raw headerless audio | **$0.0048/min** monolingual, pay as you go ($0.29/h streaming) | **$200 free credit**, no card. 150 concurrent streams. | [Pricing](https://deepgram.com/pricing), [Encoding docs](https://developers.deepgram.com/docs/encoding) |
| Deepgram Flux STT (English) | Yes (`linear16`, …) | $0.0065/min | Made for voice agents (turn detection). | [Pricing](https://deepgram.com/pricing) |
| **OpenAI `gpt-transcribe`** (file upload) | **No** – file up to 25 MB in `flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm`. Wrap PCM in a 44-byte WAV header first (easy). | **$0.0045/min** | Recommended OpenAI model now. | [Speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), [model page](https://developers.openai.com/api/docs/models/gpt-transcribe) |
| OpenAI `gpt-live-transcribe` (Realtime WebSocket) | Yes, but **24 kHz** mono PCM16 → must resample from 16 kHz | $0.017/min | Live streaming. | [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [Pricing](https://developers.openai.com/api/docs/pricing) |
| OpenAI `whisper-1` | No (file) | $0.006/min **[UNVERIFIED – old price, not on today's pricing page]** | **Deprecated, shuts down 26 Feb 2027** (also `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`). | [Speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text) |

**Recommendation:** Deepgram Nova-3 – it eats the glasses' 16 kHz PCM directly, and the free credit covers the whole hackathon. Add `keyterm`/keywords for "move stop", "breakeven", "flatten" **[UNVERIFIED – Deepgram keyterm option not checked today]**. Backup: wrap PCM in WAV and send to OpenAI `gpt-transcribe` (cheapest per minute).

---

## 8. Things I could not verify

1. Whether demo-made API keys also work on `testnet.binancefuture.com`, and whether `demo-fstream.binance.com` uses the `/market` + `/private` routes. Test both on day 1.
2. Whether Demo Trading is open in the team's region (Binance says some regions only).
3. Exact current rate-limit numbers (read `exchangeInfo`).
4. Whether two `closePosition=true` stops can exist at once on the same side (affects the "place new, then cancel old" stop move).
5. Field meanings of the user data events (names are verified from the SDK; the event detail pages didn't render).
6. Error code `-1021` for timestamp drift, and the exact path of the server-time endpoint (`/fapi/v1/time`).
7. Spot testnet login method (GitHub).
8. grammY method names beyond the getting-started page, and the `whisper-1` per-minute price.
