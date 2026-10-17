import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates, momentum, newest, pumpPosts, targetMove, xPosts, hasWrittenNarrative} from '../lib/scanner.mjs';
import {rugRisk} from '../lib/rug-risk.mjs';

const mint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const now = Date.parse('2026-10-17T19:00:00Z');
const at = mins => new Date(now - mins * 60_000).toISOString();
const card = (id, mins = 1, extra = {}) => ({coinMint:mint,chain:'solana',position:{userName:'Caller',contentKind:'callout',callout:{calloutId:id,calloutTimestamp:at(mins),thesis:'A longer written thesis from an unverified author.',assetClass:'ASSET_CLASS_TOKEN'}},...extra});
const pair = extra => ({chainId:'solana',pairAddress:'poolA',baseToken:{address:mint,name:'Coin',symbol:'COIN'},quoteToken:{symbol:'SOL'},marketCap:50_000,fdv:50_000,liquidity:{usd:15_000},volume:{m5:5_000},priceChange:{m5:10},txns:{m5:{buys:40,sells:20}},...extra});

test('Latest five are deduplicated, chronological, exact-window and exclude future dates', () => {
  const posts = [7,1,2,6,3,5,4].map(n => ({id:String(n),postedAt:at(n)}));
  posts.push({id:'1',postedAt:at(29)},{id:'old',postedAt:at(31)},{id:'future',postedAt:at(-1)},{id:'invalid',postedAt:'no date'});
  const result = newest(posts,now,30);
  assert.deepEqual(result.map(p=>p.id),['1','2','3','4','5']);
  assert.equal(result[0].postedAt,at(1));
});
test('Pump new-feed posts exclude wrong network, wrong mint, quotes and perps', () => {
  const quote=card('quote');quote.position.contentKind='quote';
  const perp=card('perp');perp.position.callout.perp={symbol:'SOL'};
  const wrongCaip=card('wrongCAIP');wrongCaip.position.callout.chain='eip155:8453';
  const result=pumpPosts([card('yes'),card('network',1,{chain:'base'}),card('case',1,{coinMint:mint.toLowerCase()}),quote,perp,wrongCaip],mint,'solana');
  assert.deepEqual(result.map(p=>p.id),['yes']);
  assert.equal(result[0].postedAt,at(1));
});
test('Discovery uses current reported market cap, never FDV, and excludes old callouts', () => {
  assert.equal(candidates([card('a')],[pair({marketCap:null,fdv:50_000})],now).length,0);
  assert.equal(candidates([card('a')],[pair({marketCap:14_999})],now).length,0);
  assert.equal(candidates([card('a')],[pair({marketCap:200_000})],now).length,0);
  assert.equal(candidates([card('a')],[pair({marketCap:15_000})],now).length,1);
  assert.equal(candidates([card('a',31)],[pair({})],now).length,0);
});
test('Narrative screen rejects empty hype and address-only promotion but retains a written story', () => {
  assert.equal(hasWrittenNarrative('buy this gem now send it to the moon lets go'),false);
  assert.equal(hasWrittenNarrative('🔥🔥🔥 '+mint),false);
  assert.equal(hasWrittenNarrative('The original cat video is spreading across animation communities, with new fan artwork appearing daily.'),true);
});
test('Narrative screening reads the full thesis before a short excerpt can hide guaranteed claims', () => {
  const c=card('long');
  c.position.callout.thesis='The original cat video is spreading across animation communities with new fan artwork appearing daily. The artists are organizing an exhibition featuring the original characters. Guaranteed risk-free returns.';
  const posts=pumpPosts([c],mint,'solana');
  assert.equal(posts[0].text.includes('Guaranteed'),false);
  assert.equal(hasWrittenNarrative(posts[0].text),true);
  assert.equal(posts[0].writtenNarrative,false);
  assert.equal(candidates([c],[pair({marketCap:17000})],now)[0].thesis,null);
});
test('Repeated calls by one author do not count as independent callers', () => {
  const one=card('one'), two=card('two');
  one.position.userId='same-id';two.position.userId='same-id';
  const result=candidates([one,two],[pair({marketCap:17000})],now);
  assert.equal(result[0].observedCallouts,2);
  assert.equal(result[0].observedCallers,1);
});
test('Market verification never attributes quote-token or wrong-chain metrics to a candidate', () => {
  assert.equal(candidates([card('a')],[pair({chainId:'base'})],now).length,0);
  assert.equal(candidates([card('a')],[pair({baseToken:{address:'different'},quoteToken:{address:mint}})],now).length,0);
});
test('Largest-liquidity exact pool is used; missing liquidity or swaps cannot pass momentum', () => {
  const result=candidates([card('a')],[pair({pairAddress:'small',liquidity:{usd:200}}),pair({pairAddress:'deep',liquidity:{usd:18000}})],now);
  assert.equal(result[0].pair.address,'deep');
  assert.equal(result[0].momentum.passes,true);
  assert.equal(momentum({...result[0].pair,liquidity:null}).passes,false);
  assert.equal(momentum({...result[0].pair,txns:{m5:{buys:30,sells:null}}}).passes,false);
  assert.equal(targetMove(50_000).multiple,4);
  assert.equal(targetMove(50_000).percent,300);
  assert.equal(targetMove(null),null);
});
test('X results require the entire address, preserve actual time, reject Solana case mismatches', () => {
  const raw={data:[{id:'1',text:'Look at '+mint,created_at:at(2)},{id:'2',text:mint.toLowerCase(),created_at:at(1)},{id:'3',text:mint+'more',created_at:at(1)},{id:'4',text:'See link',entities:{urls:[{expanded_url:'https://pump.fun/coin/'+mint}]},created_at:at(3)}]};
  assert.deepEqual(xPosts(raw,mint,'solana').map(p=>p.id),['1','4']);
});
test('Rug checker uses only exact pool locks and reports missing creator holdings as unknown', () => {
  const report={checks:[],holders:[],risks:[],poolLocks:[{address:'otherPool',percent:100}],retrievedAt:at(0)};
  const risk=rugRisk(report,{chain:'solana',address:'selectedPool',liquidity:20000},now);
  assert.equal(risk.checks.find(c=>c.label==='Selected pool LP lock').severity,'unknown');
  assert.equal(risk.checks.find(c=>c.label==='Creator holdings').severity,'unknown');
  assert.equal(risk.checks.find(c=>c.label==='Sell simulation').severity,'unknown');
  assert.equal(risk.unknown>=4,true);
  assert.equal(risk.stale,false);
});
test('Rug checker prioritizes critical flags, keeps stale reports visible and does not call absent reports safe', () => {
  const report={checks:[{label:'Freeze authority',status:'flag',value:'Enabled'}],risks:[{name:'Low LP providers',level:'danger'}],holders:[{percent:60}],poolLocks:[],retrievedAt:at(3)};
  const risk=rugRisk(report,{chain:'solana',liquidity:1000},now);
  assert.equal(risk.high,3);
  assert.equal(risk.title,'High-risk signals');
  assert.equal(risk.stale,true);
  assert.equal(rugRisk(null,{chain:'solana',liquidity:15000},now).title,'Risk check unavailable');
});
test('Invalid liquidity-lock and concentration percentages cannot become clear results', () => {
  const risk=rugRisk({checks:[],risks:[],poolLocks:[{address:'pool',percent:101}],holders:[{percent:80},{percent:80}]},{chain:'solana',address:'pool',liquidity:20000},now);
  assert.equal(risk.checks.find(c=>c.label==='Selected pool LP lock').severity,'unknown');
  assert.equal(risk.checks.find(c=>c.label==='Top reported accounts').severity,'unknown');
});
