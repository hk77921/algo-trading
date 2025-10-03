// src/utils/chart-util.js
// Utilities for parsing, validating and preparing OHLC chart data.
// Moved out from BulletproofChart.js for re-use by AdvancedChart and other components.

export function parseApiTimeToSeconds(rawTime) {
  // Accepts strings like "22-09-2025 09:15:00" or ISO-like strings; returns integer seconds or null.
  if (rawTime == null) return null;

  // If number (ms or s)
  if (typeof rawTime === 'number') {
    // if looks like milliseconds
    if (rawTime > 1e12) return Math.floor(rawTime / 1000);
    if (rawTime > 1e9) return Math.floor(rawTime); // already seconds (safe)
    return null;
  }

  if (typeof rawTime !== 'string') return null;

  // Try DD-MM-YYYY HH:mm:ss
  const m = rawTime.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (m) {
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = m;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
    const t = Date.parse(iso);
    if (!Number.isNaN(t)) return Math.floor(t / 1000);
    return null;
  }

  // Try full ISO (with timezone)
  const parsed = Date.parse(rawTime);
  if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);

  return null;
}

export function sanitizeAndValidate(rawArray = [], opts = { debug: false }) {
  // Normalizes array of objects (fields: time/datetime/timestamp, open, high, low, close)
  // Returns an array of safe candles: { time, open, high, low, close } (time = seconds)
  const valid = [];
  const invalids = [];

  if (!Array.isArray(rawArray)) return [];

  rawArray.forEach((r, idx) => {
    try {
      const time = parseApiTimeToSeconds(r.time ?? r.datetime ?? r.timestamp ?? r.t);
      const open = Number(r.open ?? r.o ?? r.O);
      const high = Number(r.high ?? r.h ?? r.H);
      const low = Number(r.low ?? r.l ?? r.L);
      const close = Number(r.close ?? r.c ?? r.C);

      const isValid =
        time !== null &&
        Number.isFinite(open) &&
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        Number.isFinite(close);

      // Additional OHLC sanity: high >= max(open,close), low <= min(open,close)
      const ohlc_ok = isValid && high >= Math.max(open, close) && low <= Math.min(open, close);

      if (!isValid || !ohlc_ok) {
        invalids.push({ idx, raw: r, parsed: { time, open, high, low, close } });
        return;
      }

      valid.push({
        time: Math.floor(time),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(Number(low).toFixed(2)),
        close: Number(close.toFixed(2))
      });
    } catch (e) {
      invalids.push({ idx, raw: r, error: e.message });
    }
  });

  if (invalids.length && opts.debug) {
    console.warn('chart-util.sanitizeAndValidate removed invalid rows (showing up to 10):', invalids.slice(0, 10));
  }

  // sort & dedupe by time, last-wins for duplicates
  const map = new Map();
  valid.sort((a, b) => a.time - b.time).forEach(item => map.set(item.time, item));
  const result = Array.from(map.values()).sort((a, b) => a.time - b.time);

  return result;
}

export function generateMockData(days = 30) {
  const data = [];
  const baseTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  for (let i = 0; i < days; i++) {
    const time = baseTime + (i * 24 * 60 * 60);
    const price = 3000 + Math.random() * 100;
    const open = Math.max(1, price);
    const close = Math.max(1, price + (Math.random() - 0.5) * 30);
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;
    data.push({
      time: Math.floor(time),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(Math.max(1, low).toFixed(2)),
      close: Number(close.toFixed(2))
    });
  }
  return data;
}

/**
 * Simple coalescer for incoming updates: collects updates for `windowMs` and returns
 * deduped array (last per time). Use like:
 * const coalescer = createCoalescer(200, items => applyToSeries(items));
 * coalescer.enqueue(newCandle);
 */
export function createCoalescer(windowMs = 200, applyFn = () => {}) {
  let buffer = [];
  let timer = null;

  function flush() {
    const map = new Map();
    buffer.forEach(it => map.set(it.time, it)); // last wins
    const items = Array.from(map.values()).sort((a, b) => a.time - b.time);
    buffer = [];
    timer = null;
    if (items.length) applyFn(items);
  }

  return {
    enqueue(item) {
      buffer.push(item);
      if (!timer) {
        timer = setTimeout(flush, windowMs);
      }
    },
    forceFlush() {
      if (timer) clearTimeout(timer);
      flush();
    }
  };
}
