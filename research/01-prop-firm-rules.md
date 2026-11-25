# 01 – How prop-firm rules really work

Research for Riskavue (Even Realities G2, Binance testnet). Written 24 Nov 2026.

How to read this file:

- **[V]** means verified. I read it on the page linked beside it, on or around 24 Nov 2026.
- **[3P]** means a third-party source (blog, review, aggregator). It may be out of date.
- **[I]** means my own inference. No source says it directly.
- Firms change rules often, so re-check a firm's page before you hard-code a preset.

---

## 1. The rule types in plain words

| Rule | What it means |
|---|---|
| Daily loss limit | You may not lose more than X in one "trading day". Each firm picks its own day start (00:00 CE(S)T, 00:00 UTC, 00:30 UTC, 5 PM CT...). |
| Max loss / max drawdown | You may never fall below a floor for the whole account. The floor is **static** (fixed from the start balance) or **trailing** (moves up as you make money). Trailing can be end-of-day or intraday. |
| Profit target | Make X% to pass a phase. |
| Minimum trading days | You must trade on at least N separate days. |
| Consistency | No single day may hold more than X% of your profit. Usually this is not a breach, it just delays your pass. |
| Mandatory stop loss | Some firms say every trade must have a stop loss within 1–5 minutes. |
| Max risk per trade | A cap on how much one trade may lose. |
| Max position size / leverage | A cap on contracts or on leverage. |
| News and weekend rules | Some firms ban trading a few minutes around big news, or holding trades over the weekend. |

---

## 2. Rule details per firm (verified)

### FTMO (forex/CFD)

- Daily loss is checked on **equity**. Equity = "Balance + Open Positions P/L ± Swaps – Commissions". If equity drops below the limit, the rule is broken. [V] https://ftmo.com/en/trading-objectives/
- The daily limit is recalculated at **00:00 CE(S)T**. Limit = balance at 00:00 CE(S)T minus the Max Daily Loss Amount. The amount is a % of the **Initial Simulated Capital** (3% on 1-Step, 5% on 2-Step). On day 1, the balance used is the initial capital. [V] https://ftmo.com/en/trading-objectives/
- Note: the day start uses the **balance**, not the equity, at 00:00. [V] https://ftmo.com/en/trading-objectives/
- Max Loss, 2-Step: **static**, initial capital minus 10% (on $100,000 the floor is $90,000). [V] https://ftmo.com/en/trading-objectives/
- Max Loss, 1-Step: **end-of-day trailing**. Floor = highest balance at 00:00 CE(S)T of any earlier day (or the initial capital, if higher) minus 10% of the initial capital. It only goes up. [V] https://ftmo.com/en/trading-objectives/
- Max Loss, Instant: **intraday trailing on balance**. It updates "the moment a trade closes at a new balance high". [V] https://ftmo.com/en/trading-objectives/
- Profit target: 10% (1-Step), 10% then 5% (2-Step). The balance must pass the target "with all positions closed". [V] https://ftmo.com/en/trading-objectives/
- Minimum trading days: 4 per phase on 2-Step. A trading day is any day (00:00:00–23:59:59 CE(S)T) with at least one position opened. [V] https://ftmo.com/en/trading-objectives/
- Consistency, 1-Step: Best Day ≤ 50% of total profit (accounts ordered from 12 Oct 2026). Instant: ≤ 30%. Going over is not a breach; you keep trading until the ratio fits. [V] https://ftmo.com/en/trading-objectives/
- News: no orders (including SL/TP fills) 2 minutes before and 2 minutes after listed news, on affected symbols only. This does **not** apply in the Challenge or Verification phase, or on Swing accounts. [V] https://ftmo.com/en/faq/can-i-trade-news/
- Weekend: you must close positions before market breaks longer than 2 hours, except in Challenge/Verification and on Swing accounts. [V] https://ftmo.com/en/faq/can-i-hold-positions-overnight-or-over-the-weekend/
- Account sizes: the site says "Up to $200,000". [V] https://ftmo.com/en/

### FundingPips (forex/CFD)

- The home page showed two plans: **Flex** (target 12%, daily loss 2% or 3%, max loss 12% static, 0 min days) and **LABS001** ($100K, target 5%, daily loss 1%, max loss 3% end-of-day, 0 min days). [V] https://fundingpips.com/
- The 2-Step plan tabs did not load for me. Third parties say: daily loss from the **higher of opening balance or equity**, floating P/L counts, reset at 00:00 platform time (UTC+3), 5% daily / 10% max on some tiers. [3P] https://www.mql5.com/en/blogs/post/776527 and https://tradetanto.com/learn/fundingpips-rules

