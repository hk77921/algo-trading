import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Volume2, Maximize2, Minimize2, Download, RefreshCw } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

const AdvancedTradingChart = ({ symbol = "TCS-EQ", sessionToken, debug = false }) => {
  const wsRef = useRef(null);
  
  const [chartData, setChartData] = useState([]);
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartType, setChartType] = useState('candlestick');
  const [timeframe, setTimeframe] = useState('15');
  const [indicators, setIndicators] = useState({
    sma: false,
    ema: false,
    volume: true,
    bollinger: false
  });
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
   const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });

  // Parse API time to timestamp
  const parseApiTimeToSeconds = (rawTime) => {
    if (typeof rawTime !== 'string') return null;
    const m = rawTime.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (!m) return null;
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = m;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t;
  };

  // Validate and sanitize data
  const sanitizeAndValidate = (rawArray) => {
    const valid = [];
    rawArray.forEach((r) => {
      const timestamp = parseApiTimeToSeconds(r.time ?? r.datetime ?? r.timestamp);
      const open = Number(r.open);
      const high = Number(r.high);
      const low = Number(r.low);
      const close = Number(r.close);
      const volume = Number(r.volume || 0);

      const isValid =
        timestamp !== null &&
        Number.isFinite(open) && open > 0 &&
        Number.isFinite(high) && high > 0 &&
        Number.isFinite(low) && low > 0 &&
        Number.isFinite(close) && close > 0 &&
        high >= low &&
        high >= Math.max(open, close) &&
        low <= Math.min(open, close);

      if (isValid) {
        valid.push({ 
          timestamp,
          time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          date: new Date(timestamp).toLocaleDateString(),
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Math.round(volume)
        });
      }
    });
    return valid;
  };

  // Calculate Simple Moving Average
  const calculateSMA = (data, period = 20) => {
    return data.map((item, index) => {
      if (index < period - 1) return { ...item, sma: null };
      const sum = data.slice(index - period + 1, index + 1).reduce((acc, val) => acc + val.close, 0);
      return { ...item, sma: Number((sum / period).toFixed(2)) };
    });
  };

  // Calculate Exponential Moving Average
  const calculateEMA = (data, period = 20) => {
    const multiplier = 2 / (period + 1);
    let emaPrev = data.slice(0, period).reduce((acc, val) => acc + val.close, 0) / period;
    
    return data.map((item, index) => {
      if (index < period) return { ...item, ema: null };
      const emaValue = (item.close - emaPrev) * multiplier + emaPrev;
      emaPrev = emaValue;
      return { ...item, ema: Number(emaValue.toFixed(2)) };
    });
  };

  // Calculate Bollinger Bands
  const calculateBollingerBands = (data, period = 20, stdDev = 2) => {
    return data.map((item, index) => {
      if (index < period - 1) return { ...item, bbUpper: null, bbMiddle: null, bbLower: null };
      
      const slice = data.slice(index - period + 1, index + 1);
      const sum = slice.reduce((acc, val) => acc + val.close, 0);
      const mean = sum / period;
      
      const variance = slice.reduce((acc, val) => acc + Math.pow(val.close - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      return {
        ...item,
        bbMiddle: Number(mean.toFixed(2)),
        bbUpper: Number((mean + (std * stdDev)).toFixed(2)),
        bbLower: Number((mean - (std * stdDev)).toFixed(2))
      };
    });
  };

  // Generate mock data
  const generateMockData = () => {
    const data = [];
    const now = Date.now();

    for (let i = 0; i < 50; i++) {
      const timestamp = now - ((50 - i) * 15 * 60 * 1000);
      const price = 3000 + Math.sin(i / 5) * 200 + Math.random() * 50;
      const open = Math.max(1, price);
      const close = Math.max(1, price + (Math.random() - 0.5) * 30);
      const high = Math.max(1, Math.max(open, close) + Math.random() * 50);
      const low = Math.max(1, Math.min(open, close) - Math.random() * 50);
      const volume = Math.floor(100000 + Math.random() * 50000);

      data.push({
        timestamp,
        time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: new Date(timestamp).toLocaleDateString(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume
      });
    }
    return data;
  };

// Calculate price range
  const calculatePriceRange = (data) => {
    if (data.length === 0) return { min: 0, max: 0 };
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const padding = (max - min) * 0.05; // 5% padding
    return { 
      min: Math.floor(min - padding), 
      max: Math.ceil(max + padding) 
    };
  };




  // Load chart data
  const loadChartData = useCallback(async () => {
    try {
      setStatus('loading');
      setError('');
      
      let data = [];
      
      if (sessionToken) {
        try {
          const response = await fetch(`/api/market/${symbol}/history?interval=${timeframe}&days=7`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          });
          const result = await response.json();
          
          if (result.success && Array.isArray(result.candles) && result.candles.length > 0) {
            data = sanitizeAndValidate(result.candles);
          }
        } catch (error) {
          console.warn('API failed, using mock data:', error.message);
        }
      }

      if (data.length === 0) {
        data = generateMockData();
      }

      // Apply indicators
      if (indicators.sma) data = calculateSMA(data);
      if (indicators.ema) data = calculateEMA(data);
      if (indicators.bollinger) data = calculateBollingerBands(data);

      setChartData(data);
      setPriceRange(calculatePriceRange(data));
      setStatus('ready');
      
    } catch (err) {
      console.error('Chart data loading failed:', err);
      setError(err.message);
      setStatus('error');
    }
  }, [symbol, sessionToken, timeframe, indicators]);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!sessionToken || wsRef.current) return;

    const wsUrl = `ws://localhost:8000/api/market/ws/${symbol}?token=${sessionToken}&exchange=NSE&feed_type=t`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setWsStatus('connected');
        if (debug) console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          setLastUpdate(new Date());
          
          if (update.data) {
            setChartData(prev => {
              const newData = [...prev];
              const lastCandle = newData[newData.length - 1];
              
              if (lastCandle) {
                // Update last candle
                lastCandle.close = update.data.close;
                lastCandle.high = Math.max(lastCandle.high, update.data.high);
                lastCandle.low = Math.min(lastCandle.low, update.data.low);
              }
              
              return newData;
            });
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };

      ws.onerror = () => setWsStatus('error');
      ws.onclose = () => {
        setWsStatus('disconnected');
        wsRef.current = null;
      };
      
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setWsStatus('error');
    }
  }, [symbol, sessionToken, debug]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Connect WebSocket when ready
  useEffect(() => {
    if (status === 'ready') {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [status, connectWebSocket]);

  // Export data
  const exportData = () => {
    const csv = [
      'Date,Time,Open,High,Low,Close,Volume',
      ...chartData.map(d => `${d.date},${d.time},${d.open},${d.high},${d.low},${d.close},${d.volume}`)
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symbol}_${new Date().toISOString()}.csv`;
    a.click();
  };

  // Custom Candlestick component
  const CandlestickChart = ({ data }) => {
    if (!data || data.length === 0) return null;

    const maxPrice = Math.max(...data.map(d => d.high));
    const minPrice = Math.min(...data.map(d => d.low));
    const priceRange = maxPrice - minPrice;
    const chartHeight = 400;

    return (
      <div className="relative w-full" style={{ height: `${chartHeight}px` }}>
        <svg width="100%" height={chartHeight} className="overflow-visible">
          {data.map((candle, index) => {
            const x = (index / data.length) * 100;
            const wickTop = ((maxPrice - candle.high) / priceRange) * chartHeight;
            const wickBottom = ((maxPrice - candle.low) / priceRange) * chartHeight;
            const bodyTop = ((maxPrice - Math.max(candle.open, candle.close)) / priceRange) * chartHeight;
            const bodyBottom = ((maxPrice - Math.min(candle.open, candle.close)) / priceRange) * chartHeight;
            const isUp = candle.close >= candle.open;
            const color = isUp ? '#26a69a' : '#ef5350';

            return (
              <g key={index}>
                {/* Wick */}
                <line
                  x1={`${x}%`}
                  y1={wickTop}
                  x2={`${x}%`}
                  y2={wickBottom}
                  stroke={color}
                  strokeWidth="1"
                />
                {/* Body */}
                <rect
                  x={`${x - 0.4}%`}
                  y={bodyTop}
                  width="0.8%"
                  height={Math.max(bodyBottom - bodyTop, 1)}
                  fill={color}
                />
              </g>
            );
          })}
        </svg>
        
        {/* Price labels */}
        <div className="absolute right-0 top-0 text-xs text-gray-600">
          ₹{maxPrice.toFixed(2)}
        </div>
        <div className="absolute right-0 bottom-0 text-xs text-gray-600">
          ₹{minPrice.toFixed(2)}
        </div>
      </div>
    );
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold">{data.date} {data.time}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
            <span className="text-gray-600">Open:</span>
            <span className="font-medium">₹{data.open}</span>
            <span className="text-gray-600">High:</span>
            <span className="font-medium text-green-600">₹{data.high}</span>
            <span className="text-gray-600">Low:</span>
            <span className="font-medium text-red-600">₹{data.low}</span>
            <span className="text-gray-600">Close:</span>
            <span className="font-medium">₹{data.close}</span>
            {data.volume > 0 && (
              <>
                <span className="text-gray-600">Volume:</span>
                <span className="font-medium">{data.volume.toLocaleString()}</span>
              </>
            )}
            {data.sma && (
              <>
                <span className="text-gray-600">SMA:</span>
                <span className="font-medium">₹{data.sma}</span>
              </>
            )}
            {data.ema && (
              <>
                <span className="text-gray-600">EMA:</span>
                <span className="font-medium">₹{data.ema}</span>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white p-4' : 'w-full'}`}>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <h4 className="text-lg font-semibold">{symbol}</h4>
          <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
            wsStatus === 'connected' ? 'bg-green-100 text-green-700' :
            wsStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {wsStatus === 'connected' && <Activity className="h-3 w-3" />}
            {wsStatus}
          </span>
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-2 py-1 text-sm border rounded"
          >
            <option value="1">1m</option>
            <option value="5">5m</option>
            <option value="15">15m</option>
            <option value="30">30m</option>
            <option value="60">1h</option>
            <option value="D">1D</option>
          </select>

          {/* Chart type */}
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
            className="px-2 py-1 text-sm border rounded"
          >
            <option value="candlestick">Candlestick</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>

          {/* Indicators */}
          <div className="flex gap-1">
            <button
              onClick={() => setIndicators(prev => ({ ...prev, sma: !prev.sma }))}
              className={`px-2 py-1 text-xs rounded ${
                indicators.sma ? 'bg-orange-100 text-orange-700' : 'bg-gray-100'
              }`}
            >
              SMA
            </button>
            <button
              onClick={() => setIndicators(prev => ({ ...prev, ema: !prev.ema }))}
              className={`px-2 py-1 text-xs rounded ${
                indicators.ema ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
              }`}
            >
              EMA
            </button>
            <button
              onClick={() => setIndicators(prev => ({ ...prev, bollinger: !prev.bollinger }))}
              className={`px-2 py-1 text-xs rounded ${
                indicators.bollinger ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'
              }`}
            >
              BB
            </button>
            <button
              onClick={() => setIndicators(prev => ({ ...prev, volume: !prev.volume }))}
              className={`px-2 py-1 text-xs rounded flex items-center ${
                indicators.volume ? 'bg-green-100 text-green-700' : 'bg-gray-100'
              }`}
            >
              <Volume2 className="h-3 w-3" />
            </button>
          </div>

          {/* Actions */}
          <button onClick={loadChartData} className="p-1 hover:bg-gray-200 rounded" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={exportData} className="p-1 hover:bg-gray-200 rounded" title="Export">
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-2">
          Error: {error}
          <button onClick={loadChartData} className="ml-2 underline text-sm">Retry</button>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {status !== 'ready' ? (
          <div className="flex items-center justify-center" style={{ height: '400px' }}>
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <div className="text-gray-600">{status}</div>
            </div>
          </div>
        ) : (
          <div>
            {chartType === 'candlestick' ? (
              <CandlestickChart data={chartData} />
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis 
                    yAxisId="price"
                    domain={['dataMin - 10', 'dataMax + 10']}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  
                  {chartType === 'area' ? (
                    <Area
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="#2962FF"
                      fill="rgba(41, 98, 255, 0.2)"
                      strokeWidth={2}
                      name="Price"
                    />
                  ) : (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="#2962FF"
                      strokeWidth={2}
                      dot={false}
                      name="Price"
                    />
                  )}
                  
                  {indicators.sma && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="sma"
                      stroke="#FF6D00"
                      strokeWidth={2}
                      dot={false}
                      name="SMA(20)"
                    />
                  )}
                  
                  {indicators.ema && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="ema"
                      stroke="#2196F3"
                      strokeWidth={2}
                      dot={false}
                      name="EMA(20)"
                    />
                  )}
                  
                  {indicators.bollinger && (
                    <>
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbUpper"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                        name="BB Upper"
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbMiddle"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        dot={false}
                        name="BB Middle"
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbLower"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                        name="BB Lower"
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* Volume chart */}
            {indicators.volume && (
              <ResponsiveContainer width="100%" height={120} className="mt-4">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#26a69a" opacity={0.6} name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {(() => {
            const latest = chartData[chartData.length - 1];
            const change = latest.close - latest.open;
            const changePercent = (change / latest.open) * 100;
            return (
              <>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Close</div>
                  <div className="text-lg font-semibold">₹{latest.close}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Change</div>
                  <div className={`text-lg font-semibold flex items-center ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">High</div>
                  <div className="text-lg font-semibold text-green-600">₹{latest.high}</div>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <div className="text-xs text-gray-600">Low</div>
                  <div className="text-lg font-semibold text-red-600">₹{latest.low}</div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default AdvancedTradingChart;