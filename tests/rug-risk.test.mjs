import test from 'node:test';
import assert from 'node:assert/strict';
import {rugRisk} from '../lib/rug-risk.mjs';

const now=Date.parse('2026-10-17T19:00:00Z');
const pair={chain:'solana',address:'selectedPool',liquidity:20000};
const report=extra=>({checks:[],risks:[],holders:[{percent:1}],poolLocks:[{address:'selectedPool',percent:100}],creatorPercent:0,retrievedAt:new Date(now).toISOString(),...extra});

test('Empty provider checks retain explicit unknown authority evidence and incomplete summary',()=>{
  const result=rugRisk(report(),pair,now);
  for(const label of ['Mint authority','Freeze authority','Mutable metadata','Provider rug flag']){
    assert.equal(result.checks.find(c=>c.label===label)?.severity,'unknown');
  }
  assert.equal(result.high,0);
  assert.equal(result.review,0);
  assert.equal(result.title,'Risk evidence incomplete');
  assert.equal(result.checks.find(c=>c.label==='Creator holdings').severity,'clear');
  assert.equal(result.checks.find(c=>c.label==='Selected pool LP lock').severity,'clear');
});

test('Partial EVM reports preserve known findings while missing capabilities stay unknown',()=>{
  const result=rugRisk(report({checks:[{label:'Honeypot signal',status:'clear',value:'Not detected'}],sellTax:0}),{...pair,chain:'ethereum'},now);
  assert.equal(result.checks.find(c=>c.label==='Honeypot signal').severity,'clear');
  for(const label of ['Mint function','Blacklist function','Pausable transfers','Hidden ownership','Owner balance changes','Full-sale restriction','Per-wallet tax changes']){
    assert.equal(result.checks.find(c=>c.label===label)?.severity,'unknown');
  }
  assert.equal(result.checks.filter(c=>c.label==='Honeypot signal').length,1);
  assert.equal(result.title,'Risk evidence incomplete');
});

test('High-risk, review and absent-report summaries retain precedence over incomplete evidence',()=>{
  assert.equal(rugRisk(report({checks:[{label:'Freeze authority',status:'flag',value:'Enabled'}]}),pair,now).title,'High-risk signals');
  assert.equal(rugRisk(report({checks:[{label:'Mutable metadata',status:'flag',value:'Mutable'}]}),pair,now).title,'Review required');
  assert.equal(rugRisk(null,pair,now).title,'Risk check unavailable');
});
