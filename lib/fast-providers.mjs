import {CHAINS, validAddress} from './coin.mjs';
import {candidates, newest, pumpPosts, xPosts, PUMP_CHAINS} from './scanner.mjs';

const PUMP = 'https://frontend-api-v3.pump.fun';
const cache = new Map();
const inflight = new Map();
async function cached(key, ttl, run) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const promise = run().then(value => {
    if (cache.size >= 120) cache.delete(cache.keys().next().value);
    cache.set(key, {until: Date.now() + ttl, value});
    return value;
  });
  inflight.set(key, promise);
  try { return await promise; } finally { inflight.delete(key); }
}
async function json(url, options = {}) {
  const response = await fetch(url, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(8_000), ...options});
  if (!response.ok) throw new Error(response.status === 429 ? 'Provider rate limit. Retrying on the next refresh.' : `Provider unavailable (HTTP ${response.status}).`);
  return response.json();
}
function validate(chain, address) {
  if (!Object.hasOwn(CHAINS, chain) || !validAddress(address, chain)) throw new Error('Use a valid token contract and network.');
}
function feedUrl(chain, token, band = false) {
  const q = new URLSearchParams({pageSize: '50', chain, updatesLimit: '1'});
  if (token) q.set('pageToken', token);
  if (band) {q.set('minMarketCapUsd', '15000'); q.set('maxMarketCapUsd', '200000');}
  return `${PUMP}/home-feed/new?${q}`;
}
async function page(url, signal) {
  return cached(url, 5_000, async () => {
    const raw = await json(url, signal ? {signal} : {});
    if (!Array.isArray(raw.coins)) throw new Error('Pump.fun returned an unexpected feed.');
    return raw;
  });
}

