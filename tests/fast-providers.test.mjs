import test from 'node:test';
import assert from 'node:assert/strict';

const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const mint=i=>'A'.repeat(30)+alphabet[i%alphabet.length]+alphabet[Math.floor(i/alphabet.length)];
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('Discovery retains near-$15K matches when 40 broader-cap candidates rank ahead',async t=>{
  const now=Date.now();
  const cards=Array.from({length:41},(_,i)=>({coinMint:mint(i),chain:'solana',position:{userId:'caller-'+i,userName:'Caller '+i,contentKind:'callout',callout:{calloutId:'call-'+i,calloutTimestamp:new Date(now-i*1000).toISOString(),thesis:'The original cat video is spreading across animation communities with new fan artwork appearing daily.',assetClass:'ASSET_CLASS_TOKEN'}}}));
  const pairs=cards.map((c,i)=>({chainId:'solana',pairAddress:'pool'+i,baseToken:{address:c.coinMint,name:'Coin '+i,symbol:'C'+i},marketCap:i===40?17000:60000,liquidity:{usd:15000},volume:{m5:5000},priceChange:{m5:10},txns:{m5:{buys:40,sells:20}}}));
  const requests=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const u=new URL(String(input));requests.push(u);
    if(u.hostname==='frontend-api-v3.pump.fun')return json({coins:u.searchParams.get('maxMarketCapUsd')==='30000'?[cards[40]]:cards.slice(0,40)});
    assert.equal(u.hostname,'api.dexscreener.com');
    const addresses=new Set(u.pathname.split('/').at(-1).split(','));
    return json(pairs.filter(p=>addresses.has(p.baseToken.address)));
  });
  const {discover}=await import('../lib/fast-providers.mjs?test=discovery-band');
  const result=await discover();
  assert.equal(result.coins.length,41);
  assert.equal(result.coins[40].address,mint(40));
  assert.equal(result.coins.filter(c=>c.pair.marketCap>=15000&&c.pair.marketCap<30000).length,1);
  assert.equal(result.checked,41);
  assert.equal(result.partial,false);
  assert.equal(requests.filter(u=>u.hostname==='api.dexscreener.com').length,2);
});

test('Authorized X adapter requests official tweet fields and preserves returned publication time',async t=>{
  const postedAt=new Date(Date.now()-60000).toISOString();
  let requested=false;
  t.mock.method(globalThis,'fetch',async(input,options)=>{
    const u=new URL(String(input));requested=true;
    assert.equal(u.origin+u.pathname,'https://api.x.com/2/tweets/search/recent');
    assert.equal(u.searchParams.get('tweet.fields'),'created_at,public_metrics,entities');
    assert.equal(u.searchParams.has('post.fields'),false);
    assert.equal(options.headers.Authorization,'Bearer test-authorized-access');
    return json({data:[{id:'123456',author_id:'42',text:'An original animation story for '+mint(0),created_at:postedAt,public_metrics:{like_count:2}}],includes:{users:[{id:'42',username:'example'}]}});
  });
  const {recentX}=await import('../lib/fast-providers.mjs?test=x-fields');
  const source=await recentX('solana',mint(0),30,'test-authorized-access');
  assert.equal(requested,true);
  assert.equal(source.status,'live');
  assert.equal(source.posts.length,1);
  assert.equal(source.posts[0].postedAt,postedAt);
  assert.equal(source.posts[0].author,'example');
});
