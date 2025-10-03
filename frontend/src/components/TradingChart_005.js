// src/components/TradingChart.js
import React, { useRef, useEffect } from "react";
import axios from "axios";
import { createChart } from "lightweight-charts";
import PropTypes from "prop-types";
import { WS_BASE_URL } from "../config";

/**
 * TradingChart
 * Props:
 *  - symbol (string) required
 *  - sessionToken (string) optional (used for API + WS auth)
 *  - debug (bool) optional
 */
export default function TradingChart({ symbol, sessionToken = "", debug = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Helper: convert various timestamp formats -> unix seconds (integer)
  function toSeconds(raw) {
    if (raw === null || raw === undefined) return Math.floor(Date.now() / 1000);
    // numeric input (string or number)
    const n = Number(raw);
    if (!isNaN(n)) {
      // milliseconds? > 1e12 -> ms
      if (n > 1e12) return Math.floor(n / 1000);
      // already in seconds (typical unix seconds)
      if (n > 1e9) return Math.floor(n);
      // small numbers - treat as seconds anyway
      return Math.floor(n);
    }
    // try Date.parse
    const parsed = Date.parse(String(raw));
    if (!isNaN(parsed)) return Math.floor(parsed / 1000);
    return Math.floor(Date.now() / 1000);
  }

  // sanitize candle shape to what lightweight-charts expects:
  // { time: <unix seconds>, open, high, low, close }
  function sanitizeCandle(c) {
    try {
      return {
        time: toSeconds(c.time ?? c.timestamp ?? c.datetime ?? c[0]),
        open: Number(c.open ?? c.o ?? c[1]),
        high: Number(c.high ?? c.h ?? c[2]),
        low: Number(c.low ?? c.l ?? c[3]),
        close: Number(c.close ?? c.c ?? c[4]),
      };
    } catch (e) {
      if (debug) console.warn("sanitizeCandle error", e, c);
      return null;
    }
  }

  // initialize chart once container is available
  useEffect(() => {
    if (!symbol) return;

    let mounted = true;
    const waitForContainer = () =>
      new Promise((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (!mounted) {
            clearInterval(interval);
            return resolve(false);
          }
          const el = containerRef.current;
          if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            clearInterval(interval);
            resolve(true);
          }
          // timeout after 5s
          if (Date.now() - start > 5000) {
            clearInterval(interval);
            resolve(false);
          }
        }, 50);
      });

    const init = async () => {
      const ok = await waitForContainer();
      if (!ok || !mounted) return;

      // create chart
      const el = containerRef.current;
      const chart = createChart(el, {
        width: el.clientWidth,
        height: 360,
        layout: {
          backgroundColor: "#ffffff",
          textColor: "#333",
        },
        grid: {
          vertLines: { color: "#f0f0f0" },
          horzLines: { color: "#f0f0f0" },
        },
        rightPriceScale: {
          borderVisible: false,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });
      chartRef.current = chart;

      // add candlestick series
      const candleSeries = chart.addCandlestickSeries({
        priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      });
      candleSeriesRef.current = candleSeries;

      // responsive: resize observer
      try {
        resizeObserverRef.current = new ResizeObserver(() => {
          const el = containerRef.current;
          if (!el) return;
          chart.applyOptions({ width: el.clientWidth, height: 360 });
        });
        resizeObserverRef.current.observe(el);
      } catch (e) {
        // ignore if ResizeObserver isn't available
      }

      // fetch historical candles
      try {
        const url = `/api/market/${encodeURIComponent(symbol)}/history`;
        const headers = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
        const resp = await axios.get(url, { headers });
        const candles = resp.data?.candles ?? resp.data ?? [];
        const sanitized = candles
          .map(sanitizeCandle)
          .filter((x) => x && Number.isFinite(x.open) && Number.isFinite(x.high) && Number.isFinite(x.low) && Number.isFinite(x.close));

        if (sanitized.length > 0) {
          // sort by time ascending (lightweight-charts expects chronological order)
          sanitized.sort((a, b) => a.time - b.time);
          candleSeries.setData(sanitized);
          if (debug) console.log(`[TradingChart] loaded ${sanitized.length} candles for ${symbol}`);
        } else {
          if (debug) console.warn(`[TradingChart] no valid candles returned for ${symbol}`, candles);
        }
      } catch (err) {
        console.error("[TradingChart] history fetch error:", err);
      }

      // setup websocket for live updates
      try {
        if (WS_BASE_URL && typeof WebSocket !== "undefined") {
          const wsUrl = `${WS_BASE_URL}/api/market/ws/${encodeURIComponent(symbol)}${sessionToken ? `?token=${sessionToken}` : ""}`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            if (debug) console.log(`[TradingChart] WS connected: ${wsUrl}`);
            // if server expects a subscribe message, send it here.
            // e.g., ws.send(JSON.stringify({ type: 'subscribe', symbol }));
          };

          ws.onmessage = (evt) => {
            try {
              const payload = JSON.parse(evt.data);
              // Expecting either an incremental tick (last price) or a candle object
              // Try to map to candle; otherwise update last bar by time.
              const maybeCandle = sanitizeCandle(payload);
              if (maybeCandle && Number.isFinite(maybeCandle.open) && Number.isFinite(maybeCandle.close)) {
                // If incoming is a single latest candle, update using update() or append
                candleSeriesRef.current.update(maybeCandle);
                if (debug) console.log("[TradingChart] WS candle update", maybeCandle);
                return;
              }

              // fallback: if payload contains last_price / price / timestamp
              const time = toSeconds(payload.time ?? payload.t ?? payload.timestamp ?? Date.now());
              const price = Number(payload.price ?? payload.last_price ?? payload.p ?? payload.close);
              if (Number.isFinite(price)) {
                // update a simple last-value candle (open/high/low/close all equal)
                candleSeriesRef.current.update({
                  time,
                  open: price,
                  high: price,
                  low: price,
                  close: price,
                });
                if (debug) console.log("[TradingChart] WS price tick", time, price);
              }
            } catch (e) {
              if (debug) console.warn("[TradingChart] WS parse error", e, evt.data);
            }
          };

          ws.onclose = () => {
            if (debug) console.log("[TradingChart] WS closed");
          };

          ws.onerror = (err) => {
            if (debug) console.error("[TradingChart] WS error", err);
          };
        } else {
          if (debug) console.warn("[TradingChart] WS not available or WS_BASE_URL not set");
        }
      } catch (e) {
        if (debug) console.error("[TradingChart] WS setup failed", e);
      }
    };

    init();

    return () => {
      mounted = false;
      // close websocket
      try {
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (_) {}
          wsRef.current = null;
        }
      } catch (e) {}

      // destroy chart
      try {
        if (resizeObserverRef.current && containerRef.current) {
          try { resizeObserverRef.current.unobserve(containerRef.current); } catch (_) {}
          resizeObserverRef.current = null;
        }
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          candleSeriesRef.current = null;
        }
      } catch (e) {
        if (debug) console.warn("[TradingChart] cleanup error", e);
      }
    };
  }, [symbol, sessionToken, debug]);

  return (
    <div ref={containerRef} className="w-full h-auto" style={{ minHeight: 360 }}>
      {/* Chart will be injected here */}
      {!symbol && <div className="p-4 text-sm text-gray-500">No symbol selected</div>}
    </div>
  );
}

TradingChart.propTypes = {
  symbol: PropTypes.string.isRequired,
  sessionToken: PropTypes.string,
  debug: PropTypes.bool,
};
