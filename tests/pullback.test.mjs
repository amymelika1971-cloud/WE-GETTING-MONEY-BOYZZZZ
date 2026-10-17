import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPullback} from '../lib/pullback.mjs';

const minute=60_000;
const now=Date.parse('2026-10-17T19:00:30Z');
const closes=[10,11,12,13,14,13,12,11,12,13,14,15,16,15,14,13,14,15,16,17,18,17,16,15,16,17,17,17,16];
const candles=()=>closes.map((close,i)=>({time:Math.floor(now/minute)*minute-(closes.length-i)*minute,open:close,high:close+0.2,low:close-0.2,close,volume:100}));

test('Pullback requires two successive confirmed higher swing highs and higher swing lows',()=>{
  const result=assessPullback(candles(),now);
  assert.equal(result.status,'pullback');
  assert.match(result.detail,/not future returns/);
  assert.equal(assessPullback([...candles()].reverse(),now).status,'pullback');
});

test('Rising structure without a pullback is distinct from broken or unconfirmed structure',()=>{
  const breakout=candles();
  breakout[breakout.length-1]={...breakout.at(-1),open:19,high:19.2,low:18.8,close:19};
  assert.equal(assessPullback(breakout,now).status,'uptrend');
  const broken=candles();
  broken[broken.length-1]={...broken.at(-1),open:14,high:14.2,low:13.8,close:14};
  assert.equal(assessPullback(broken,now).status,'not-confirmed');
  assert.match(assessPullback(broken,now).title,/broken/);
  const falling=candles().map(p=>({...p,open:30-p.close,high:30-p.low,low:30-p.high,close:30-p.close}));
  assert.equal(assessPullback(falling,now).status,'not-confirmed');
});

test('Currently forming candles cannot confirm or break the completed-candle pattern',()=>{
  const forming={time:Math.floor(now/minute)*minute,open:10,high:30,low:1,close:2};
  assert.equal(assessPullback([...candles(),forming],now).status,'pullback');
});

test('Missing, sparse, stale, future, duplicate and invalid candle data stays unknown',()=>{
  assert.equal(assessPullback([],now).status,'unknown');
  assert.equal(assessPullback(null,now).status,'unknown');
  assert.equal(assessPullback(candles().slice(-10),now).status,'unknown');
  assert.equal(assessPullback(candles().filter((_,i)=>i!==10),now).status,'unknown');
  assert.equal(assessPullback([...candles(),candles().at(-1)],now).status,'unknown');
  assert.equal(assessPullback(candles().map(p=>({...p,time:p.time-10*minute})),now).status,'unknown');
  assert.equal(assessPullback([...candles(),{...candles().at(-1),time:Math.floor(now/minute)*minute+minute}],now).status,'unknown');
  const invalid=candles();invalid[10]={...invalid[10],high:invalid[10].close-1};
  assert.equal(assessPullback(invalid,now).status,'unknown');
  const missing=candles();delete missing[10].low;
  assert.equal(assessPullback(missing,now).status,'unknown');
});
