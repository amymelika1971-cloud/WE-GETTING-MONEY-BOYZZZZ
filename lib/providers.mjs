import {CHAINS,parseInput,validAddress,equal,normalizePair,normalizeGoPlus,normalizeRugCheck,normalizePumpCallouts,number} from './coin.mjs';
const cache=new Map();
const inflight=new Map();
async function cached(key,ttl,fn){
  const found=cache.get(key);if(found&&found.until>Date.now())return found.value;
  if(inflight.has(key))return inflight.get(key);
  const promise=(async()=>{const value=await fn();if(cache.size>200)cache.delete(cache.keys().next().value);cache.set(key,{value,until:Date.now()+ttl});return value;})();
  inflight.set(key,promise);try{return await promise;}finally{inflight.delete(key);}
}
async function get(url,timeout=14000){
  const res=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeout)});
  if(!res.ok){const error=new Error(res.status===429?'The data provider is rate-limiting requests. Please try again shortly.':`The data provider is unavailable (HTTP ${res.status}).`);error.status=res.status;throw error;}
  return res.json();
}
export async function scan(input,chain='auto') {
  const p=parseInput(input,chain);
  return cached('scan:'+JSON.stringify(p),4000,async()=>{
    let pairs=[],selected=p.address,network=p.chain;
    if(p.kind==='pair'){
      const data=await get(`https://api.dexscreener.com/latest/dex/pairs/${p.chain}/${p.address}`);
      const candidate=data.pairs?.find(x=>equal(x.pairAddress,p.address)&&x.chainId===p.chain);
      if(!candidate)throw new Error('No indexed pool was found for that link. Try the token’s contract address.');
      selected=candidate.baseToken.address;
      const all=await get(`https://api.dexscreener.com/token-pairs/v1/${network}/${selected}`);
      pairs=Array.isArray(all)?all:[candidate];
      if(!pairs.some(x=>equal(x.pairAddress,p.address)))pairs.push(candidate);
    }else if(network==='auto'){
      const data=await get(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(selected)}`);
      const matching=(data.pairs||[]).filter(x=>equal(x.baseToken?.address,selected)&&CHAINS[x.chainId]);
      const networks=[...new Set(matching.map(x=>x.chainId))];
      if(networks.length>1)throw new Error('This address appears on multiple networks: '+networks.map(x=>CHAINS[x].name).join(', ')+'. Select the correct network and scan again.');
      if(!networks.length)throw new Error('No indexed token was found. Select its network explicitly, verify the full contract address, and try again.');
      network=networks[0];const all=await get(`https://api.dexscreener.com/token-pairs/v1/${network}/${selected}`);pairs=Array.isArray(all)?all:[];
    }else{const all=await get(`https://api.dexscreener.com/token-pairs/v1/${network}/${selected}`);pairs=Array.isArray(all)?all:[];}
    pairs=pairs.filter(x=>x.chainId===network&&equal(x.baseToken?.address,selected));
    pairs=[...new Map(pairs.map(x=>[x.pairAddress,x])).values()].sort((a,b)=>(number(b.liquidity?.usd)||0)-(number(a.liquidity?.usd)||0));
    if(!pairs.length)throw new Error('No indexed trading pools found. Very new, pre-migration, inactive or unsupported tokens may not be covered yet. Verify the network and address.');
    const normalized=pairs.map(normalizePair);const token=normalized[0].base;
    return {address:token.address,chain:network,chainName:CHAINS[network].name,name:token.name,symbol:token.symbol,pairs:normalized,selectedPair:p.kind==='pair'?p.address:normalized[0].address,explorer:CHAINS[network].explorer+token.address,retrievedAt:new Date().toISOString(),provider:'DEX Screener'};
  });
}
export async function security(chain,address){
  if(!CHAINS[chain]||!validAddress(address,chain))throw new Error('Invalid token or network.');
  return cached('security:'+chain+':'+address,30000,async()=>{
    const d=chain==='solana'?normalizeRugCheck(await get(`https://api.rugcheck.xyz/v1/tokens/${address}/report`,18000),address):normalizeGoPlus(await get(`https://api.gopluslabs.io/api/v1/token_security/${CHAINS[chain].id}?contract_addresses=${address}`,18000),address);
    return {...d,retrievedAt:new Date().toISOString()};
  });
}
export async function history(chain,pair,address,period='24H'){
  if(!CHAINS[chain]||!validAddress(address,chain)||(!validAddress(pair,chain)&&!(chain!=='solana'&&/^0x[0-9a-fA-F]{64}$/.test(pair))))throw new Error('Invalid chart request.');
  const options={'1H':{frame:'minute',aggregate:1,limit:60},'24H':{frame:'minute',aggregate:5,limit:288},'7D':{frame:'hour',aggregate:1,limit:168}};
  const o=options[period];if(!o)throw new Error('Invalid chart period.');
  return cached('history:'+chain+':'+pair+':'+address+':'+period,60000,async()=>{
    const data=await get(`https://api.geckoterminal.com/api/v2/networks/${CHAINS[chain].gecko}/pools/${pair}/ohlcv/${o.frame}?aggregate=${o.aggregate}&limit=${o.limit}&currency=usd&token=${address}`);
    const rows=data.data?.attributes?.ohlcv_list;
    if(!Array.isArray(rows)||rows.length<2)throw new Error('Not enough indexed chart data for this pool yet.');
    const points=rows.filter(r=>r.length>=6&&r.every(v=>number(v)!==null)&&r[4]>0).map(r=>({time:r[0]*1000,open:r[1],high:r[2],low:r[3],close:r[4],volume:r[5]})).sort((a,b)=>a.time-b.time);
    return {points,period,provider:'GeckoTerminal',retrievedAt:new Date().toISOString()};
  });
}
export async function callouts(chain,address){
  if(!CHAINS[chain]||!validAddress(address,chain))throw new Error('Invalid token or network.');
  return cached('callouts:'+chain+':'+address,60000,async()=>{
    let posts=[],pumpStatus='live',pumpError=null;
    try{
      const caip=chain==='solana'?'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp':`eip155:${CHAINS[chain].id}`;
      const raw=await get(`https://frontend-api-v3.pump.fun/callout/coin/${address}?limit=12&chain=${encodeURIComponent(caip)}`,14000);
      posts=normalizePumpCallouts(raw,address,chain);
    }catch(e){pumpStatus='unavailable';pumpError=e.message;}
    return {sources:[{id:'pump',name:'Pump.fun',status:pumpStatus,url:`https://pump.fun/coin/${address}`,detail:pumpStatus==='live'?`${posts.length} matching callouts returned. Provider-selected posts can be historical.`:'The public callout feed is temporarily unavailable. You can still open the source.'},{id:'x',name:'X / Twitter',status:'external',url:`https://x.com/search?q=${encodeURIComponent('"'+address+'"')}&src=typed_query&f=live`,detail:'Exact-address search. Live post ingestion requires authorized X API access.'},{id:'fomo',name:'FOMO',status:'external',url:'https://fomo.family/',detail:'Open FOMO and search the copied contract. Its social feed is not connected here.'}],posts,pumpError,retrievedAt:new Date().toISOString()};
  });
}
