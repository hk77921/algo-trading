// src/components/EnhancedTradingChart.js
// Trading chart with technical indicators support

import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import IndicatorPanel from './IndicatorPanel';

const DEFAULT_HEIGHT = 400;
const INDICATOR_PANE_HEIGHT = 150;

function buildWsUrl(symbol, token, base = '') {
  const q = new URLSearchParams({ token });
  return `${base || 'http://localhost:8000'}/api/market/ws/${encodeURIComponent(symbol)}?${q.toString()}`;
}

const EnhancedTradingChart = ({ symbol = 'TCS-EQ', sessionToken = '', debug = false }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const indicatorSeriesRef = useRef({});
  const indicatorPanesRef = useRef({});
  const lastTimeRef = useRef(0);
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timer: null, backoff: 1000 });
  const coalescerRef = useRef(null);
  const chartDataRef = useRef([]);
  
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState('');
  const [activeIndicators, setActiveIndicators] = useState([]);

  // Create coalescer for batching updates
  useEffect(() => {
    coalescerRef.current = createCoalescer(150, items => {
      if (!seriesRef.current) return;
      items.forEach(item => {
        try {
          seriesRef.current.update(item);
          chartDataRef.current.push(item);
          lastTimeRef.current = Math.max(lastTimeRef.current || 0, item.time);
        } catch (e) {
          if (debug) console.warn('series.update failed', e, item);
        }
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
  }, [debug, activeIndicators]);

  // Initialize chart
  useEffect(() => {
    let mounted = true;
    
    async function initChart() {
      try {
        setStatus('creating chart');
        const container = containerRef.current;
        if (!container) throw new Error('container not found');

        // Cleanup existing
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

        // Fetch history
        let chartData = [];
        if (sessionToken) {
          try {
            const res = await axios.get(`/api/market/${encodeURIComponent(symbol)}/history`, {
              headers: { Authorization: `Bearer ${sessionToken}` },
              params: { interval: '15', days: 30 }
            });
            if (res.data && Array.isArray(res.data.candles) && res.data.candles.length) {
              chartData = sanitizeAndValidate(res.data.candles, { debug });
            }
          } catch (e) {
            if (debug) console.warn('history fetch failed, using mock:', e?.message || e);
          }
        }

        if (!chartData || chartData.length === 0) {
          chartData = generateMockData(60);
          if (debug) console.log('Using mock data for chart');
        }

        // Store chart data for indicator calculations
        chartDataRef.current = chartData;
        series.setData(chartData);
        lastTimeRef.current = chartData.length ? chartData[chartData.length - 1].time : 0;

        setStatus('ready');
        if (debug) console.log('Chart initialized with', chartData.length, 'candles');

        // Open websocket
        if (mounted) connectWebSocket();
      } catch (err) {
        console.error('EnhancedTradingChart init error', err);
        setError(err.message || String(err));
        setStatus('error');
      }
    }

    initChart();

    return () => {
      mounted = false;
      disconnectWebSocket();
      try {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      } catch (e) { /* swallow */ }
    };
  }, [symbol, sessionToken, debug]);

  // Calculate and update indicators
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
  }, [activeIndicators]);

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

  // Update SAR series (scatter plot style)
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
  }, [activeIndicators, status, updateIndicators]);

  // WebSocket connection
  function connectWebSocket() {
    if (!sessionToken) {
      if (debug) console.warn('No sessionToken - skipping websocket');
      return;
    }

    try {
      const wsUrl = buildWsUrl(symbol, sessionToken);
      console.log('Connecting to WS:', wsUrl);
      if (debug) console.log('WS connecting to', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current.attempts = 0;
        reconnectRef.current.backoff = 1000;
        setStatus('connected');
        if (debug) console.log('WS open');
      };

      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          
          if (payload.data) {
            const normalized = normalizeIncoming(payload.data);
            if (normalized) handleIncomingCandle(normalized);
          }
        } catch (e) {
          if (debug) console.warn('WS message parse failed', e);
        }
      };

      ws.onerror = (err) => {
        if (debug) console.warn('WS error', err);
      };

      ws.onclose = (evt) => {
        if (debug) console.warn('WS closed', evt.code);
        setStatus('disconnected');
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
        wsRef.current.close();
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
    if (debug) console.log(`WS reconnect in ${backoff}ms`);
    if (info.timer) clearTimeout(info.timer);
    info.timer = setTimeout(() => {
      connectWebSocket();
      info.timer = null;
    }, backoff);
  }

  function normalizeIncoming(p) {
    try {
      const time = parseApiTimeToSeconds(p.time || p.timestamp);
      const open = Number(p.open);
      const high = Number(p.high);
      const low = Number(p.low);
      const close = Number(p.close);
      if (!time || !Number.isFinite(open)) return null;
      return {
        time: Math.floor(time),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2))
      };
    } catch (e) {
      return null;
    }
  }

  function handleIncomingCandle(candle) {
    if (!candle) return;
    if (candle.time < (lastTimeRef.current || 0) - 3600) return;
    
    if (coalescerRef.current) {
      coalescerRef.current.enqueue(candle);
    }
  }

  // Indicator management functions
  const handleAddIndicator = (indicator) => {
    setActiveIndicators(prev => [...prev, indicator]);
  };

  const handleRemoveIndicator = (indicatorId) => {
    setActiveIndicators(prev => prev.filter(ind => ind.id !== indicatorId));
    
    // Remove series
    Object.keys(indicatorSeriesRef.current).forEach(key => {
      if (key.startsWith(indicatorId)) {
        try {
          const series = indicatorSeriesRef.current[key];
          if (chartRef.current && series) {
            chartRef.current.removeSeries(series);
          }
          delete indicatorSeriesRef.current[key];
        } catch (e) {
          console.warn('Error removing series:', e);
        }
      }
    });
  };

  const handleUpdateIndicator = (indicatorId, updates) => {
    setActiveIndicators(prev =>
      prev.map(ind => ind.id === indicatorId ? { ...ind, ...updates } : ind)
    );
  };

  return (
    <div className="space-y-4">
      {/* Chart Container */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-600">
            Symbol: <strong>{symbol}</strong>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xs px-2 py-1 rounded ${
              status === 'connected' ? 'bg-green-100 text-green-700' :
              status === 'ready' ? 'bg-blue-100 text-blue-700' :
              status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {status}
            </div>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        </div>

        <div
          ref={containerRef}
          className="w-full border border-gray-200 rounded-lg bg-white"
          style={{ height: DEFAULT_HEIGHT }}
        >
          {status !== 'ready' && status !== 'connected' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-gray-500">{status}</div>
            </div>
          )}
        </div>
      </div>

      {/* Indicator Panel */}
      <IndicatorPanel
        activeIndicators={activeIndicators}
        onAddIndicator={handleAddIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onUpdateIndicator={handleUpdateIndicator}
      />
    </div>
  );
};

export default EnhancedTradingChart;