export async function discover() {
  return cached('discover', 10_000, async () => {
    // The cap filter applies to current cap, not market cap at the time of a call.
    const q = new URLSearchParams({pageSize: '50', chain: 'solana', minMarketCapUsd: '15000', maxMarketCapUsd: '200000', updatesLimit: '1'});
    // A separate early-cap page keeps $15K coins from being crowded out by bigger tokens.
    const early = new URLSearchParams({pageSize: '50', chain: 'solana', minMarketCapUsd: '15000', maxMarketCapUsd: '30000', updatesLimit: '1'});
    const results = await Promise.allSettled([page(`${PUMP}/home-feed/new?${early}`), page(feedUrl('solana', null, true)), json(`${PUMP}/home-feed?${q}`)]);
    const cards = results.flatMap(r => r.status === 'fulfilled' && Array.isArray(r.value.coins) ? r.value.coins : []);
    if (results.every(r => r.status === 'rejected')) throw new Error('Pump.fun discovery is temporarily unavailable. Paste a contract to check a coin directly.');
    const addresses = [...new Set(cards.filter(c => c.chain === 'solana' && validAddress(c.coinMint, 'solana')).map(c => c.coinMint))].slice(0, 90);
    const chunks = Array.from({length: Math.ceil(addresses.length / 30)}, (_, i) => addresses.slice(i * 30, i * 30 + 30));
    const market = await Promise.allSettled(chunks.map(batch => json(`https://api.dexscreener.com/tokens/v1/solana/${batch.join(',')}`)));
    if (market.length && market.every(r => r.status === 'rejected')) throw new Error('Market data is temporarily unavailable. No candidates can be verified.');
    const pairs = market.flatMap(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
    const coins = candidates(cards, pairs).filter(c => c.thesis)
      .sort((a,b) => b.observedCallers - a.observedCallers || Date.parse(b.newestCall.postedAt) - Date.parse(a.newestCall.postedAt));
    // Addresses are already bounded to 90. Keep every verified match so the
    // narrower default view cannot lose early coins to higher-cap rankings.
    return {coins, checked: addresses.length, eligible: coins.length,
      partial: results.some(r => r.status === 'rejected') || market.some(r => r.status === 'rejected'),
      retrievedAt: new Date().toISOString(),
      coverage: 'A sample of Pump.fun active-position callouts, verified against DEX Screener. Solana only. Unindexed pools and unknown market caps are excluded.',
      ranking: 'Written narratives only. More distinct observed callers first, then newest callout. Claims and caller independence are unverified.'};
  });
}

export async function recentPump(chain, address, minutes = 30) {
  validate(chain, address);
  const url = `https://pump.fun/coin/${address}`;
  if (!PUMP_CHAINS.has(chain)) return {id: 'pump', name: 'Pump.fun', status: 'unsupported', posts: [], url, detail: 'This network is not supported by the public chronological feed.'};
  return cached(`recent-pump:${chain}:${address}:${minutes}`, 8_000, async () => {
    const start = Date.now(), signal = AbortSignal.timeout(8_000);
    let token = null, cards = [], pages = 0, complete = false, warning = null;
    const seen = new Set();
    try {
      while (pages < 8) {
        const raw = await page(feedUrl(chain, token), signal);
        cards.push(...raw.coins); pages++;
        const posts = newest(pumpPosts(cards, address, chain), Date.now(), minutes);
        const stamps = raw.coins.filter(c => c.position?.contentKind !== 'quote').map(c => Date.parse(c.position?.callout?.calloutTimestamp)).filter(Number.isFinite);
        // Chronological feed: 5 exact matches or crossing cutoff is enough.
        if (posts.length === 5 || !raw.nextPageToken || !raw.coins.length || (stamps.length && Math.min(...stamps) < start - minutes * 60_000)) {complete = true; break;}
        token = raw.nextPageToken;
        if (seen.has(token)) break;
        seen.add(token);
      }
    } catch {warning = pages ? 'Some pages could not be loaded.' : 'The public feed is temporarily unavailable.';}
    const posts = newest(pumpPosts(cards, address, chain), Date.now(), minutes);
    const oldest = cards.map(c => Date.parse(c.position?.callout?.calloutTimestamp)).filter(Number.isFinite);
    return {id: 'pump', name: 'Pump.fun', status: !pages ? 'unavailable' : complete ? 'live' : 'partial', posts, url,
      checked: cards.length, coverageFrom: oldest.length ? new Date(Math.min(...oldest)).toISOString() : null,
      retrievedAt: new Date().toISOString(),
      detail: !pages ? warning : `${posts.length} matching posts · ${cards.length} feed entries checked. ${complete ? 'Newest matches in the accessible feed.' : 'Partial feed scan; more matches may exist.'} Active-position callouts only.`,
      warning};
  });
}

export async function recentX(chain, address, minutes = 30, bearer = '') {
  validate(chain, address);
  const base = {id: 'x', name: 'X / Twitter', url: `https://x.com/search?q=${encodeURIComponent('"' + address + '"')}&src=typed_query&f=live`};
  if (!bearer) return {...base, status: 'not-connected', posts: [], detail: 'Live X posts need authorized API access. Exact-contract search is available below.'};
  return cached(`recent-x:${chain}:${address}:${minutes}`, 30_000, async () => {
    const q = new URLSearchParams({query: `"${address}" -is:retweet`, sort_order: 'recency', max_results: '50',
      start_time: new Date(Date.now() - minutes * 60_000).toISOString(),
      'tweet.fields': 'created_at,public_metrics,entities', expansions: 'author_id', 'user.fields': 'username'});
    try {
      const raw = await json(`https://api.x.com/2/tweets/search/recent?${q}`, {headers: {Accept: 'application/json', Authorization: `Bearer ${bearer}`}});
      if (raw.errors?.length && !Array.isArray(raw.data)) throw new Error('X did not return usable search results.');
      const posts = newest(xPosts(raw, address, chain), Date.now(), minutes);
      const partial = posts.length < 5 && !!raw.meta?.next_token;
      return {...base, status: partial ? 'partial' : 'live', posts, retrievedAt: new Date().toISOString(),
        detail: `${posts.length} exact-address posts. ${partial ? 'Partial search page; additional matches may exist.' : 'Newest available API search matches.'} ${chain !== 'solana' ? 'Network identity is not verified by an address match. ' : ''}Unverified commentary; indexed posts can lag. Cached up to 30 seconds.`};
    } catch (e) {return {...base, status: 'unavailable', posts: [], detail: e.message, retrievedAt: new Date().toISOString()};}
  });
}

export async function recentCallouts(chain, address, minutes = 30, bearer = '') {
  validate(chain, address);
  if (![30, 1440].includes(minutes)) throw new Error('Choose the 30-minute or 24-hour callout window.');
  const [pump, x] = await Promise.all([recentPump(chain, address, minutes), recentX(chain, address, minutes, bearer)]);
  return {address, chain, minutes, sources: [pump, x, {id: 'fomo', name: 'FOMO', status: 'not-connected', posts: [],
    url: 'https://fomo.family/', detail: 'FOMO’s social feed is not connected. Copy the contract and open FOMO to check its callouts.'}], retrievedAt: new Date().toISOString()};
}
