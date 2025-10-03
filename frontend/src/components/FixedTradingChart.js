// FixedTradingChart.js - Chart that initializes properly
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

const FixedTradingChart = ({ symbol = "TCS-EQ", sessionToken, debug = false }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const mountedRef = useRef(true);
  const initializationInProgressRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Generate mock data
  const generateMockData = useCallback(() => {
    const data = [];
    const baseTime = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const basePrice = 3000;
    
    for (let i = 0; i < 30; i++) {
      const time = baseTime + (i * 24 * 60 * 60);
      const open = basePrice + (Math.random() - 0.5) * 200;
      const change = (Math.random() - 0.5) * 100;
      const close = Math.max(1, open + change);
      const high = Math.max(open, close) + Math.random() * 50;
      const low = Math.min(open, close) - Math.random() * 50;
      
      data.push({
        time: time,
        open: Number(Math.max(1, open).toFixed(2)),
        high: Number(Math.max(1, high).toFixed(2)),
        low: Number(Math.max(1, low).toFixed(2)),
        close: Number(Math.max(1, close).toFixed(2))
      });
    }
    
    return data;
  }, []);

  // Initialize chart
  const initializeChart = useCallback(async (container) => {
    if (initializationInProgressRef.current) {
      if (debug) console.log('⚠️ Already initializing');
      return;
    }

    if (!sessionToken) {
      if (debug) console.log('⚠️ No session token');
      setError('No session token available');
      return;
    }

    initializationInProgressRef.current = true;
    setLoading(true);
    setError('');

    try {
      if (debug) console.log('🚀 Starting chart initialization for', symbol);
      if (debug) console.log('📦 Container:', container.clientWidth, 'x', container.clientHeight);

      // Wait for container dimensions
      let attempts = 0;
      while ((container.clientWidth === 0 || container.clientHeight === 0) && attempts < 20) {
        if (debug) console.log(`⏳ Waiting for container... attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (container.clientWidth === 0 || container.clientHeight === 0) {
        throw new Error('Container has no dimensions');
      }

      // Clean up existing chart
      if (chartRef.current) {
        if (debug) console.log('🧹 Cleaning up existing chart');
        try {
          if (chartRef.current._cleanup) chartRef.current._cleanup();
          chartRef.current.remove();
        } catch (e) {
          console.warn('Chart cleanup error:', e);
        }
        chartRef.current = null;
        candleSeriesRef.current = null;
      }

      // Close existing WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Create new chart
      if (debug) console.log('📊 Creating chart instance');
      
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
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        }
      });

      const series = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      // Handle resize
      const handleResize = () => {
        if (chart && container && mountedRef.current) {
          const newWidth = container.clientWidth;
          if (newWidth > 0) {
            chart.applyOptions({ width: newWidth });
          }
        }
      };

      window.addEventListener('resize', handleResize);
      
      chartRef.current = chart;
      candleSeriesRef.current = series;
      chart._cleanup = () => window.removeEventListener('resize', handleResize);

      // Load data
      if (debug) console.log('📈 Loading data...');
      
      try {
        // Try to load real data
        const response = await axios.get(`/api/market/${symbol}/history`, {
          headers: { 'Authorization': `Bearer ${sessionToken}` },
          params: { interval: '60', days: 7 }
        });

        if (response.data.success && Array.isArray(response.data.candles) && response.data.candles.length > 0) {
          // Process real data
          const validCandles = response.data.candles
            .map(candle => {
              const time = typeof candle.time === 'string' ? parseInt(candle.time) : candle.time;
              if (!time || time <= 0) return null;
              
              const open = parseFloat(candle.open);
              const high = parseFloat(candle.high);
              const low = parseFloat(candle.low);
              const close = parseFloat(candle.close);
              
              if (!Number.isFinite(open) || !Number.isFinite(high) || 
                  !Number.isFinite(low) || !Number.isFinite(close) ||
                  open <= 0 || high <= 0 || low <= 0 || close <= 0) {
                return null;
              }
              
              return {
                time: time > 1e12 ? Math.floor(time / 1000) : time,
                open: Number(open.toFixed(2)),
                high: Number(high.toFixed(2)),
                low: Number(low.toFixed(2)),
                close: Number(close.toFixed(2))
              };
            })
            .filter(candle => candle !== null)
            .sort((a, b) => a.time - b.time);

          if (validCandles.length > 0) {
            if (debug) console.log('📊 Setting real data:', validCandles.length, 'candles');
            series.setData(validCandles);
          } else {
            throw new Error('No valid candles in response');
          }
        } else {
          throw new Error('Invalid API response');
        }
      } catch (dataError) {
        if (debug) console.warn('📈 Using mock data due to:', dataError.message);
        const mockData = generateMockData();
        series.setData(mockData);
      }

      // Connect WebSocket
      if (debug) console.log('🔗 Connecting WebSocket...');
      connectWebSocket();

      setLoading(false);
      if (debug) console.log('✅ Chart initialization complete');

    } catch (error) {
      console.error('💥 Chart initialization failed:', error);
      setError(`Initialization failed: ${error.message}`);
      setLoading(false);
    } finally {
      initializationInProgressRef.current = false;
    }
  }, [symbol, sessionToken, generateMockData, debug]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!sessionToken) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/market/ws/${encodeURIComponent(symbol)}?token=${sessionToken}&exchange=NSE&feed_type=t`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (debug) console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (debug) console.log('📥 WebSocket data:', data);
          
          // Handle real-time updates here
          if (candleSeriesRef.current && data.data && data.data.last_price) {
            const timestamp = Math.floor(Date.now() / 1000);
            const liveCandle = {
              time: timestamp,
              open: data.data.open || data.data.last_price,
              high: data.data.high || data.data.last_price,
              low: data.data.low || data.data.last_price,
              close: data.data.last_price
            };
            
            candleSeriesRef.current.update(liveCandle);
          }
        } catch (err) {
          if (debug) console.error('📥 WebSocket parse error:', err);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        // Auto-reconnect after 3 seconds
        if (mountedRef.current) {
          setTimeout(() => {
            if (mountedRef.current) connectWebSocket();
          }, 3000);
        }
      };

    } catch (error) {
      if (debug) console.error('🔴 WebSocket connection failed:', error);
      setConnectionStatus('error');
    }
  }, [symbol, sessionToken, debug]);

  // Container ref handler that triggers initialization
  const handleContainerRef = useCallback((element) => {
    chartContainerRef.current = element;
    
    if (element && sessionToken) {
      if (debug) console.log('📍 Container ready, initializing chart...');
      // Small delay to ensure container is fully rendered
      setTimeout(() => {
        if (mountedRef.current && element) {
          initializeChart(element);
        }
      }, 100);
    }
  }, [sessionToken, initializeChart, debug]);

  // Handle symbol changes
  useEffect(() => {
    if (chartContainerRef.current && sessionToken) {
      if (debug) console.log('🔄 Symbol changed to:', symbol);
      initializeChart(chartContainerRef.current);
    }
  }, [symbol, sessionToken, initializeChart, debug]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (chartRef.current) {
        try {
          if (chartRef.current._cleanup) chartRef.current._cleanup();
          chartRef.current.remove();
        } catch (e) {
          console.warn('Cleanup error:', e);
        }
      }
    };
  }, []);

  const handleRetry = () => {
    if (chartContainerRef.current && sessionToken) {
      initializeChart(chartContainerRef.current);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading chart for {symbol}...</p>
          <div className="text-xs text-gray-500">
            Token: {sessionToken ? '✅' : '❌'} | 
            Container: {chartContainerRef.current ? '✅' : '❌'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">{symbol.replace('-EQ', '')} - Fixed Chart</h4>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
          }`}></div>
          <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
          <button onClick={handleRetry} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-2">
          <div className="font-medium">{error}</div>
          <button onClick={handleRetry} className="text-sm underline mt-1">Try again</button>
        </div>
      )}

      <div 
        ref={handleContainerRef}
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ height: '400px', minWidth: '300px' }}
      />

      <div className="mt-2 text-xs text-gray-500">
        Chart: {chartRef.current ? '✅ Ready' : '⏳ Loading'} | 
        WebSocket: {connectionStatus} | 
        Session: {sessionToken ? '✅' : '❌'}
      </div>
    </div>
  );
};

export default FixedTradingChart;