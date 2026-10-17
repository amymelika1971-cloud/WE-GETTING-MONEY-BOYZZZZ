const MINUTE = 60_000;
const unknown = detail => ({status: 'unknown', title: 'Price structure unknown', detail});

/** A descriptive check of completed 1m candles, never a return forecast. */
export function assessPullback(points, now = Date.now()) {
  if (!Array.isArray(points) || !points.length || !Number.isFinite(now)) {
    return unknown('Not enough completed 1m candles are available.');
  }
  const currentMinute = Math.floor(now / MINUTE) * MINUTE;
  const candles = [];
  for (const p of points) {
    if (!p || !['time', 'open', 'high', 'low', 'close'].every(key => Number.isFinite(p[key])) ||
        p.time % MINUTE !== 0 || p.time > currentMinute || p.low <= 0 ||
        p.low > Math.min(p.open, p.close) || p.high < Math.max(p.open, p.close) || p.high < p.low) {
      return unknown('Candle data is invalid or includes future timestamps.');
    }
    // A currently forming candle cannot confirm a high or low.
    if (p.time < currentMinute) candles.push(p);
  }
  candles.sort((a, b) => a.time - b.time);
  if (candles.length < 20) return unknown('At least 20 completed 1m candles are needed to check the structure.');
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].time - candles[i - 1].time !== MINUTE) {
      return unknown('The 1m history has missing or duplicate candles.');
    }
  }
  const last = candles.at(-1);
  if (now - (last.time + MINUTE) > 3 * MINUTE) {
    return unknown('The latest completed candle is over three minutes old.');
  }

  // Two candles on either side confirm each swing. Ties do not confirm one.
  const swings = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const p = candles[i];
    const neighbors = [candles[i - 2], candles[i - 1], candles[i + 1], candles[i + 2]];
    const high = neighbors.every(n => p.high > n.high);
    const low = neighbors.every(n => p.low < n.low);
    // An outside candle can be both; its ordering is ambiguous.
    if (high && low) return {status: 'not-confirmed', title: 'Rising structure not confirmed', detail: 'An overlapping swing high and low makes the recent structure ambiguous.'};
    if (high) swings.push({type: 'high', value: p.high, time: p.time});
    if (low) swings.push({type: 'low', value: p.low, time: p.time});
  }
  const highs = swings.filter(p => p.type === 'high').slice(-3);
  const lows = swings.filter(p => p.type === 'low').slice(-3);
  const recent = swings.slice(-6);
  const alternating = recent.length === 6 && recent.every((p, i) => i === 0 || p.type !== recent[i - 1].type);
  const rising = values => values.length === 3 && values[1].value > values[0].value && values[2].value > values[1].value;
  if (!alternating || !rising(highs) || !rising(lows)) {
    return {status: 'not-confirmed', title: 'Rising structure not confirmed', detail: 'Completed 1m candles do not show two successive higher swing highs and higher swing lows.'};
  }
  const lastHigh = highs.at(-1), lastLow = lows.at(-1);
  const afterLow = candles.filter(p => p.time > lastLow.time);
  if (afterLow.some(p => p.low <= lastLow.value)) {
    return {status: 'not-confirmed', title: 'Higher-low structure broken', detail: 'A later completed candle reached or fell below the latest confirmed higher low.'};
  }
  if (last.close < lastHigh.value && last.close > lastLow.value) {
    return {status: 'pullback', title: 'Pullback in rising structure', detail: 'Two successive higher swing highs and higher swing lows are confirmed. The latest completed close is below the recent swing high and above the latest higher low. This describes recent candles, not future returns.'};
  }
  return {status: 'uptrend', title: 'Rising structure; no pullback confirmed', detail: 'Two successive higher swing highs and higher swing lows are confirmed, but the latest completed close is not below the recent swing high. This describes recent candles, not future returns.'};
}
