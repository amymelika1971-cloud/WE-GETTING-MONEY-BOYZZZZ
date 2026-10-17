import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInput,equal,number,normalizePair,normalizeGoPlus,normalizeRugCheck,normalizePumpCallouts,sourceForUrl} from '../lib/coin.mjs';
const mint='DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const eth='0x6982508145454Ce325dDbE47a25d4ec3d2311933';
test('Token identity is case-sensitive on Solana, insensitive for EVM hex',()=>{
  assert.equal(equal(mint,mint.toLowerCase()),false);
  assert.equal(equal(eth,eth.toLowerCase()),true);
});
test('Input recognizes exact token and pool links without accepting arbitrary hosts',()=>{
  assert.equal(parseInput(mint).chain,'solana');
  assert.equal(parseInput(eth).chain,'auto');
  assert.equal(parseInput('https://pump.fun/coin/'+mint).address,mint);
  assert.equal(parseInput('https://dexscreener.com/ethereum/'+eth).kind,'pair');
  assert.throws(()=>parseInput('https://dexscreener.com.attacker.test/ethereum/'+eth));
  assert.throws(()=>parseInput('PEPE'));
  assert.throws(()=>parseInput('https://solscan.io/token/'+mint,'ethereum'));
});
test('Empty numeric values never become zero; a genuine zero is retained',()=>{
  for(const input of [null,undefined,'',false,'NaN'])assert.equal(number(input),null);
  assert.equal(number('0'),0);assert.equal(number(0),0);
});
test('A missing market cap is not silently replaced with fully diluted value',()=>{
  const p=normalizePair({baseToken:{address:eth},fdv:100000,volume:{h24:0}});
  assert.equal(p.marketCap,null);assert.equal(p.fdv,100000);
  assert.equal(p.volume.h24,0);assert.equal(p.volume.h1,null);
  assert.equal(p.txns.h24.buys,null);
});
test('Unavailable GoPlus results are not a clean security report',()=>{
  assert.throws(()=>normalizeGoPlus({code:1,result:{}},eth));
  assert.throws(()=>normalizeGoPlus({code:1,result:{[eth.toLowerCase()]:{}}},eth));
});
test('GoPlus unknown flags and taxes stay unknown, while explicit zero remains clear',()=>{
  const s=normalizeGoPlus({code:1,result:{[eth.toLowerCase()]:{is_honeypot:'0',buy_tax:'',sell_tax:'0',holders:[{address:'test',percent:'.12'}]}}},eth);
  assert.equal(s.checks[0].status,'clear');assert.equal(s.checks[1].status,'unknown');
  assert.equal(s.buyTax,null);assert.equal(s.sellTax,0);assert.equal(s.holders[0].percent,12);
});
test('RugCheck null authority means revoked; a missing authority remains unknown',()=>{
  const s=normalizeRugCheck({mint,token:{mintAuthority:null},topHolders:[]},mint);
  assert.equal(s.checks[0].status,'clear');assert.equal(s.checks[1].status,'unknown');
  assert.equal(s.checks[3].status,'unknown');
  assert.throws(()=>normalizeRugCheck({mint:mint.toLowerCase(),token:{}},mint));
});
test('Solana holder percentages are not multiplied again and locks retain exact pool identities',()=>{
  const s=normalizeRugCheck({mint,token:{},topHolders:[{address:'A',pct:8.5}],markets:[{pubkey:'poolA',lp:{lpLockedPct:0}},{pubkey:'poolB',lp:{lpLockedPct:99}}]},mint);
  assert.equal(s.holders[0].percent,8.5);
  assert.equal(s.poolLocks.find(p=>p.address==='poolA').percent,0);
  assert.equal(s.poolLocks.find(p=>p.address==='poolB').percent,99);
});
test('Saved callouts accept known HTTPS sources, reject misleading domains and unsafe schemes',()=>{
  assert.equal(sourceForUrl('https://x.com/a/status/123'),'X / Twitter');
  assert.equal(sourceForUrl('https://pump.fun/coin/'+mint),'Pump.fun');
  assert.equal(sourceForUrl('https://fomo.family/'),'FOMO');
  assert.equal(sourceForUrl('https://x.com.attacker.test/post'),null);
  assert.equal(sourceForUrl('javascript:alert(1)'),null);
  assert.equal(sourceForUrl('https://user:pass@x.com/post'),null);
});
test('Pump callouts match exact addresses and chains, do not mix EVM networks, preserve actual times',()=>{
  const row={coinMint:eth,chain:'eip155:1',calloutId:'one',createdAt:1786097564729,thesis:'A short thesis',calloutPriceUsd:0.001,likes:0};
  assert.equal(normalizePumpCallouts({callouts:[row]},eth,'ethereum').length,1);
  assert.equal(normalizePumpCallouts({callouts:[row]},eth,'base').length,0);
  assert.equal(normalizePumpCallouts({callouts:[{...row,chain:null}]},eth,'ethereum').length,0);
  const sol={...row,coinMint:mint,chain:null};
  const posts=normalizePumpCallouts({callouts:[sol,{...sol,coinMint:mint.toLowerCase()}]},mint,'solana');
  assert.equal(posts.length,1);assert.equal(posts[0].likes,0);assert.equal(posts[0].postedAt,new Date(row.createdAt).toISOString());
});
