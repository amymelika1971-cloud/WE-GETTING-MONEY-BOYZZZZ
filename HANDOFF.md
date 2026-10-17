# Continuation status — 2026-10-17

The user's current request is to finish, test and publish to the SAME owner-private Site. That supersedes the older save-without-publishing note below.

Source was restored from `memescope-source.zip` to `/workspace/sites/memescope`. The export has no Git metadata. Project ID and auth/build integration are unchanged.

Completed:
- Kept the one-list $15K–$30K homepage, optional $200K range, expandable details and browser-local stars.
- Fixed broader-cap candidates crowding near-$15K candidates out of the returned discovery list.
- Screened the full source thesis before excerpting, so later guaranteed-return language cannot disappear from the narrative screen.
- Added narratives for direct searches and watched coins via available recent callouts, with an explicit missing state.
- Fixed stale watched-price fallback timestamps, refresh errors and unknown callout counts.
- Added accessible row facts, Escape close and return focus; clarified disconnected Twitter/FOMO.
- Added a quiet optional completed-1m-candle HH/HL pullback assessment. Missing, insufficient, gapped or stale candles remain unknown; this is not a return forecast.
- Made missing required risk capabilities explicitly unknown and summarized incomplete evidence accordingly.
- Corrected the optional X adapter to request official `tweet.fields`. Authenticated live X is still untested and disconnected.

Verified in this session:
- Frozen pnpm 11.25.0 dependency installation and repeat installation; lockfile unchanged.
- 31 Node tests, TypeScript `tsc --noEmit`, and the final Vinext/Worker build pass.
- Built Worker starts with `bash scripts/sites-env.sh -- npm start -- --port 4173` and returns homepage HTTP 200.
- 14 browser scenarios pass on the built Worker with controlled API fixtures and no page exceptions: default/wide ranges, five-post limit, source tabs, direct/form lookup, invalid lookup, star/unstar persistence beyond $200K, keyboard/focus, optional pullback, stale/errors, and desktop/390px/320px layouts. See `scripts/browser-check.py`.

Outstanding external access:
- Current cloud egress proxy denies Pump.fun, DEX Screener, RugCheck, GoPlus and GeckoTerminal. Current discovery returns 503; Pump.fun recent feed reports unavailable; X/FOMO report not-connected. The network additions are saved for environment-settings review, not applied by the draft save.
- This session exposes no Site publishing tools or publishing binding. The source ZIP explicitly grants no publishing access. No deployment was made, and the live private Site was not changed. Use authorized Sites publishing for this same project after restoring this source there. Do not create a replacement Site or make its audience public.

Development commands (project working directory):
```sh
bash scripts/sites-env.sh -- corepack pnpm install --frozen-lockfile
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
bash scripts/sites-env.sh -- npm start -- --port 4173
# In a second shell, with Playwright and Chromium available:
python3 scripts/browser-check.py http://127.0.0.1:4173
```

Use the existing checkout. Each cloud task is isolated; do not create a Git worktree unless the user explicitly requests one. Do not push this export into the unrelated empty repository.

---

# Memescope — Codex handoff

## Goal and latest user direction

Finish a very simple memecoin research website for Tony. Prioritize coins near $15K market cap with a written narrative and recent callouts. User repeatedly asked to remove clutter and make the site extremely easy to use. Earlier target: investigate coins that could move toward $200K in under 30 minutes, without presenting that as a forecast or guarantee.

The latest explicit request was to hand this work to Codex instead. Save this work without publishing the new version.

## Project

- Existing Site ID: `appgprj_6ad312c98c1c8191b48a2658f2e978a5`
- Production URL: https://memescope-tony.dearplum6.chatgpt.site
- Current local checkout: `/workspace/sites/memescope`
- Framework: React/TypeScript, Vinext, Cloudflare Workers, Sites build integration.
- Preserve the existing owner-private audience and project identity. Do not create another Site.
- Latest published source before this handoff: `d02da641d6353bfd827b6db3bb538bd0f8945526` (the busy dashboard the user disliked).
- The repository now contains the simpler replacement. Treat source HEAD as newer than production until deployed.

## Current implementation

