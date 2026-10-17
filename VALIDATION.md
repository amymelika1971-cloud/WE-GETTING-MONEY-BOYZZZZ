# Memescope validation — 2026-10-17

- Node 24.19.0, pnpm 11.25.0; frozen install and repeat install succeeded.
- 31 Node data/adapter/risk/candle tests passed; zero failed or skipped.
- TypeScript no-emit check passed.
- Final Vinext build passed. Local build ID: `913e2c9e-537d-4d4f-a9e5-d711d23efb15`.
- Built Worker started using `bash scripts/sites-env.sh -- npm start -- --port 4173`; homepage HTTP 200.
- 14 browser scenarios passed against that built Worker with controlled API fixtures; no browser page exceptions. Desktop 1280px and mobile 390px/320px screenshots were inspected. These do not establish current live market data or coverage.

Browser checks: Default $15K–$30K list; no automatic coin selection, Star does not open details; Watching retains coin beyond $200K, Watchlist survives reload on the same browser, Keyboard row opens narrative, five callouts, and unknown risk evidence, Disconnected Twitter/FOMO states remain explicit, Closing details restores keyboard focus, Unstar and empty Watching state, Direct contract lookup obtains narrative from fetched callouts, Unavailable candles do not become a positive pullback signal, Search submission handles invalid contracts and real-candle structure responses, Desktop, 390px and 320px mobile layouts have no horizontal overflow, Empty discovery and failed provider states are distinct, Stale data is labeled, Failed watched refresh preserves stale fallback timestamp.

Current live checks: egress proxy denies required provider domains; production discovery endpoint returned HTTP 503, recent-callouts endpoint returned HTTP 200 with Pump.fun unavailable and X/FOMO not-connected. No live provider or current private-site behavior is claimed as verified.

Unchanged: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .openai/hosting.json, vite.config.ts, app/chatgpt-auth.ts and build/sites-worker.ts. Project remains appgprj_6ad312c98c1c8191b48a2658f2e978a5. No deployment or audience change was made.

Cloud environment draft saved: provider/site network hosts, complete install_script and start_skill. Draft save does not apply settings or publish either the environment or the website. Review and save environment settings, then publish the environment to activate them. Existing Site publishing access is separately required to publish the app.
