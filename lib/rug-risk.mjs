import {equal, number} from './coin.mjs';

// Transparent signal counts, not an invented probability of being safe.
export function rugRisk(report, pair, now = Date.now()) {
  const pct = n => n.toFixed(1) + '%';
  const critical = new Set(['Mint authority', 'Freeze authority', 'Provider rug flag', 'Honeypot signal', 'Mint function', 'Blacklist function', 'Pausable transfers', 'Hidden ownership', 'Owner balance changes', 'Full-sale restriction', 'Per-wallet tax changes']);
  const requiredLabels = pair?.chain === 'solana' ? ['Mint authority', 'Freeze authority', 'Mutable metadata', 'Provider rug flag'] : ['Honeypot signal', 'Mint function', 'Blacklist function', 'Pausable transfers', 'Proxy contract', 'Source code', 'Hidden ownership', 'Owner balance changes', 'Full-sale restriction', 'Modifiable trading tax', 'Per-wallet tax changes', 'Trading cooldown'];
  const sourceChecks = Array.isArray(report?.checks) ? [...report.checks] : [];
  for (const label of requiredLabels) {
    if (!sourceChecks.some(c => c.label === label)) sourceChecks.push({label, status: 'unknown', value: 'Unknown', description: 'The provider has not returned usable evidence for this check.'});
  }
  const checks = sourceChecks.map(c => ({...c, severity: c.status === 'flag' ? critical.has(c.label) ? 'danger' : 'warn' : c.status}));
  const add = (label, value, severity, description) => checks.push({label, value, severity, status: severity === 'danger' || severity === 'warn' ? 'flag' : severity, description});
  const liq = number(pair?.liquidity);
  add('Trading liquidity', liq === null ? 'Unknown' : '$' + Math.round(liq).toLocaleString('en-US'), liq === null ? 'unknown' : liq < 5_000 ? 'danger' : liq < 10_000 ? 'warn' : 'clear', 'USD liquidity in the selected pool. Below $5K is flagged high; below $10K needs review. This is not executable depth.');
  const lock = (report?.poolLocks || []).find(p => equal(p.address, pair?.address));
  const locked = number(lock?.percent);
  const validLock = locked !== null && locked >= 0 && locked <= 100;
  add('Selected pool LP lock', validLock ? pct(locked) + ' reported locked' : 'Unknown', !validLock ? 'unknown' : locked < 80 ? 'warn' : 'clear', 'Provider-reported locked LP percentage for this exact pool only. Lock expiry, withdrawal paths and other pools are not verified.');
  const accounts = (report?.holders || []).filter(h => number(h.percent) !== null && h.percent >= 0 && h.percent <= 100);
  const total = accounts.reduce((sum, h) => sum + h.percent, 0);
  add('Top reported accounts', accounts.length && total <= 100.1 ? pct(total) + ` across ${accounts.length}` : 'Unknown', !accounts.length || total > 100.1 ? 'unknown' : total >= 50 ? 'warn' : 'clear', 'Sum of returned top token accounts, not independent owners. Includes pool, custody or burn accounts if present. Hidden wallet clusters are not detected.');
  const creator = number(report?.creatorPercent);
  add('Creator holdings', creator !== null && creator >= 0 && creator <= 100 ? pct(creator) : 'Unknown', creator === null || creator < 0 || creator > 100 ? 'unknown' : creator >= 10 ? 'warn' : 'clear', 'Only the creator percentage explicitly reported by the provider. Missing or absent from top accounts does not mean zero. Other controlled wallets are not covered.');
  if (pair?.chain !== 'solana') {
    const tax = number(report?.sellTax);
    add('Reported sell tax', tax !== null ? pct(tax) : 'Unknown', tax === null ? 'unknown' : tax >= 50 ? 'danger' : tax >= 10 ? 'warn' : 'clear', 'Provider simulation result. Fees, cooldowns and later permission changes can alter whether a trade succeeds.');
  } else {
    add('Sell simulation', 'Not performed', 'unknown', 'This checker does not execute a buy/sell simulation for Solana. A revoked authority is not proof of sellability.');
  }
  add('Developer sell / bundle tracking', 'Not connected', 'unknown', 'No transaction stream, wallet-cluster analysis or deployer-history feed is connected.');
  const warnings = (report?.risks || []).map(r => ({label: r.name, value: r.level === 'danger' ? 'Provider danger signal' : 'Provider warning', severity: r.level === 'danger' ? 'danger' : 'warn', status: 'flag', description: r.description}));
  const all = [...checks, ...warnings];
  const high = all.filter(c => c.severity === 'danger').length;
  const review = all.filter(c => c.severity === 'warn').length;
  const unknown = checks.filter(c => c.severity === 'unknown').length;
  const title = high ? 'High-risk signals' : review ? 'Review required' : !report ? 'Risk check unavailable' : unknown ? 'Risk evidence incomplete' : 'No listed danger signals';
  return {title, high, review, unknown, checks, warnings,
    provider: report?.provider || null, retrievedAt: report?.retrievedAt || null,
    stale: !report?.retrievedAt || now - Date.parse(report.retrievedAt) > 90_000,
    known: checks.length - unknown, total: checks.length};
}