Homepage `app/page.tsx` is rewritten as one list:
1. Default cap range $15K–$30K; optional dropdown widens to $15K–$200K. The $30K upper default is an implementation assumption interpreting “near $15K,” not a user-specified upper bound.
2. Written-thesis and last-30-minute-callout requirements. Generic hype-only posts are filtered with a simple English text heuristic. Narrative truth/quality is not verified.
3. Rank by distinct observed caller IDs, then newest callout. These are sampled counts, not all posts or proof of independent endorsement.
4. Tap a coin to open market details, up to five recent callouts via source tabs, and a collapsed rug-risk evidence panel.
5. Star a coin to retain it in Watching as its cap changes. Saved on this device using the same existing watchlist key as the explorer.
6. Search by exact contract or supported token link. No automatic coin selection, timer or large metric dashboard.
7. Existing `/explorer` retains charts, holders, saved source links and detailed checks.

## Data, real capabilities and gaps

- Pump.fun public `/home-feed/new`: actual chronological active-position callouts. Exact mint and chain match, up to five matches, bounded scan of eight pages/400 entries with an eight-second budget. Partial coverage is explicit. Quotes/perps excluded.
- Discovery combines Pump.fun recent/ranked feeds and a separate $15K–$30K feed, then checks exact base-token contracts and reported market cap against DEX Screener. Never substitute FDV for market cap. Unindexed/pre-migration pools may be missing.
- Twitter/X: server adapter exists for official recent search using the runtime secret `X_BEARER_TOKEN`. No token is configured, and authenticated live integration is untested. The current UI truthfully shows an exact-contract search link.
- FOMO: not connected. A plugin search returned no match. A third-party public API was found at `https://fomo-public.pootracker.app` (publisher: https://github.com/deladevsol/fomo-api), but `/openapi.json`, `/v2/status` and `/v2/theses` all returned HTTP 502 during this session. It was not integrated. Do not claim every FOMO coin is covered. Do not use private-session extraction or anti-bot bypass wrappers.
- RugCheck for Solana and GoPlus for EVM. Show available mint/freeze/ownership/trading-control flags, selected-pool LP locks, concentration, and provider warnings. Unknown stays unknown. There is no rug-proof/safe badge or probability.
- Solana sell simulation, developer trade streams, bundle/hidden-wallet detection and lock expiry checks are not implemented. Existing panel explicitly states gaps.
- This is read-only research. No wallet connection, trading execution, buy/sell recommendations or guaranteed $200K potential.

## Important files

- `app/page.tsx`: new simple client UI and watchlist.
- `app/globals.css`: original explorer styling plus new `.e-*` simple UI styles. Busy scanner CSS removed.
- `app/layout.tsx`: updated early-watchlist metadata.
- `app/api/discover/route.ts`, `lib/fast-providers.mjs`: discovery and recent feeds.
- `lib/scanner.mjs`: $15K cap floor, exact identity, narrative heuristic, call deduplication and target math.
- `lib/rug-risk.mjs`, `lib/coin.mjs`, `lib/providers.mjs`: risk evidence and normalized data.
- `app/api/recent-callouts/route.ts`: optional X runtime secret and callout response.
- `tests/coin.test.mjs`, `tests/scanner.test.mjs`: data correctness tests.
- `README.md`: updated implementation details and limitations.

## Verification performed

- All 21 Node data-rule tests passed.
- TypeScript `tsc --noEmit` passed after final UI edits.
- Live discovery returned multiple real $15K–$30K candidates; earlier live tests confirmed recent Pump.fun callouts and a RugCheck report.
- Browser QA was not available. Do not claim visual verification. Follow the current Sites skill for allowed browser/preview setup.
- Build/package results should be checked in the handoff message or saved version. The previous deployed build passed; this simplified version is being saved without publication.

## Next work for Codex

1. Open this existing project from source HEAD using the Sites workflow, or use the retained checkout if in the same environment.
2. Inspect the simple UI in an available supported browser at desktop and mobile widths. Check row tap, search, source tabs, star/unstar, Watching updates, loading/empty/error states, stale timestamps and keyboard focus.
3. Fix actual failures and keep the homepage minimal. Do not bring back a busy dashboard or invent narrative/return confidence scores.
4. If live X/FOMO is pursued, use authorized supported data access and label coverage honestly; secrets belong in runtime bindings, never source or chat. This is the main integration gap.
5. After the user asks Codex to finish/publish, run relevant tests/build and deploy the updated version to this SAME private Site.

Useful commands:

```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

Read the installed Sites skill for the correct source helper and build/deployment process. No credentials are included in this handoff.
