// BulletproofChart.js - Forces ref to work
import React, { useRef, useEffect, useState } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

const BulletproofChart = ({ symbol = "TCS-EQ", sessionToken, debug = false }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState('');
  const [refSet, setRefSet] = useState(false);

  // Generate bulletproof mock data
  const generateMockData = () => {
    const data = [];
    const baseTime = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

    for (let i = 0; i < 30; i++) {
      const time = baseTime + (i * 24 * 60 * 60);
      const price = 3000 + Math.random() * 100;
      const open = Math.max(1, price);
      const close = Math.max(1, price + (Math.random() - 0.5) * 30);
      const high = Math.max(1, Math.max(open, close) + Math.random() * 50);
      const low = Math.max(1, Math.min(open, close) - Math.random() * 50);

      data.push({
        time: Math.floor(time), // Ensure integer
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(Math.max(1, low).toFixed(2)), // Ensure low is positive
        close: Number(close.toFixed(2))
      });
    }
    return data;
  };

  // CHAT GPT
  // helpers inside BulletproofChart.js (or a util module)
  function parseApiTimeToSeconds(rawTime) {
   // console.log('Parsing time:', rawTime);
    // rawTime expected like "22-09-2025 09:15:00"
    // convert to "2025-09-22T09:15:00" (ISO-like) to avoid Date parsing ambiguities
    if (typeof rawTime !== 'string') return null;
    const m = rawTime.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = m;
    // build an ISO string in UTC (or local if you prefer)
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return Math.floor(t / 1000); // lightweight-charts wants seconds
  }

  function sanitizeAndValidate(rawArray) {
    //console.log("API response raw:", rawArray, Array.isArray(rawArray));

    const valid = [];
    const invalids = [];
    rawArray.forEach((r, idx) => {
      const time = parseApiTimeToSeconds(r.time ?? r.datetime ?? r.timestamp);
      const open = Number(r.open);
      const high = Number(r.high);
      const low = Number(r.low);
      const close = Number(r.close);

      const isValid =
        time !== null &&
        Number.isFinite(open) &&
        Number.isFinite(high) &&
        Number.isFinite(low) &&
        Number.isFinite(close);

      if (!isValid) {
        invalids.push({ idx, raw: r, parsed: { time, open, high, low, close } });
        return;
      }

      valid.push({
        time,
        open,
        high,
        low,
        close
      });
    });

    if (invalids.length) {
      console.warn('BulletproofChart: removed invalid candle rows:', invalids.slice(0, 10));
      // optional: send these invalid rows to remote logging for debugging
    }
    return valid;
  }





  // Initialize chart function
  const initChart = async () => {
    try {
      if (debug) console.log('🚀 Bulletproof init started');
      setStatus('checking container');

      const container = containerRef.current;
      if (!container) {
        throw new Error('Container not found');
      }

      if (debug) console.log('📦 Container found:', container.clientWidth, 'x', container.clientHeight);

      // Wait for dimensions
      let attempts = 0;
      while (container.clientWidth === 0 && attempts < 20) {
        if (debug) console.log('⏳ Waiting for dimensions...');
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (container.clientWidth === 0) {
        throw new Error('Container has no width');
      }

      setStatus('creating chart');

      // Clean up existing chart
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.warn('Chart cleanup error:', e);
        }
      }

      // Create chart
      const chart = createChart(container, {
        width: container.clientWidth,
        height: 400,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#f0f0f0' },
          horzLines: { color: '#f0f0f0' },
        }
      });

      const series = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
      });

      chartRef.current = chart;
      seriesRef.current = series;

      if (debug) console.log('✅ Chart created');

      setStatus('loading data');

      // Load data with bulletproof validation
      let chartData = [];

      if (sessionToken) {
        try {
          const response = await axios.get(`/api/market/${symbol}/history`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` },
            params: { interval: '15', days: 7 }
          });

          if (response.data.success && Array.isArray(response.data.candles) && response.data.candles.length > 0) {
            if (debug) console.log('📊 Raw API data sample:', response.data.candles.slice(0, 3));
            // Process and validate data
            // console.log('API response raw:', response, 'isArray?', Array.isArray(response));
            // console.log('response.data:', response?.data);
            // console.log('candles length?', response?.data?.candles?.length);

            const safeDataUpdated = sanitizeAndValidate(response.data.candles);
            //console.log('safeDataUpdated?', safeDataUpdated);

            chartData = safeDataUpdated
              .map((candle, index) => {
                // Extensive validation
                if (!candle || typeof candle !== 'object') {
                  if (debug) console.warn(`Invalid candle ${index}:`, candle);
                  return null;
                }

                // Extract time
                let time = candle.time || candle.timestamp;
                if (typeof time === 'string') {
                  time = parseInt(time, 10);
                }
                if (!Number.isFinite(time) || time <= 0) {
                  if (debug) console.warn(`Invalid time ${index}:`, candle.time, candle.timestamp);
                  return null;
                }

                // Convert milliseconds to seconds if needed
                if (time > 1e12) {
                  time = Math.floor(time / 1000);
                }

                // Extract and validate OHLC
                const open = parseFloat(candle.open || candle.o || 0);
                const high = parseFloat(candle.high || candle.h || 0);
                const low = parseFloat(candle.low || candle.l || 0);
                const close = parseFloat(candle.close || candle.c || 0);

                // Check for null, undefined, NaN, or non-positive values
                if (!Number.isFinite(open) || !Number.isFinite(high) ||
                  !Number.isFinite(low) || !Number.isFinite(close) ||
                  open <= 0 || high <= 0 || low <= 0 || close <= 0) {
                  if (debug) console.warn(`Invalid OHLC ${index}:`, { open, high, low, close });
                  return null;
                }

                // Validate OHLC relationships
                if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
                  if (debug) console.warn(`Invalid OHLC relationships ${index}:`, { open, high, low, close });
                  return null;
                }

                return {
                  time: Math.floor(time), // Ensure integer
                  open: Number(open.toFixed(2)),
                  high: Number(high.toFixed(2)),
                  low: Number(low.toFixed(2)),
                  close: Number(close.toFixed(2))
                };
              })
              .filter(candle => candle !== null) // Remove null entries
              .sort((a, b) => a.time - b.time); // Sort by time

            if (debug) console.log('📊 Processed data:', chartData.length, 'valid candles');
            if (debug && chartData.length > 0) console.log('📊 Sample processed:', chartData.slice(0, 3));
          }
        } catch (error) {
          if (debug) console.warn('📈 API failed, using mock data:', error.message);
        }
      }

      // Use mock data if no real data
      if (chartData.length === 0) {
        chartData = generateMockData();
        if (debug) console.log('📈 Using mock data');
      }

      // Final safety check before setting data
      const safeData = chartData.filter(candle => {
        const isValid = candle &&
          Number.isFinite(candle.time) && candle.time > 0 &&
          Number.isFinite(candle.open) && candle.open > 0 &&
          Number.isFinite(candle.high) && candle.high > 0 &&
          Number.isFinite(candle.low) && candle.low > 0 &&
          Number.isFinite(candle.close) && candle.close > 0;

        if (!isValid && debug) {
          console.warn('Filtered invalid candle:', candle);
        }

        return isValid;
      });

      if (safeData.length === 0) {
        throw new Error('No valid data after filtering');
      }

      if (debug) console.log('📊 Final safe data:', safeData.length, 'candles');
      {
        //series.setData(safeData);
        for (let i = 0; i < safeData.length; i++) {
          try {
            series.setData(safeData.slice(0, i + 1)); // incrementally add
          } catch (err) {
            console.error('Error when adding up to index', i, 'item:', safeData[i], err);
            break;
          }
        }
      }
      setStatus('ready');

      if (debug) console.log('✅ Chart ready with', safeData.length, 'candles');

    } catch (err) {
      console.error('💥 Chart initialization failed:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // Effect to initialize when everything is ready
  useEffect(() => {
    if (refSet && sessionToken) {
      if (debug) console.log('🔄 Starting initialization...');
      const timer = setTimeout(initChart, 100);
      return () => clearTimeout(timer);
    }
  }, [refSet, sessionToken, symbol]);

  // Force check ref after component mounts
  useEffect(() => {
    const checkRef = () => {
      if (containerRef.current) {
        if (debug) console.log('📍 Ref check: Container found!');
        setRefSet(true);
      } else {
        if (debug) console.log('📍 Ref check: No container yet');
        setTimeout(checkRef, 100);
      }
    };

    const timer = setTimeout(checkRef, 50);
    return () => clearTimeout(timer);
  }, [debug]);

  const handleManualInit = () => {
    if (debug) console.log('🔄 Manual initialization triggered');
    if (containerRef.current) {
      setRefSet(true);
      setTimeout(initChart, 100);
    } else {
      if (debug) console.log('❌ No container for manual init');
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">Bulletproof Chart - {symbol}</h4>
        <div className="flex items-center space-x-2">
          <span className={`text-sm px-2 py-1 rounded ${status === 'ready' ? 'bg-green-100 text-green-700' :
            status === 'error' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
            {status}
          </span>
          <button
            onClick={handleManualInit}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Force Init
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-2">
          Error: {error}
          <button onClick={handleManualInit} className="ml-2 underline text-sm">Retry</button>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ height: '400px' }}
      >
        {status !== 'ready' && (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div className="mb-2">{status}</div>
              <div className="text-xs">
                Ref: {refSet ? '✅' : '❌'} |
                Token: {sessionToken ? '✅' : '❌'} |
                Container: {containerRef.current ? '✅' : '❌'}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Bulletproof chart - forces initialization through multiple methods
      </div>
    </div>
  );
};

export default BulletproofChart;