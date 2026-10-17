import {CHAINS, equal, normalizePair, number, validAddress} from './coin.mjs';

export const MIN_CAP = 15_000;
export const TARGET_CAP = 200_000;
export const WINDOW_MS = 30 * 60_000;
export const PUMP_CHAINS = new Set(['solana', 'ethereum', 'base', 'bsc']);

export function excerpt(value) {
  const clean = String(value || '').replace(/@\[([^\]]+)\]\([^)]*\)/g, '@$1').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  return words.slice(0, 24).join(' ').slice(0, 420) + (words.length > 24 || clean.length > 420 ? '…' : '');
}

export function newest(posts, now = Date.now(), minutes = 30, limit = 5) {
  const cutoff = now - minutes * 60_000;
  const sorted = posts.filter(p => p?.id && Number.isFinite(Date.parse(p.postedAt)) && Date.parse(p.postedAt) >= cutoff && Date.parse(p.postedAt) <= now)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  const seen = new Set();
  return sorted.filter(p => {if (seen.has(p.id)) return false; seen.add(p.id); return true;}).slice(0, limit);
}

// New-feed cards bind mint + network to an actual original callout, not a ticker.
export function pumpPosts(cards, address, chain) {
  const caip = chain === 'solana' ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' : `eip155:${CHAINS[chain]?.id}`;
  return cards.filter(card => {
    const position = card?.position, call = position?.callout;
    return card.chain === chain && equal(card.coinMint, address) && call?.calloutId && !call.perp &&
      (!call.chain || call.chain === caip) && position.contentKind !== 'quote' &&
      (!call.assetClass || call.assetClass === 'ASSET_CLASS_TOKEN');
  }).map(card => {
    const p = card.position, c = p.callout;
    return {id: String(c.calloutId), source: 'Pump.fun', author: String(p.userName || 'Unknown caller'), authorId: p.userId || null,
      text: excerpt(c.thesis), writtenNarrative: hasWrittenNarrative(c.thesis), postedAt: c.calloutTimestamp, likes: number(c.likes),
      url: `https://pump.fun/callouts/${address}/${encodeURIComponent(c.calloutId)}`};
  });
}

export function targetMove(cap) {
  const n = number(cap);
  return n !== null && n > 0 ? {multiple: TARGET_CAP / n, percent: (TARGET_CAP / n - 1) * 100} : null;
}

export function momentum(pair) {
  const buys = pair.txns?.m5?.buys, sells = pair.txns?.m5?.sells;
  const swaps = buys == null || sells == null ? null : buys + sells;
  const checks = [
    {label: 'Liquidity ≥ $10K', pass: pair.liquidity != null && pair.liquidity >= 10_000},
    {label: '5m volume ≥ $3K', pass: pair.volume?.m5 != null && pair.volume.m5 >= 3_000},
    {label: '5m price rising', pass: pair.change?.m5 != null && pair.change.m5 > 0},
    {label: '20+ swaps; buys > sells', pass: swaps !== null && swaps >= 20 && buys > sells},
  ];
  return {checks, passes: checks.every(c => c.pass), swaps};
}

// A minimal written-story screen, not sentiment analysis or fact verification.
// Pure hype, URLs and contract strings are not evidence of a narrative.
export function hasWrittenNarrative(text) {
  const clean = String(text || '').replace(/https?:\/\/\S+|@[\w]+|\$[\w]+|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b|0x[0-9a-fA-F]{40}/g, '');
  if (/\b(?:guaranteed|risk[ -]?free|free\s+\d+\s*[x×])\b/i.test(clean)) return false;
  const words = clean.toLowerCase().match(/[a-z]{2,}/g) || [];
  const filler = new Set('the a an this that these those it its is are was were be been has have had i we you they he she my our your his her their for from of to in on at and or but with as if so by about all some any very really more most just out up down now soon today time dont not can will going gonna get got lets let go come one like think know looks look coin token ca buy sell bought selling ape aped send sending sent pump pumping moon mooning gem gems bullish early entry launch launched lfg re ve ll no yes telling tell called yet giga fr frfr real good shit here there right free amount dope image ticker way past ath doesn doesnt bounce runner nice legit works followers tech developing development project team strong dead back bro guys best potential holding hold worth chance never lol lmao'.split(' '));
  return words.length >= 8 && new Set(words.filter(w => !filler.has(w))).size >= 5;
}

export function candidates(cards, rawPairs, now = Date.now()) {
  const addresses = [...new Set(cards.filter(c => c?.chain === 'solana' && validAddress(c.coinMint, 'solana')).map(c => c.coinMint))];
  return addresses.flatMap(address => {
    const choices = rawPairs.filter(p => p.chainId === 'solana' && equal(p.baseToken?.address, address))
      .map(normalizePair).sort((a, b) => (b.liquidity ?? -1) - (a.liquidity ?? -1));
    const pair = choices[0];
    // Never substitute FDV or another asset's valuation for reported market cap.
    if (!pair || pair.marketCap === null || pair.marketCap < MIN_CAP || pair.marketCap >= TARGET_CAP) return [];
    const posts = newest(pumpPosts(cards, address, 'solana'), now, 30, 100);
    if (!posts.length) return [];
    // Screen the full source text, before excerpting can hide a claim or hype.
    const thesis = posts.find(p => p.writtenNarrative) || null;
    const observedCallers = new Set(posts.map(p => p.authorId || (p.author !== 'Unknown caller' ? p.author : null)).filter(Boolean)).size;
    return [{address, chain: 'solana', name: pair.base.name, symbol: pair.base.symbol, image: pair.image,
      pair, momentum: momentum(pair), target: targetMove(pair.marketCap), newestCall: posts[0],
      observedCallouts: posts.length, observedCallers, thesis}];
  }).sort((a, b) => Number(b.momentum.passes) - Number(a.momentum.passes) || (b.pair.volume.m5 ?? -1) - (a.pair.volume.m5 ?? -1));
}

export function xPosts(raw, address, chain) {
  const users = new Map((raw.includes?.users || []).map(u => [u.id, u.username]));
  // Search can be fuzzy. Recheck the entire address and token boundaries locally.
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${address}($|[^A-Za-z0-9])`, chain === 'solana' ? '' : 'i');
  return (raw.data || []).filter(p => {
    const haystack = [p.text, ...(p.entities?.urls || []).map(u => u.expanded_url)].join(' ');
    return pattern.test(haystack) && /^\d+$/.test(p.id);
  }).map(p => ({id: p.id, source: 'X / Twitter', author: users.get(p.author_id) || 'Unknown author',
    text: excerpt(p.text), postedAt: p.created_at, likes: number(p.public_metrics?.like_count),
    url: `https://x.com/i/status/${p.id}`}));
}