### The5ers (forex/CFD), High Stakes

- Sizes $2.5K, $5K, $10K, $25K, $50K, $100K. Max daily loss 5%, max loss 10%, target 10% (step 1) and 5% (step 2), minimum 3 profitable days. Leverage 1:100. [V] https://the5ers.com/high-stakes/
- A profitable day = closed profit of at least 0.5% of initial balance. [V] https://the5ers.com/high-stakes/
- Daily limit is recalculated at **00:00 server time** from the **higher of the previous day's closing balance or closing equity**. Example: end the day at $110,000 equity, 5% → allowance $5,500, breach below $104,500. So here the % is taken of the start-of-day value, not of the initial balance. [V] https://the5ers.com/faqs/what-is-the-drawdown-rule-for-high-stakes/
- Max loss is "an absolute drawdown from your initial account balance" (static). Breaching either limit = "immediate account termination". [V] https://the5ers.com/faqs/what-is-the-drawdown-rule-for-high-stakes/
- Weekend holding allowed. Trading 2 minutes before or after high-impact news "is not allowed". [V] https://the5ers.com/high-stakes/

### Topstep (futures)

- Sizes $50K / $100K / $150K. Profit target $3,000 / $6,000 / $9,000. Max Loss Limit (MLL) $2,000 / $3,000 / $4,500. Min 2 trading days. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters
- MLL **trails up with end-of-day balance**, never down, and locks once it reaches the starting balance. "Touch it at any point, even on unrealized P&L, and your account is liquidated." [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters
- Static MLL products also exist: $1,000 / $2,000 / $4,000 / $6,000 for 25K / 50K / 100K / 150K. [V] https://help.topstep.com/en/articles/8284204-what-is-the-maximum-loss-limit
- Daily Loss Limit is **optional**: $1,000 / $2,000 / $3,000. Hit it and positions are flattened, orders cancelled, no new trades until 5 PM CT. It is **not** a rule violation. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters
- Consistency: best day must stay below 55% of the profit target (e.g. < $1,650 on 50K). Going over raises the target. Best day locks at 3:10 PM CT. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters
- Max position size 5 / 10 / 15 minis (1 mini = 10 micros). Limits can tighten around Tier 1 news. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters
- Trading day runs 5:00 PM CT to 3:10 PM CT. All positions must close by 3:10 PM CT. Day trading only. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters

### HyroTrader (crypto; Bybit and BloFin)

- Its own pages name **Bybit and BloFin** demo accounts, not Binance. [V] https://www.hyrotrader.com/faq/rules/
- Daily floor = **equity at start of day − (initial balance × daily %)**. Equity includes floating P/L and fees. Resets **00:00 UTC**. [V] https://www.hyrotrader.com/faq/rules/how-is-the-5-daily-drawdown-calculated/
- Daily %: Hyro Core 3%, Hyro Instant 3%, One-Step 4%, Two-Step 5%. Same in every phase. [V] same link
- The floor does not rise when you are in profit during the day ("static daily drawdown"). [V] https://www.hyrotrader.com/faq/rules/what-is-the-difference-between-standard-trailing-and-swing-fixed-daily-drawdown/
- One-Step: daily 4%, max loss 8%, target 10%, min 3 trading days, stop loss "Not required", "Profit distribution 40% per day". [V] https://www.hyrotrader.com/trading-rules/
- Profit distribution rule: no single day may count for more than 40% of the profit target (Core, One-Step, Two-Step). Extra profit stays but does not count. [V] https://www.hyrotrader.com/faq/rules/what-are-the-risk-management-conditions-at-hyrotrader/
- Hyro Instant: a trade losing more than 2% of initial balance (with fees) gives one warning; a second one ends the account. [V] same link
- Low-cap coins: max 5% of initial balance (with leverage) across all low-cap assets. Martingale banned. [V] same link
- Stop loss: "No, setting a stop-loss is not mandatory." [V] https://www.hyrotrader.com/faq/rules/d/
- Conflict: some blogs say Hyro needs a stop loss within 5 minutes and caps risk at 3%. Hyro's own FAQ now says no SL is required. Trust the FAQ. [3P] https://proptradingvibes.com/blog/hyrotrader-stop-loss-rule
- Two-Step max loss % and type: not verified. Blogs say 10%, and disagree on static vs trailing. [3P] https://ptv-dev.pages.dev/blog/hyrotrader-max-drawdown

### Breakout (crypto; owned by Kraken)

- Daily loss: **3% of balance, excluding open positions**, recalculated at **00:30 UTC**. Example: balance $105,000 at 00:30 UTC → floor $101,850 for 24 hours. [V] https://intercom.help/breakoutprop/en/articles/11644066-what-is-the-maximum-daily-loss-limit-in-the-breakout-evaluation
- 1-Step Classic max drawdown: **6% of initial balance, static**. Sizes $5K–$100K, target 10% (e.g. $100K → $10,000 target, $6,000 drawdown). [V] https://intercom.help/breakoutprop/en/articles/11644076-what-is-the-maximum-drawdown-limit-in-a-1-step-classic-breakout-evaluation
- A breach "immediately terminates your Breakout Evaluation, closes all open positions, and disables your demo account". [V] https://intercom.help/breakoutprop/en/articles/11644085-what-constitutes-a-breach-in-the-breakout-evaluation
- Weekend holding: allowed. [V] https://intercom.help/breakoutprop/en/articles/11644093-can-i-hold-positions-over-the-weekend-during-the-breakout-evaluation
- Position size limits per symbol are on breakoutprop.com/symbols. [V] https://intercom.help/breakoutprop/en/articles/11644099-what-are-the-position-size-limits
- Unclear: the floor is set from balance, but an older Breakout article title speaks of a "maximum daily loss **equity** limit". So the check during the day is probably on equity. [I] (article title seen in search: https://intercom.help/breakoutprop/en/articles/10340643-what-happens-if-i-exceed-the-maximum-daily-loss-equity-limit-and-or-the-maximum-drawdown-equity-limit-in-the-breakout-evaluation)

### Crypto Fund Trader (crypto + CFD; Bybit, MT5, Match-Trader)

- "Drawdown breaches are calculated based on equity." Daily max loss is based on **balance at 12:05 AM UTC**. [V] https://cryptofundtrader.com/faq
- 2-Phase: daily 5%, overall 10% fixed on initial balance. [V] same link
- 1-Step: daily 3%; overall static 6% (Classic), 5% (Pro), 3% (Turbo). [V] same link
- Former 1-Phase: daily 4% + trailing 6% that stops at the initial balance (e.g. $100K: floor $94,000; at $107,000 the floor reaches $100,000 and stays). "If your equity falls below the trailing drawdown limit at any time, the account will be considered breached." [V] same link
- News trading allowed. Overnight and weekend holding allowed. Bybit leverage up to 1:100. No fixed max lot size. [V] same link
- A reset of a failed funded account needs "All trades ... must have had a Stop Loss". [V] same link

### Binance specifically

- I found **no major prop firm that runs evaluations on the trader's own Binance account**. HyroTrader, Crypto Fund Trader and Breakout use Bybit, BloFin or their own terminals. [V for each firm's own page above]
- One review says HyroTrader's CLEO platform reads Binance and Bybit order books. [3P] https://kraken.com/learn/best-crypto-prop-firms
- So Riskavue on Binance testnet should be a **"bring your own rules" guard with firm presets**, not a copy of one firm's platform. [I]
- Binance USDⓈ-M futures account data gives `totalWalletBalance` (balance), `totalUnrealizedProfit` (floating P/L) and `totalMarginBalance` (≈ equity). [V] https://developers.binance.com/docs/derivatives/usds-margined-futures/account/rest-api/Account-Information-V3
- Testnet REST base: `https://demo-fapi.binance.com`, websocket `wss://demo-fstream.binance.com`. [V] https://developers.binance.com/docs/derivatives/usds-margined-futures/general-info

---

## 3. Numbers per firm (table)

All values are from the verified sources above unless marked.

| Firm / plan | Sizes | Daily loss | Daily base and reset | Max loss | Max loss type | Target | Min days |
|---|---|---|---|---|---|---|---|
| FTMO 2-Step | up to $200K | 5% of initial | balance at 00:00 CE(S)T; equity checked | 10% | static | 10% / 5% | 4 per phase |
| FTMO 1-Step | up to $200K | 3% of initial | same | 10% | EOD trailing | 10% | not listed |
| FTMO Instant | – | 3% of initial | same | not noted | intraday trailing (balance) | none | – |
| FundingPips Flex | from $5K | 2% or 3% | not verified | 12% | static | 12% | 0 |
| FundingPips LABS001 | $100K | 1% | not verified | 3% | EOD | 5% | 0 |
| The5ers High Stakes | $2.5K–$100K | 5% of start-of-day value | higher of prev. close balance/equity, 00:00 server | 10% | static | 10% / 5% | 3 profitable |
| Topstep Combine 50K | $50K | $1,000 optional (soft lock) | day 5 PM CT – 3:10 PM CT | $2,000 | EOD trailing, locks at start | $3,000 | 2 |
| Topstep Combine 100K | $100K | $2,000 optional | same | $3,000 | EOD trailing | $6,000 | 2 |
| Topstep Combine 150K | $150K | $3,000 optional | same | $4,500 | EOD trailing | $9,000 | 2 |
| HyroTrader One-Step | not checked | 4% of initial | equity at 00:00 UTC | 8% | not stated | 10% | 3 |
| HyroTrader Two-Step | not checked | 5% of initial | equity at 00:00 UTC | not verified (10% [3P]) | disputed [3P] | not verified | – |
| HyroTrader Core / Instant | not checked | 3% of initial | equity at 00:00 UTC | not verified | – | – | – |
| Breakout 1-Step Classic | $5K–$100K | 3% | balance at 00:30 UTC | 6% | static | 10% | not checked |
| Crypto Fund Trader 2-Phase | not checked | 5% | balance at 00:05 UTC; equity checked | 10% | static | not checked | – |
| Crypto Fund Trader 1-Step Classic / Pro / Turbo | not checked | 3% | same | 6% / 5% / 3% | static | not checked | – |

---

## 4. Why traders fail

### Pass rates (official where possible)

- Topstep, Jan–Dec 2025: **16.8%** of Trading Combines were passed. **51.8%** of people who tried one or more Combines passed at least one. **33.3%** of funded people got a payout. **0.71%** of Express Funded traders were moved to a Live account. [V] https://www.topstep.com/topsteptv-213k-subscribers-extravaganza
- Other firm-reported rates, collected by an aggregator: Earn2Trade 8.89% (2025), Take Profit Trader 16.86% (2024), TradeDay 28.2%, E8 Markets 17.7%, Tradeify 17.2% per account vs 40.3% per person. An FPFX Tech dataset (100,000+ traders, 10 firms) shows 14% reached funded status and 7% got a payout. [3P] https://fortunly.com/statistics/prop-firm-challenge-pass-rate-statistics/
- A guide says no major firm publishes audited pass rates. [3P] https://traderssecondbrain.com/guides/prop-firm-pass-rate
- Lesson: "per attempt" and "per person" numbers are very different. [V from Topstep above]

### Breach reasons

- OneFunded data (as quoted by an aggregator): **78.7%** of failed evaluations broke the **daily loss limit**; 15% broke max drawdown. I could not find the original OneFunded report. [3P] https://fortunly.com/statistics/prop-firm-challenge-pass-rate-statistics/
- Same aggregator, from TradersSecondBrain: 60% of failures were a single-day blowup, 25% slow bleed. [3P] same link
- A study of 1,150 one- and two-star Trustpilot reviews of 15 MT5 prop firms (Aug–Oct 2026): loss limit broken 7.8%; stop-loss / risk-per-trade rules 5.6%; separate open-loss limit 2.5%; consistency 2.2%; news rule 1.7%. Many said they **did not know how the daily limit was calculated**, and several lost the account **by a few dollars** to commission or slippage on the closing trade. Floating loss counts at most firms, so a trade that later closes in profit can still have broken the limit. (The author sells an MT5 tool; these are traders' own claims.) [3P] https://www.mql5.com/en/blogs/post/779301

### What this means for us [I]

- The daily limit is the number-one killer, and it usually dies in one bad session. That is exactly the moment a glance display helps.
- Traders misread the formula. Riskavue must show the **exact floor in dollars**, not just a %, and must use the firm's exact day start.
- Fees and slippage matter. A buffer before the real line is needed.

---

## 5. Existing tools (competitors outside the glasses)

| Tool | Platform | What it does | Source |
|---|---|---|---|
| TopstepX Daily Risk Lock / Personal Daily Loss Limit | TopstepX (futures) | Personal daily loss, profit target, contract and trade limits, frozen until 5 PM CT | [3P search snippet] https://www.topstep.com/?p=23310 ; PDLL [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters |
| NinjaTrader / Tradovate prop risk settings | NinjaTrader, Tradovate | Daily loss limit with automatic lockout, manual lockout button | [3P] https://prop.ninjatrader.com/platform/risk-settings/ |
| Prop Guardian, Funded Trade Manager, ZyloFx Prop Guard, Redline, Prop Firm Drawdown Guard, Challenge Keeper | MT4/MT5 EAs | Daily loss + max drawdown (static or trailing), day-reset hour, close all + lock, firm presets | [3P vendor] https://www.mql5.com/en/market/product/183997 , https://www.mql5.com/en/market/product/179028 , https://www.mql5.com/en/blogs/post/765552 , https://www.mql5.com/en/blogs/post/779301 |
| "Tilt Engine" (Prop Firm AI Assistant V10) | MT5 | Detects revenge trading after a loss, forces a cooldown with alarm | [3P vendor] https://www.mql5.com/en/blogs/post/774198 |
| Prop Firm Control, RiskGuardian, Risk Manager v2_2 | cTrader | Daily loss limiter, equity stop, close all, block new trades, survives restart | [3P vendor] https://ctrader.com/products/4561 , https://ctrader.com/products/3413 |
| Vataga Risk Manager | Binance Futures | Stops trading after a loss threshold, period 1–72 h | [3P] https://vataga-trading.github.io/docs/application/trading/risk-manager |
| Tiger.com risk manager | Binance USDⓈ-M | Baseline at 00:00 UTC; on hit cancels orders and market-closes positions; settings locked until next UTC day | [3P] https://broker-docs.tiger.com/english-2/interface/risk-manager |
| iOS app (unnamed in snippet) | phone | News lockdowns, consecutive-loss circuit breaker, trading-hour limits | [3P] https://apps.apple.com/app/id6771816469 |

Gaps I see [I]:

- All of these live on the trading screen or phone. None is a heads-up, glance view.
- Most crypto tools are generic loss stops, not prop-rule presets (day start, balance-vs-equity, trailing type).
- A trader asked Tradovate for **automatic** lockouts, a **max trades per day** cap, and locked risk settings, because "a tilted trader can still click through" a manual button. [3P] https://community.tradovate.com/t/better-risk-settings-feature-parity-please/12529

---

## 6. Ideas to make Riskavue better

Things traders and tools already ask for (with source) and my design notes [I].

1. **Distance to daily floor, in dollars and %.** Biggest failure cause is the daily limit (see section 4). Show one big number: "$412 to floor". [I]
2. **Distance to max-loss floor**, with the floor type (static / EOD trailing / intraday trailing). [I]
3. **Buffer setting.** Warn and act before the real line, for fees and slippage. The review study says accounts died "by a few dollars". [3P] https://www.mql5.com/en/blogs/post/779301 . Default buffer e.g. 20% of the daily allowance. [I]
4. **Pre-trade check.** Before a trade, compute worst case = current equity − (loss at stop + est. fees). If below floor + buffer, show "BLOCKS RULE" and refuse the one-tap confirm. [I]
5. **Auto-flatten before the line.** Like Topstep's DLL (flatten + cancel orders + lock until reset) and Tiger's risk manager. [V] https://help.topstep.com/en/articles/8284197-trading-combine-parameters ; [3P] https://broker-docs.tiger.com/english-2/interface/risk-manager
6. **"Stop after N losses" lock (tilt lock).** Consecutive-loss circuit breakers and revenge cooldowns already exist on phone/MT5. [3P] https://apps.apple.com/app/id6771816469 , https://www.mql5.com/en/blogs/post/774198 . Make it **automatic and not undoable until the day resets**, per the Tradovate request. [3P] https://community.tradovate.com/t/better-risk-settings-feature-parity-please/12529
7. **Cooldown after any loss** (e.g. 10 min), with a countdown on the glasses. [I]
8. **Max trades per day.** Requested on Tradovate (link above). [3P]
9. **Day-reset countdown.** "Resets in 3h12m (00:00 UTC)". Firms differ (00:00 CE(S)T, 00:00 UTC, 00:30 UTC, 00:05 UTC, 5 PM CT). [V links in section 2]
10. **News countdown.** FTMO and The5ers ban ±2 minutes around big news on some accounts. Show "CPI in 4:30 – no orders from 2:00". [V] https://ftmo.com/en/faq/can-i-trade-news/ , https://the5ers.com/high-stakes/
11. **Consistency meter.** "Best day = 46% of profit (limit 50%)". Warn when today's profit is close to the cap and suggest stopping. [V] https://ftmo.com/en/trading-objectives/ , https://www.hyrotrader.com/faq/rules/what-are-the-risk-management-conditions-at-hyrotrader/
12. **Stop-loss nag.** If a position has no SL after X seconds, flash it. Some firms need an SL within 1–3 minutes. [V] https://intercom.help/fundedx/en/articles/13179168-is-a-stop-loss-mandatory-on-all-fundedx-accounts , https://intercom.help/take-capital-for-traders/en/articles/10416166-what-are-the-risk-management-rules
13. **Per-trade risk cap.** e.g. Hyro Instant 2% of initial per trade. [V] https://www.hyrotrader.com/faq/rules/what-are-the-risk-management-conditions-at-hyrotrader/
14. **Firm presets.** FTMO 2-Step, The5ers, Hyro One-Step, Breakout Classic, CFT 1-Step, plus "Custom". [I]
15. **Profit target and days left**: "Target 62% · 2 of 4 days". [I]

### What fits a 576×288 monochrome glance + one tap [I]

- One screen, three lines max. Line 1: big "$412 to daily floor". Line 2: small bar of daily allowance used. Line 3: status word (OK / CAUTION / LOCKED) + losses today "2/3".
- Use **levels, not colours**: OK, CAUTION (inside buffer), DANGER (one stop-loss away), LOCKED.
- One tap = confirm the shown action (close all, confirm trade). Long press or double tap = cancel. Never let one tap **unlock** a lock.
- Push the screen only on a state change (crossing into CAUTION, a new loss, a news window). Avoid constant flicker.
- Show the reason when blocking: "BLOCKED: would hit floor by $38".

---

## 7. Rule formulas we must implement

Notation: `B0` = initial balance. `bal` = wallet balance (closed P/L). `eq` = equity = bal + unrealized P/L − fees (Binance: `totalMarginBalance`). `dayStart` = firm's reset time in its timezone.

**Daily loss (pick one base per preset):**

- FTMO style: `dailyFloor = bal_at_dayStart − pctDaily × B0`. Check `eq < dailyFloor` → breach. [V FTMO]
- HyroTrader style: `dailyFloor = eq_at_dayStart − pctDaily × B0`. Check on `eq`. [V Hyro]
- The5ers style: `base = max(bal_close_prevDay, eq_close_prevDay)`; `dailyFloor = base − pctDaily × base`. Check on `eq`. [V The5ers]
- Breakout style: `dailyFloor = bal_at_00:30UTC × (1 − 3%)`. [V Breakout]
- Generic: `distanceToDaily = eq − dailyFloor`. Warn at `distanceToDaily ≤ buffer`.

**Max loss:**

- Static: `maxFloor = B0 × (1 − pctMax)`. [V FTMO 2-Step, Breakout, CFT]
- EOD trailing (FTMO 1-Step): `maxFloor = max(B0, highest bal at any dayStart) − pctMax × B0`; only goes up. [V FTMO]
- EOD trailing with lock (Topstep): `maxFloor = min(startBal, highestEODbal − MLL)`, never down; breach if `eq ≤ maxFloor` intraday. [V Topstep]
- Intraday trailing with lock (CFT former 1-Phase): `maxFloor = min(B0, peakEq − pctMax × B0)`. [I from CFT example — the page says it "moves upward as your account reaches new highs"; peak of equity vs balance not stated]
- Check: breach if `eq < maxFloor` (most firms check equity in real time). [V FTMO, Topstep, CFT]

**Effective floor:** `floor = max(dailyFloor, maxFloor)`; `room = eq − floor`. [I]

**Pre-trade check:** `worstCase = eq − (qty × |entry − stop|) − estFees`. Block if `worstCase < floor + buffer`. If no stop is given, treat it as blocked or ask for one. [I]

**Stop after N losses:** count closed trades with realized P/L < 0 since `dayStart` (or consecutive). If count ≥ N → flatten (optional), cancel orders, lock until next `dayStart`. [I]

**Consistency:** `bestDayProfit / totalProfit ≤ cap` (FTMO 50%, FTMO Instant 30%). Hyro: `bestDayProfit ≤ 40% × target`. Topstep: `bestDay < 55% × target`. [V]

**Profit target:** pass when `bal ≥ B0 × (1 + pctTarget)` with all positions closed (FTMO wording). [V FTMO]

**Trading day count:** a day counts if at least one position was opened between two `dayStart`s. [V FTMO]
