export const CHAINS = {
  solana: {name:'Solana', gecko:'solana', explorer:'https://solscan.io/token/'},
  ethereum: {name:'Ethereum', id:'1', gecko:'eth', explorer:'https://etherscan.io/token/'},
  base: {name:'Base', id:'8453', gecko:'base', explorer:'https://basescan.org/token/'},
  bsc: {name:'BNB Chain', id:'56', gecko:'bsc', explorer:'https://bscscan.com/token/'},
  arbitrum: {name:'Arbitrum', id:'42161', gecko:'arbitrum', explorer:'https://arbiscan.io/token/'},
  polygon: {name:'Polygon', id:'137', gecko:'polygon_pos', explorer:'https://polygonscan.com/token/'},
  avalanche: {name:'Avalanche', id:'43114', gecko:'avax', explorer:'https://snowtrace.io/token/'},
  optimism: {name:'Optimism', id:'10', gecko:'optimism', explorer:'https://optimistic.etherscan.io/token/'},
};
export const SAMPLES = [
  {name:'BONK', chain:'solana', address:'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'},
  {name:'PEPE', chain:'ethereum', address:'0x6982508145454Ce325dDbE47a25d4ec3d2311933'},
];
export function number(value) {
  if(value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n=Number(value); return Number.isFinite(n)?n:null;
}
export function equal(a,b) {
  if(typeof a!=='string'||typeof b!=='string')return false;
  return a.startsWith('0x')&&b.startsWith('0x')?a.toLowerCase()===b.toLowerCase():a===b;
}
export function safeUrl(value) {
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password?u.href:null; } catch {return null;}
}
export function validAddress(value,chain) {
  return chain==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value):/^0x[0-9a-fA-F]{40}$/.test(value);
}
export function parseInput(value,network='auto') {
  let input=String(value||'').trim(),chain=network,kind='token';
  if(!input||input.length>500)throw new Error('Paste a token contract address or a supported token link.');
  if(chain!=='auto'&&!CHAINS[chain])throw new Error('Choose a supported network.');
  if(/^https?:\/\//i.test(input)) {
    const u=new URL(input);const host=u.hostname.replace(/^www\./,'');const parts=u.pathname.split('/').filter(Boolean);
    if(u.protocol!=='https:')throw new Error('Use an HTTPS token link.');
    if(host==='dexscreener.com'&&parts.length===2&&CHAINS[parts[0]]) {chain=parts[0];input=parts[1];kind='pair';}
    else if(host==='pump.fun'&&parts[0]==='coin'&&parts.length===2){chain='solana';input=parts[1];}
    else {
      const match=Object.entries(CHAINS).find(([,v])=>new URL(v.explorer).hostname===host);
      if(!match||parts[0]!=='token'||parts.length!==2)throw new Error('Use a contract address, DEX Screener pair link, Pump.fun coin link, or explorer token link.');
      chain=match[0];input=parts[1];
    }
    if(network!=='auto'&&network!==chain)throw new Error('The link uses a different network. Select Auto-detect or its network.');
  }
  if(chain==='auto'&&!input.startsWith('0x'))chain='solana';
  const longPool=kind==='pair'&&chain!=='solana'&&/^0x[0-9a-fA-F]{64}$/.test(input);
  if(!validAddress(input,chain)&&!longPool)throw new Error('That does not look like a contract address. Use the full address, not the coin name or ticker.');
  return {address:input,chain,kind};
}
export function normalizePair(p) {
  return {chain:p.chainId,address:p.pairAddress,dex:p.dexId,labels:p.labels||[],url:safeUrl(p.url),base:p.baseToken,quote:p.quoteToken,price:number(p.priceUsd),marketCap:number(p.marketCap),fdv:number(p.fdv),liquidity:number(p.liquidity?.usd),volume:Object.fromEntries(['m5','h1','h6','h24'].map(k=>[k,number(p.volume?.[k])])),change:Object.fromEntries(['m5','h1','h6','h24'].map(k=>[k,number(p.priceChange?.[k])])),txns:Object.fromEntries(['m5','h1','h6','h24'].map(k=>[k,{buys:number(p.txns?.[k]?.buys),sells:number(p.txns?.[k]?.sells)}])),createdAt:number(p.pairCreatedAt),image:safeUrl(p.info?.imageUrl),socials:(p.info?.socials||[]).map(s=>({type:s.type||s.platform||'Social',url:safeUrl(s.url)})).filter(s=>s.url),websites:(p.info?.websites||[]).map(s=>({label:s.label||'Website',url:safeUrl(s.url)})).filter(s=>s.url)};
}
function check(label,value,description,good='Not detected',bad='Detected') {
  const status=value===true?'flag':value===false?'clear':'unknown';
  return {label,status,value:status==='flag'?bad:status==='clear'?good:'Unknown',description};
}
const flag=v=>v==='1'?true:v==='0'?false:null;
export function normalizeGoPlus(raw,address) {
  const d=raw?.result?.[address.toLowerCase()];
  if(raw?.code!==1||!d||!Object.keys(d).length)throw new Error('GoPlus has not returned a security report for this token.');
  const checks=[
    check('Honeypot signal',flag(d.is_honeypot),'Provider simulation signal. Not a guarantee you can sell.'),
    check('Mint function',flag(d.is_mintable),'A mint function may allow supply expansion. Permissions may affect whether it can be used.'),
    check('Blacklist function',flag(d.is_blacklisted),'The contract contains blacklist functionality; this is not proof it is currently usable.'),
    check('Pausable transfers',flag(d.transfer_pausable),'The contract may contain a function to pause transfers. Ownership and permissions matter.'),
    check('Proxy contract',flag(d.is_proxy),'Proxy implementations may be changeable.'),
    check('Source code',d.is_open_source==='1'?false:d.is_open_source==='0'?true:null,'Whether the provider reports publicly available contract source.','Available','Unavailable'),
    check('Hidden ownership',flag(d.hidden_owner),'The provider checks for hidden ownership mechanisms.'),
    check('Owner balance changes',flag(d.owner_change_balance),'A function may allow an owner to change holder balances.'),
    check('Full-sale restriction',flag(d.cannot_sell_all),'The provider detects a function that can restrict selling an entire balance.'),
    check('Modifiable trading tax',flag(d.slippage_modifiable),'Trading taxes may be changeable, depending on effective permissions.'),
    check('Per-wallet tax changes',flag(d.personal_slippage_modifiable),'A function may assign different tax rates to individual addresses.'),
    check('Trading cooldown',flag(d.trading_cooldown),'A cooldown may limit how frequently tokens can be traded.'),
  ];
  const holders=(d.holders||[]).slice(0,10).map(h=>({address:h.address,owner:null,percent:number(h.percent)===null?null:Number(h.percent)*100,label:h.tag||(h.is_contract==='1'?'Contract account':'Account'),isContract:h.is_contract==='1',insider:null}));
  return {provider:'GoPlus',url:'https://gopluslabs.io/token-security/'+address,checks,risks:d.other_potential_risks?[{name:'Additional provider warning',description:String(d.other_potential_risks),level:'warn'}]:[],holders,holderCount:number(d.holder_count),creator:d.creator_address||null,creatorPercent:number(d.creator_percent)===null?null:Number(d.creator_percent)*100,owner:d.owner_address===undefined?null:d.owner_address||'No owner reported',buyTax:number(d.buy_tax)===null?null:Number(d.buy_tax)*100,sellTax:number(d.sell_tax)===null?null:Number(d.sell_tax)*100,poolLocks:[],note:d.note||null};
}
export function normalizeRugCheck(d,address) {
  if(!d||!equal(d.mint,address)||!d.token)throw new Error('RugCheck has not returned a complete report for this mint.');
  const authority=key=>Object.hasOwn(d.token,key)?d.token[key]===null?false:typeof d.token[key]==='string'&&d.token[key].length>0?true:null:null;
  const checks=[
    check('Mint authority',authority('mintAuthority'),'An enabled authority can create additional tokens.','Revoked','Enabled'),
    check('Freeze authority',authority('freezeAuthority'),'An enabled authority can freeze token accounts.','Revoked','Enabled'),
    check('Mutable metadata',typeof d.tokenMeta?.mutable==='boolean'?d.tokenMeta.mutable:null,'The name, image or metadata may be changed.','Immutable','Mutable'),
    check('Provider rug flag',typeof d.rugged==='boolean'?d.rugged:null,'RugCheck’s recorded rug flag. An absent flag is not a safety guarantee.'),
  ];
  const known=d.knownAccounts||{};
  const holders=(d.topHolders||[]).slice(0,10).map(h=>({address:h.address,owner:h.owner||null,percent:number(h.pct),label:known[h.owner]?.name||known[h.address]?.name||'Token account',isContract:null,insider:typeof h.insider==='boolean'?h.insider:null}));
  return {provider:'RugCheck',url:'https://rugcheck.xyz/tokens/'+address,checks,risks:(d.risks||[]).map(r=>({name:String(r.name),description:String(r.description||''),level:r.level==='danger'?'danger':'warn'})),holders,holderCount:number(d.totalHolders),creator:d.creator||null,owner:null,buyTax:null,sellTax:null,poolLocks:(d.markets||[]).filter(m=>m.pubkey).map(m=>({address:m.pubkey,percent:number(m.lp?.lpLockedPct),type:m.marketType})),note:null};
}
export function sourceForUrl(value) {
  const clean=safeUrl(value);if(!clean)return null;
  const host=new URL(clean).hostname.replace(/^www\./,'');
  if(host==='x.com'||host==='twitter.com')return 'X / Twitter';
  if(host==='pump.fun')return 'Pump.fun';
  if(host==='fomo.family'||host.endsWith('.fomo.family'))return 'FOMO';
  return null;
}
export function normalizePumpCallouts(raw,address,chain) {
  if(!Array.isArray(raw?.callouts))throw new Error('Pump.fun did not return a callout list.');
  const expectedChain=chain==='solana'?'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp':`eip155:${CHAINS[chain]?.id}`;
  return raw.callouts.filter(c=>equal(c.coinMint,address)&&!c.perp&&(!c.chain?chain==='solana':c.chain===expectedChain)).slice(0,12).map(c=>{
    const text=String(c.thesis||'').replace(/@\[([^\]]+)\]\([^)]*\)/g,'@$1').trim();
    const words=text.split(/\s+/);const stamp=typeof c.createdAt==='number'?c.createdAt:Date.parse(c.createdAt);
    return {id:String(c.calloutId),source:'Pump.fun',author:String(c.userName||c.username||c.userId||'Unknown caller'),authorIsWallet:!c.userName&&!c.username&&!!c.userId,text:words.slice(0,24).join(' ')+(words.length>24?'…':''),postedAt:Number.isFinite(stamp)?new Date(stamp).toISOString():null,priceUsd:number(c.calloutPriceUsd),likes:number(c.likes),url:`https://pump.fun/callouts/${address}/${encodeURIComponent(String(c.calloutId))}`};
  }).sort((a,b)=>(Date.parse(b.postedAt||'')||0)-(Date.parse(a.postedAt||'')||0));
}
