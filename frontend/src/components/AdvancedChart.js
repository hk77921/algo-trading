// src/components/AdvancedChart.js
import  { useRef, useEffect, useState ,useCallback} from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';
import {
  parseApiTimeToSeconds,
  sanitizeAndValidate,
  generateMockData,
  createCoalescer
} from '../utils/chart-util';

import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateBollingerBands,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateVWAP,
  calculateParabolicSAR,
  calculateMFI,
  calculateOBV,
  calculateCCI
} from '../utils/indicators';
//import IndicatorPanel from './IndicatorPanel';
// In AdvancedChart.js, add:
import IndicatorControls from './IndicatorControls';




const DEFAULT_HEIGHT = 400;
const INDICATOR_PANE_HEIGHT = 150;

function buildWsUrl(symbol, token, base = '') {
  // Assumes relative /api/market/ws/<symbol>?token=...
  // If you host API elsewhere, pass full URL here.
  const q = new URLSearchParams({ token });
  return `${base || ''}/api/market/ws/${encodeURIComponent(symbol)}?${q.toString()}`;
}

const AdvancedChart = ({ symbol = 'TCS-EQ', sessionToken = '', debug = false }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  const indicatorPanesRef = useRef({});
  const lastTimeRef = useRef(0);
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timer: null, backoff: 1000 });
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState('');
  const [activeIndicators, setActiveIndicators] = useState([]);

  // Create coalescer: when messages arrive quickly, we'll batch them and apply in one go
  const coalescerRef = useRef(null);
  const chartDataRef = useRef([]);

  useEffect(() => {
    coalescerRef.current = createCoalescer(150, items => {
      // items: array of candles (deduped & sorted)
      if (!seriesRef.current) return;
      items.forEach(item => {
        // update will append if time > last, or modify if same time
        try {
          seriesRef.current.update(item);
          chartDataRef.current.push(item);
          lastTimeRef.current = Math.max(lastTimeRef.current || 0, item.time);
        } catch (e) {
          if (debug) console.warn('series.update failed', e, item);
        }
        //lastTimeRef.current = Math.max(lastTimeRef.current || 0, item.time);
      });
      // Update all active indicators with new data
      updateIndicators();
    });
  }, [debug]);

  // Resize handling
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        try {
          const totalHeight = DEFAULT_HEIGHT +
            (Object.keys(indicatorPanesRef.current).length * INDICATOR_PANE_HEIGHT);

          chartRef.current.applyOptions({
            width: container.clientWidth,
            height: Math.max(totalHeight, container.clientHeight || DEFAULT_HEIGHT)
          });
        } catch (e) {
          if (debug) console.warn('applyOptions error on resize', e);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [debug]);

  // Chart init & load history
  useEffect(() => {
    let mounted = true;
    async function initChart() {
      try {
        setStatus('creating chart');
        const container = containerRef.current;
        if (!container) throw new Error('container not found');

        // cleanup existing
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (e) { /* ignore */ }
          chartRef.current = null;
        }

        const chart = createChart(container, {
          width: container.clientWidth,
          height: DEFAULT_HEIGHT,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#333',
          },
          grid: {
            vertLines: { color: '#f0f0f0' },
            horzLines: { color: '#f0f0f0' },
          },
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          }
        });

        const series = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
          wickUpColor: '#26a69a',
          wickDownColor: '#ef5350',
          borderVisible: true
        });

        chartRef.current = chart;
        seriesRef.current = series;

        setStatus('loading history');

        // Fetch history - conservative params; modify as needed
        let chartData = [];
        if (sessionToken) {
          try {
            const res = await axios.get(`/api/market/${encodeURIComponent(symbol)}/history`, {
              headers: { Authorization: `Bearer ${sessionToken}` },
              params: { interval: '15', days: 7 }
            });
            if (res.data && Array.isArray(res.data.candles) && res.data.candles.length) {
              chartData = sanitizeAndValidate(res.data.candles, { debug });
            }
          } catch (e) {
            if (debug) console.warn('history fetch failed, falling back to mock:', e?.message || e);
          }
        }

        if (!chartData || chartData.length === 0) {
          chartData = generateMockData(30);
          if (debug) console.log('Using mock data for chart');
        }

        // single setData call - much faster than incremental loop
        chartDataRef.current = chartData;
        series.setData(chartData);
        lastTimeRef.current = chartData.length ? chartData[chartData.length - 1].time : 0;
        updateIndicators(); // Add this line
        setStatus('ready');
        if (debug) console.log('Chart initialized with', chartData.length, 'candles');

        // open websocket after chart ready
        if (mounted) connectWebSocket();
      } catch (err) {
        console.error('AdvancedChart init error', err);
        setError(err.message || String(err));
        setStatus('error');
      }
    }

    initChart();

    return () => {
      mounted = false;
      // close ws and cleanup chart (in separate effect to guarantee)
      disconnectWebSocket();
      try {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (e) { /* swallow */ }
    };

    //  -> intentional empty deps; we want to re-run when symbol or token changes (handled below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-init when symbol or sessionToken changes
  useEffect(() => {
    // quick approach: remove existing chart and re-init
    // (Alternatively you could add subscribing/unsubscribing logic only)
    (async () => {
      try {
        // small delay to ensure DOM settled
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch (e) { }
          chartRef.current = null;
          seriesRef.current = null;
        }
        setStatus('reinitializing');
        // wait a tick
        await new Promise(r => setTimeout(r, 80));
        // call same init logic by reusing effect: easiest is to call init manually:
        // but we extracted init inside previous effect scope; to avoid re-duplication,
        // simply emulate by forcing page reload of component: quick hack -> reload window? No.
        // Simpler: call the same sequence as initChart here (reuse code). For brevity we do quick fetch & setData:
        // Fetch history
        let chartData = [];
        if (sessionToken) {
          try {
            const res = await axios.get(`/api/market/${encodeURIComponent(symbol)}/history`, {
              headers: { Authorization: `Bearer ${sessionToken}` },
              params: { interval: '15', days: 7 }
            });
            if (res.data && Array.isArray(res.data.candles) && res.data.candles.length) {
              chartData = sanitizeAndValidate(res.data.candles, { debug });
            }
          } catch (e) {
            if (debug) console.warn('history fetch failed on symbol change', e);
          }
        }
        if (!chartData.length) chartData = generateMockData(30);
        if (!seriesRef.current) {
          // if series missing, create chart quickly
          const container = containerRef.current;
          if (!container) return;
          const chart = createChart(container, {
            width: container.clientWidth,
            height: DEFAULT_HEIGHT
          });
          const series = chart.addCandlestickSeries();
          chartRef.current = chart;
          seriesRef.current = series;
        }
        seriesRef.current.setData(chartData);
        lastTimeRef.current = chartData.length ? chartData[chartData.length - 1].time : 0;
        setStatus('ready');
        // re-connect websocket to new symbol
        disconnectWebSocket();
        connectWebSocket();
      } catch (e) {
        if (debug) console.warn('reinit failed', e);
      }
    })();
    // react when symbol or token changes
  }, [symbol, sessionToken, debug]);

  // //Indicator update function

  

  const updateIndicators = useCallback(() => {
    if (!chartDataRef.current || chartDataRef.current.length === 0) return;

    activeIndicators.forEach(indicator => {
      if (!indicator.visible) return;

      try {
        let data;

        switch (indicator.type) {
          case 'sma':
            data = calculateSMA(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, indicator.separatePane);
            break;

          case 'ema':
            data = calculateEMA(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, indicator.separatePane);
            break;

          case 'rsi':
            data = calculateRSI(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, true, { min: 0, max: 100 });
            break;

          case 'bollinger':
            const bb = calculateBollingerBands(
              chartDataRef.current,
              indicator.params.period,
              indicator.params.stdDev
            );
            updateLineSeries(`${indicator.id}_upper`, bb.upper, 'rgba(41, 98, 255, 0.3)', false);
            updateLineSeries(`${indicator.id}_middle`, bb.middle, indicator.color, false);
            updateLineSeries(`${indicator.id}_lower`, bb.lower, 'rgba(41, 98, 255, 0.3)', false);
            break;

          case 'macd':
            const macd = calculateMACD(
              chartDataRef.current,
              indicator.params.fastPeriod,
              indicator.params.slowPeriod,
              indicator.params.signalPeriod
            );
            updateLineSeries(`${indicator.id}_macd`, macd.macd, indicator.color, true);
            updateLineSeries(`${indicator.id}_signal`, macd.signal, '#FF6D00', true);
            updateHistogramSeries(`${indicator.id}_histogram`, macd.histogram, true);
            break;

          case 'stochastic':
            const stoch = calculateStochastic(
              chartDataRef.current,
              indicator.params.period,
              indicator.params.smoothK,
              indicator.params.smoothD
            );
            updateLineSeries(`${indicator.id}_k`, stoch.k, indicator.color, true, { min: 0, max: 100 });
            updateLineSeries(`${indicator.id}_d`, stoch.d, '#FF6D00', true, { min: 0, max: 100 });
            break;

          case 'atr':
            data = calculateATR(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, true);
            break;

          case 'vwap':
            data = calculateVWAP(chartDataRef.current);
            updateLineSeries(indicator.id, data, indicator.color, false);
            break;

          case 'sar':
            data = calculateParabolicSAR(
              chartDataRef.current,
              indicator.params.acceleration,
              indicator.params.maximum
            );
            updateSARSeries(indicator.id, data, indicator.color);
            break;

          case 'mfi':
            data = calculateMFI(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, true, { min: 0, max: 100 });
            break;

          case 'obv':
            data = calculateOBV(chartDataRef.current);
            updateLineSeries(indicator.id, data, indicator.color, true);
            break;

          case 'cci':
            data = calculateCCI(chartDataRef.current, indicator.params.period);
            updateLineSeries(indicator.id, data, indicator.color, true);
            break;

          default:
            console.warn('Unknown indicator type:', indicator.type);
        }
      } catch (e) {
        console.error(`Error updating indicator ${indicator.id}:`, e);
      }
    });
  }, [activeIndicators, chartDataRef.current]);




  // Update line series for an indicator
  const updateLineSeries = (id, data, color, separatePane = false, priceScale = {}) => {
    if (!data || data.length === 0) return;

    let series = indicatorSeriesRef.current[id];

    if (!series) {
      // Create new series
      const targetChart = separatePane ? getOrCreateIndicatorPane(id) : chartRef.current;
      if (!targetChart) return;

      series = targetChart.addLineSeries({
        color,
        lineWidth: 2,
        priceScaleId: separatePane ? 'right' : '',
        ...priceScale
      });

      indicatorSeriesRef.current[id] = series;
    }

    series.setData(data);
  };




  // Update histogram series (for MACD)
  const updateHistogramSeries = (id, data, separatePane = false) => {
    if (!data || data.length === 0) return;

    let series = indicatorSeriesRef.current[id];

    if (!series) {
      const targetChart = separatePane ? getOrCreateIndicatorPane(id) : chartRef.current;
      if (!targetChart) return;

      series = targetChart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });

      indicatorSeriesRef.current[id] = series;
    }

    series.setData(data);
  };
  //Update SAR series (scatter plot style)
  const updateSARSeries = (id, data, color) => {
    if (!data || data.length === 0) return;

    let series = indicatorSeriesRef.current[id];

    if (!series) {
      series = chartRef.current.addLineSeries({
        color,
        lineWidth: 0,
        pointMarkersVisible: true,
        pointMarkersRadius: 2,
      });

      indicatorSeriesRef.current[id] = series;
    }

    series.setData(data);
  };

  // Get or create separate indicator pane
  const getOrCreateIndicatorPane = (indicatorId) => {
    if (indicatorPanesRef.current[indicatorId]) {
      return indicatorPanesRef.current[indicatorId];
    }

    // For now, we'll use the main chart
    // In a production app, you'd create separate chart instances
    return chartRef.current;
  };

  // Re-calculate all indicators when they change
  useEffect(() => {
    if (status === 'ready' && chartDataRef.current.length > 0) {
      updateIndicators();
    }
  }, [activeIndicators, status]);

  // WebSocket handling: connect / reconnect / heartbeat / messages
  function connectWebSocket() {
    if (!sessionToken) {
      if (debug) console.warn('No sessionToken provided - skipping websocket connect');
      return;
    }
    try {
      const wsUrl = buildWsUrl(symbol, sessionToken);
      if (debug) console.log('WS connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current.attempts = 0;
        reconnectRef.current.backoff = 1000;
        setStatus('connected');
        if (debug) console.log('WS open');
        // heartbeat/ping
        ws.send(JSON.stringify({ type: 'hello', t: 'client_ping' }));
      };

      ws.onmessage = (ev) => {
        // expects server to send normalized JSON for candles
        // e.g. { time: 169..., open: ..., high: ..., low: ..., close: ... } or a small batch
        try {
          const payload = JSON.parse(ev.data);
          // payload might be {candles: [...]} or a single candle
          if (Array.isArray(payload)) {
            payload.forEach(p => handleIncomingCandle(p));
          } else if (Array.isArray(payload.candles)) {
            payload.candles.forEach(p => handleIncomingCandle(p));
          } else if (payload.t === 'ping') {
            // respond with pong or ignore
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'pong' }));
          } else if (payload.time || payload.t || payload.o) {
            // single-style candle
            const normalized = normalizeIncoming(payload);
            if (normalized) handleIncomingCandle(normalized);
          } else {
            if (debug) console.debug('WS unknown payload', payload);
          }
        } catch (e) {
          if (debug) console.warn('WS message parse failed', e, ev.data);
        }
      };

      ws.onerror = (err) => {
        if (debug) console.warn('WS error', err);
      };

      ws.onclose = (evt) => {
        if (debug) console.warn('WS closed', evt.code, evt.reason);
        setStatus('disconnected');
        // auto-reconnect with backoff
        scheduleReconnect();
      };
    } catch (e) {
      if (debug) console.warn('connectWebSocket exception', e);
      scheduleReconnect();
    }
  }

  function disconnectWebSocket() {
    try {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) { }
        wsRef.current = null;
      }
      if (reconnectRef.current.timer) {
        clearTimeout(reconnectRef.current.timer);
        reconnectRef.current.timer = null;
      }
    } catch (e) { /* ignore */ }
  }

  function scheduleReconnect() {
    const info = reconnectRef.current;
    info.attempts = (info.attempts || 0) + 1;
    const backoff = Math.min(30000, info.backoff * Math.pow(2, info.attempts - 1));
    if (debug) console.log(`WS reconnect scheduled in ${backoff}ms (attempt ${info.attempts})`);
    if (info.timer) clearTimeout(info.timer);
    info.timer = setTimeout(() => {
      connectWebSocket();
      info.timer = null;
    }, backoff);
    // increase backoff slightly for next time
    info.backoff = Math.min(30000, (info.backoff || 1000) * 2);
  }

  function normalizeIncoming(p) {
    // Try to map incoming payload fields to {time, open, high, low, close}
    try {
      const time = parseApiTimeToSeconds(p.time ?? p.t ?? p.timestamp ?? p.datetime) || parseApiTimeToSeconds(p.dt);
      const open = Number(p.open ?? p.o ?? p.O);
      const high = Number(p.high ?? p.h ?? p.H);
      const low = Number(p.low ?? p.l ?? p.L);
      const close = Number(p.close ?? p.c ?? p.C);
      if (!time || !Number.isFinite(open)) return null;
      return {
        time: Math.floor(time),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2))
      };
    } catch (e) {
      if (debug) console.warn('normalizeIncoming failed', e, p);
      return null;
    }
  }

  function handleIncomingCandle(candle) {
    if (!candle) return;
    const normalized = typeof candle.time === 'number' ? candle : normalizeIncoming(candle);
    if (!normalized) return;
    // ignore stale smaller-than-existing times
    if (normalized.time < (lastTimeRef.current || 0) - 60 * 60) {
      if (debug) console.warn('incoming candle too old, ignoring', normalized.time, lastTimeRef.current);
      return;
    }
    // If same time: coalescer will keep last one
    if (coalescerRef.current) coalescerRef.current.enqueue(normalized);
    else {
      // fallback immediate update
      try {
        if (seriesRef.current) {
          seriesRef.current.update(normalized);
          lastTimeRef.current = Math.max(lastTimeRef.current || 0, normalized.time);
        }
      } catch (e) {
        if (debug) console.warn('immediate update failed', e);
      }
    }
  }

  // small render UI
  return (
    <div className="advanced-chart-wrapper">
      <IndicatorControls
        activeIndicators={activeIndicators}
        onAdd={(indicator) => setActiveIndicators([...activeIndicators, indicator])}
        onRemove={(id) => setActiveIndicators(activeIndicators.filter(i => i.id !== id))}
        onUpdate={(id, updates) => {
          setActiveIndicators(activeIndicators.map(i =>
            i.id === id ? { ...i, ...updates } : i
          ));
        }}
      />
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">Symbol: <strong>{symbol}</strong></div>
        <div className="text-xs text-gray-500">Status: {status}{error ? ` — ${error}` : ''}</div>
      </div>

      <div
        ref={containerRef}
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ height: DEFAULT_HEIGHT }}
      >
        {/* Chart will be mounted here */}
        {status !== 'ready' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-sm text-gray-500">{status}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedChart;
