# Memescope

Private, read-only meme coin research dashboard. The home page is a simple early-coin watchlist; `/explorer` retains detailed charts, holders, watchlists and saved callouts.

## Simple early-coin watchlist

- The homepage is one list. Tap a coin for details; star it to track it in Watching as its cap changes. Nothing opens automatically.
- Discovery samples Solana coins in Pump.fun's recent and ranked active-position feeds, including a separate early-cap feed. Exact base-token identity and current reported cap are checked against DEX Screener.
- Minimum cap is $15,000 inclusive. The default view ends at $30,000 exclusive; a single range selector can widen it to $200,000 exclusive. Unknown caps are excluded; FDV is not a substitute.
- Candidates must have a callout in the last 30 minutes and a written thesis. The simple English text screen checks the full source thesis before excerpting it, requiring eight words and five distinct non-filler words after removing links and addresses; obvious guaranteed/free-return wording and hype-only text are excluded. This is not fact verification, a quality guarantee or sentiment analysis.
- More distinct observed caller IDs rank first, followed by newest callout time. Repeated calls by one author do not inflate the caller count. Identities can still be coordinated; counts cover only the sampled feed.
- Coin details contain cap, liquidity, volume, required cap multiple to $200K, a collapsible rug-risk panel and source tabs for up to five recent callouts. The busy dashboard, timer and filter switches were removed.
- An optional, quiet price-structure note checks actual completed 1m candles from GeckoTerminal. Two successive higher confirmed swing highs and higher swing lows, followed by a close below the recent high without breaking the higher low, describe a pullback. At least 20 contiguous completed candles are required; sparse, stale, invalid or missing history stays unknown. This is descriptive evidence, not a buy recommendation or a filter every coin must pass.
- Discovery and watched prices refresh every 15 seconds while visible. An open coin refreshes market data every 5 seconds, callouts every 10 and risk data every 30. No tracking continues after closing the page; provider latency and caching apply.
- The selected coin's price-structure history refreshes every minute. Pasted contracts and watched coins can obtain a narrative from returned recent callouts; the absence of one is explicit. Failed watched-price refreshes and stale fallback timestamps are labeled, and unavailable callout counts remain unknown.

## Callouts

The selected coin has three source tabs with up to five newest available posts per source, actual publication timestamps, short excerpts and source permalinks. The simple view uses a 30-minute lookback. No filler posts or fabricated sentiment.

- **Pump.fun:** `/home-feed/new`, newest-first, exact network and mint matching. Original active-position callouts only; quotes and perps excluded. The global feed is scanned for at most eight pages (400 entries) with an eight-second budget. Partial coverage is explicit. Posts may be unavailable if the underlying position closes. This is not the old top-callout endpoint.
- **X / Twitter:** an optional server adapter for official recent search, using `X_BEARER_TOKEN` from runtime secret bindings. No token is currently configured and the adapter has not been tested with authenticated live access. No credential is requested or stored in the browser. Posts are matched again locally to the entire address; network identity for shared EVM addresses is not established by the address alone. Results can lag and cache for 30 seconds. Until connected, the app shows an exact-address search link and a not-connected state.
- **FOMO:** no supported authorized live-feed integration is available in this build. Its tab is explicitly not connected, with contract-copy and open-source actions. No protected endpoints are scraped or invented. The explorer still supports saving user-provided FOMO links.

## Rug-risk evidence

RugCheck supplies Solana evidence; GoPlus supplies supported EVM evidence. Reported authority controls, mintability, freeze capability, honeypot flags, ownership capabilities, tax controls, full-sale restrictions and cooldowns are shown when available. A per-pool LP-lock check, liquidity thresholds, top-account concentration and explicit creator percentage are added with their limitations.

High-risk, review and unknown counts are transparent signal counts, not rug probabilities. Missing checks are never green: missing required provider capabilities are explicitly unknown, and incomplete evidence is labeled in the collapsed panel. Unknown creator holdings are not zero. Reported accounts may include pools, custody and burn accounts; they are not presumed to be independent wallets. A liquidity lock must match the selected pool. A provider report and retrieval timestamp do not prove up-to-the-second on-chain state.

Solana buy/sell simulation, developer transaction streams, wallet bundle detection, lock expiry checks and hidden wallet clusters are **not connected** and shown as unverified. No safety guarantee, trading execution, wallet connection or return prediction is included.

## Other data and storage

DEX Screener covers indexed pools and selected-pool market statistics. GeckoTerminal supplies token-oriented historical candles in the explorer. Eight networks are available for pasted contracts: Solana, Ethereum, Base, BNB Chain, Arbitrum, Polygon, Avalanche and Optimism. Very new or pre-migration tokens without indexed pools may be unavailable.

Watchlists and saved callouts remain browser-local. Caches are bounded: selected market 4s, discovery 10s, Pump page 5s, Pump scan 8s, X 30s, security 30s, chart 60s. Legacy explorer callouts remain provider-selected, possibly historical, and clearly labeled separately.

## Validation and deployment

Run `node --test tests/*.test.mjs` and `node node_modules/typescript/bin/tsc --noEmit`. Tests cover exact identity, missing values, recent-window ordering and deduplication, cap bounds, quote-token exclusion, narrative/hype filtering, caller deduplication, X address filtering, pool-specific locks, unknown risks and critical flags.

The restored version passes 31 Node tests, TypeScript and `npm run build`. Its built Worker starts locally using `bash scripts/sites-env.sh -- npm start -- --port 4173`. The environment wrapper keeps Wrangler's writable configuration inside the project; plain `npm start` can fail in a restricted cloud filesystem.

Run `python3 scripts/browser-check.py http://127.0.0.1:4173` with Python Playwright and Chromium installed. Fourteen browser scenarios pass against the built Worker with controlled API responses, including desktop/390px/320px layouts, source tabs, five-post limits, search, watch persistence beyond $200K, keyboard/focus, missing risk data and stale/error states. Screenshots are test fixtures, not live market observations.

Earlier live provider successes are documented in the original handoff. In this cloud session, the egress proxy denies the required provider hosts, so current live discovery returns 503 and Pump.fun callouts report unavailable. Live X/FOMO remain disconnected. Required provider hosts were saved in the cloud environment settings draft; saving a draft alone does not apply networking.

The current source and build have not been published. Preserve `.openai/hosting.json` and the existing owner-private Site `appgprj_6ad312c98c1c8191b48a2658f2e978a5`; deployment requires authorized publishing access to that existing Site. This source archive contains no publishing credentials. Provision secrets only through native runtime-secret settings; never put credentials in source.
