// TradingChart.js - Complete WebSocket Integration
import React, { useRef, useEffect, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

const TradingChart = ({ symbol = "TCS-EQ", sessionToken, debug = false }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const mountedRef = useRef(false);
  const initializationInProgressRef = useRef(false);
  const lastInitializedSymbolRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const candleBufferRef = useRef(new Map()); // Buffer for real-time updates
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [containerMounted, setContainerMounted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [realTimeData, setRealTimeData] = useState(null);

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
      console.warn('[TradingChart]: removed invalid candle rows:', invalids.slice(0, 10));
      // optional: send these invalid rows to remote logging for debugging
    }
    return valid;
  }






  // Simple data validation - less paranoid, more practical
  const validateCandle = useCallback((rawCandle, index) => {
    if (!rawCandle || typeof rawCandle !== 'object') {
      if (debug) console.warn(`[${index}] Invalid candle object`);
      return null;
    }

    // Extract time
    let time = rawCandle.time || rawCandle.timestamp;
    if (typeof time === 'string') time = parseInt(time, 10);
    if (!time || time <= 0 || !Number.isFinite(time)) {
      if (debug) console.warn(`[${index}] Invalid time:`, time);
      return null;
    }

    // Convert milliseconds to seconds if needed
    if (time > 1e12) time = Math.floor(time / 1000);

    // Extract OHLC
    const open = parseFloat(rawCandle.open || rawCandle.o);
    const high = parseFloat(rawCandle.high || rawCandle.h);
    const low = parseFloat(rawCandle.low || rawCandle.l);
    const close = parseFloat(rawCandle.close || rawCandle.c);

    // Basic validation
    if (!Number.isFinite(open) || !Number.isFinite(high) || 
        !Number.isFinite(low) || !Number.isFinite(close) ||
        open <= 0 || high <= 0 || low <= 0 || close <= 0) {
      if (debug) console.warn(`[${index}] Invalid OHLC values`);
      return null;
    }

    // Validate OHLC relationships
    if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
      if (debug) console.warn(`[${index}] Invalid OHLC relationships`);
      return null;
    }

    return {
      time: Math.floor(time),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: rawCandle.volume || 0
    };
  }, [debug]);

  // Generate fallback mock data
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

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!symbol || !sessionToken || !mountedRef.current) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (debug) console.log('🔗 WebSocket already connected');
      return;
    }

    try {
      if (debug) console.log('🔗 Connecting WebSocket for:', symbol);
      
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/market/ws/${encodeURIComponent(symbol)}?token=${sessionToken}&exchange=NSE&feed_type=t`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (debug) console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
        setError('');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (debug) console.log('📥 WebSocket data:', data);
          handleRealTimeUpdate(data);
        } catch (err) {
          if (debug) console.error('📥 WebSocket parse error:', err);
        }
      };

      ws.onerror = (error) => {
        if (debug) console.error('🔴 WebSocket error:', error);
        setConnectionStatus('error');
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        if (debug) console.log('🔴 WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // Auto-reconnect after delay
        if (mountedRef.current && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connectWebSocket();
            }
          }, 3000);
        }
      };

    } catch (error) {
      if (debug) console.error('🔴 WebSocket connection failed:', error);
      setConnectionStatus('error');
      setError(`WebSocket error: ${error.message}`);
    }
  }, [symbol, sessionToken, debug]);

  // Handle real-time updates
  const handleRealTimeUpdate = useCallback((data) => {
    if (!candleSeriesRef.current || !data.data) return;

    try {
      const marketData = data.data;
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Create current candle from live data
      const liveCandle = {
        time: timestamp,
        open: marketData.open || marketData.last_price,
        high: marketData.high || marketData.last_price,
        low: marketData.low || marketData.last_price,
        close: marketData.last_price || marketData.close,
        volume: marketData.volume || 0
      };

      const validatedCandle = validateCandle(liveCandle, 'live');
      if (validatedCandle) {
        // Update the latest candle
        candleSeriesRef.current.update(validatedCandle);
        setLastUpdate(new Date().toISOString());
        setRealTimeData(marketData);
        
        if (debug) {
          console.log('📊 Chart updated with live data:', validatedCandle);
        }
      }
    } catch (error) {
      if (debug) console.error('📊 Real-time update failed:', error);
    }
  }, [validateCandle, debug]);

  // Load historical data
  const loadHistoricalData = useCallback(async () => {
    try {
      if (debug) console.log('📈 Loading historical data for:', symbol);
      
      const response = await axios.get(`/api/market/${symbol}/history`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        params: { interval: '60', days: 7 }
      });

      const sanitizedCandles = sanitizeAndValidate(response.data.candles);

   //   let validatedCandles = [];

      // if (response.data.success && Array.isArray(response.data.candles) && response.data.candles.length > 0) {
      //   if (debug) console.log(`📈 Received ${response.data.candles.length} candles from API`);
       
      //   // Validate and process candles
      //   for (let i = 0; i < response.data.candles.length; i++) {
      //     const validated = validateCandle(response.data.candles[i], i);
      //     if (validated) {
      //       validatedCandles.push(validated);
      //     }
      //   }

      //   // Remove duplicates and sort
      //   const uniqueCandles = Array.from(
      //     new Map(validatedCandles.map(candle => [candle.time, candle])).values()
      //   ).sort((a, b) => a.time - b.time);

      //   if (debug) console.log(`📈 Processed ${uniqueCandles.length} valid candles`);
      //   validatedCandles = uniqueCandles;
      // }

      // Use mock data if insufficient real data
      if (sanitizedCandles.length < 10) {
        if (debug) console.log('📈 Using mock data - insufficient real data');
        sanitizedCandles = generateMockData();
      }

      // Set data to chart
      if (candleSeriesRef.current && sanitizedCandles.length > 0) {
        candleSeriesRef.current.setData(sanitizedCandles);
        if (debug) console.log('✅ Historical data loaded successfully');
      }

    } catch (error) {
      console.error('📈 Historical data loading failed:', error);
      
      // Fallback to mock data
      const mockData = generateMockData();
      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(mockData);
      }
      
      setError(`Historical data failed: ${error.message}`);
    }
  }, [symbol, sessionToken, validateCandle, generateMockData, debug]);

  // Much simpler container ref handler - just store the ref
  const handleContainerRef = useCallback((element) => {
    chartContainerRef.current = element;
    if (debug) console.log('📍 Container ref set:', !!element, element ? `${element.clientWidth}x${element.clientHeight}` : 'null');
  }, [debug]);

  // Simplified initialization with better error handling
  const initializeChart = useCallback(async () => {
    if (initializationInProgressRef.current) {
      if (debug) console.log('⚠️ Already initializing, skipping');
      return;
    }

    if (!mountedRef.current) {
      if (debug) console.log('⚠️ Component not mounted, skipping');
      return;
    }

    if (!sessionToken) {
      if (debug) console.log('⚠️ No session token, skipping');
      return;
    }

    const container = chartContainerRef.current;
    if (!container) {
      if (debug) console.log('⚠️ No container element, skipping');
      return;
    }

    initializationInProgressRef.current = true;
    
    try {
      if (debug) {
        console.log('🚀 Starting chart initialization');
        console.log('Container dimensions:', container.clientWidth, 'x', container.clientHeight);
        console.log('Symbol:', symbol);
      }

      // Wait for container to have dimensions if needed
      let attempts = 0;
      while ((container.clientWidth === 0 || container.clientHeight === 0) && attempts < 20) {
        if (debug) console.log(`⏳ Waiting for container dimensions... attempt ${attempts + 1}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (container.clientWidth === 0 || container.clientHeight === 0) {
        throw new Error(`Container still has zero dimensions after waiting: ${container.clientWidth}x${container.clientHeight}`);
      }

      // Clean up previous instance if symbol changed
      if (lastInitializedSymbolRef.current !== symbol) {
        if (debug) console.log('🧹 Cleaning up for new symbol:', lastInitializedSymbolRef.current, '->', symbol);
        
        // Close WebSocket
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Remove chart
        if (chartRef.current) {
          try {
            if (chartRef.current._cleanup) chartRef.current._cleanup();
            chartRef.current.remove();
          } catch (e) {
            if (debug) console.warn('Chart cleanup error:', e);
          }
          chartRef.current = null;
          candleSeriesRef.current = null;
        }
      }

      // Create chart if needed
      if (!chartRef.current) {
        if (debug) console.log('📊 Creating new chart instance');
        
        const chart = createChart(container, {
          width: container.clientWidth,
          height: container.clientHeight,
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
          },
          crosshair: {
            mode: 1,
          },
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
            const newHeight = container.clientHeight;
            if (newWidth > 0 && newHeight > 0) {
              chart.applyOptions({ width: newWidth, height: newHeight });
            }
          }
        };

        window.addEventListener('resize', handleResize);
        
        // Store references
        chartRef.current = chart;
        candleSeriesRef.current = series;
        
        // Cleanup function
        chart._cleanup = () => {
          window.removeEventListener('resize', handleResize);
        };

        if (debug) console.log('✅ Chart instance created successfully');
      }

      // Load historical data
      if (debug) console.log('📈 Loading historical data...');
      await loadHistoricalData();

      // Connect WebSocket for real-time updates
      if (debug) console.log('🔗 Connecting WebSocket...');
      connectWebSocket();

      // Mark as initialized
      lastInitializedSymbolRef.current = symbol;
      setLoading(false);
      setError('');

      if (debug) console.log('✅ Chart initialization completed successfully');

    } catch (error) {
      console.error('💥 Chart initialization failed:', error);
      setError(`Initialization failed: ${error.message}`);
      setLoading(false);
    } finally {
      initializationInProgressRef.current = false;
    }
  }, [symbol, sessionToken, loadHistoricalData, connectWebSocket, debug]);

  // Lifecycle effects
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      
      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Clear timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Cleanup chart
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

  // Fixed effect - remove dependency on containerMounted state entirely
  useEffect(() => {
    if (debug) {
      console.log('📍 Effect triggered - sessionToken:', !!sessionToken, 'mounted:', mountedRef.current, 'symbol:', symbol);
      console.log('📍 Container element exists:', !!chartContainerRef.current);
      if (chartContainerRef.current) {
        console.log('📍 Container dimensions:', chartContainerRef.current.clientWidth, 'x', chartContainerRef.current.clientHeight);
      }
    }
    
    // Initialize as soon as we have token, component is mounted, and container exists
    if (sessionToken && mountedRef.current && chartContainerRef.current) {
      const timer = setTimeout(() => {
        if (mountedRef.current && chartContainerRef.current) {
          initializeChart();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [sessionToken, symbol, initializeChart, debug]);

  // Retry handler
  const handleRetry = useCallback(() => {
    if (debug) console.log('🔄 Retrying initialization');
    
    initializationInProgressRef.current = false;
    lastInitializedSymbolRef.current = null;
    setLoading(true);
    setError('');
    
    // Clear existing connections
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setTimeout(() => {
      if (mountedRef.current) {
        initializeChart();
      }
    }, 100);
  }, [initializeChart, debug]);

  // Get connection status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (!loading) {
    return (
      <div className="w-full h-[400px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading chart for {symbol}...</p>
          <div className="text-xs text-gray-500">
            Token: {sessionToken ? '✅' : '❌'} | 
            Container: {chartContainerRef.current ? '✅' : '❌'} | 
            Mounted: {mountedRef.current ? '✅' : '❌'}
          </div>
          {debug && (
            <div className="text-xs text-gray-400 mt-2">
              Debug: initInProgress={initializationInProgressRef.current}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">{symbol.replace('-EQ', '')} - Live Chart</h4>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-sm text-gray-600 capitalize">{connectionStatus}</span>
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={handleRetry} 
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-2">
          <div className="font-medium">{error}</div>
          <button onClick={handleRetry} className="text-sm underline mt-1">
            Try again
          </button>
        </div>
      )}

      {/* Real-time data display */}
      {debug && realTimeData && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-md mb-2 text-sm">
          <div>Live: ₹{realTimeData.last_price} | Vol: {realTimeData.volume}</div>
        </div>
      )}

      <div 
        ref={handleContainerRef}
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ 
          height: '400px',
          minHeight: '400px',
          minWidth: '300px',
          position: 'relative',
          // Ensure the container has dimensions immediately
          width: '100%'
        }}
      >
        {(!chartRef.current || lastInitializedSymbolRef.current !== symbol) && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-white">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div>Chart loading...</div>
              {debug && (
                <div className="text-xs mt-2 text-gray-400">
                  Container: {containerMounted ? '✅' : '❌'} | 
                  Token: {sessionToken ? '✅' : '❌'} | 
                  Mounted: {mountedRef.current ? '✅' : '❌'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500 flex justify-between">
        <div>
          Status: {lastInitializedSymbolRef.current === symbol ? '✅ Ready' : '⏳ Loading'} | 
          Chart: {chartRef.current ? '✅' : '❌'} | 
          WebSocket: {connectionStatus} | 
          Container: {chartContainerRef.current ? '✅' : '❌'}
        </div>
        {debug && (
          <div>
            Debug Mode: ON | Token: {sessionToken ? 'Valid' : 'Missing'}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingChart;