// DataInspector.js - Fixed Debug component
import React, { useState, useCallback } from 'react';
import TradingChart, { handleWebSocketMessage } from './TradingChart';

const DataInspector = ({ data, title = "Data Inspector" }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState('');

  if (!data) {
    return (
      <div className="border border-gray-300 rounded p-3 mb-4 bg-gray-50">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const formatValue = (value) => {
    if (value === null) return <span className="text-red-600">null</span>;
    if (value === undefined) return <span className="text-orange-600">undefined</span>;
    if (typeof value === 'number') {
      if (isNaN(value)) return <span className="text-red-600">NaN</span>;
      if (!isFinite(value)) return <span className="text-red-600">Infinity</span>;
      return <span className="text-blue-600">{value}</span>;
    }
    if (typeof value === 'string') return <span className="text-green-600">"{value}"</span>;
    if (typeof value === 'boolean') return <span className="text-purple-600">{value.toString()}</span>;
    if (typeof value === 'object') return <span className="text-gray-600">{JSON.stringify(value, null, 2)}</span>;
    return <span>{String(value)}</span>;
  };

  const renderObject = (obj, depth = 0) => {
    if (depth > 3) return <span className="text-gray-500">...</span>;
    
    return (
      <div className="ml-4">
        {Object.entries(obj).map(([key, value]) => {
          if (filter && !key.toLowerCase().includes(filter.toLowerCase())) {
            return null;
          }
          
          return (
            <div key={key} className="py-1">
              <span className="font-mono text-sm text-gray-800">{key}:</span>{' '}
              {typeof value === 'object' && value !== null ? 
                renderObject(value, depth + 1) : 
                formatValue(value)
              }
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border border-gray-300 rounded p-3 mb-4 bg-gray-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-gray-800">{title}</h4>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter properties..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded"
          />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="max-h-64 overflow-auto bg-white p-2 rounded border">
          <pre className="text-xs font-mono">
            {typeof data === 'object' ? renderObject(data) : formatValue(data)}
          </pre>
        </div>
      )}
    </div>
  );
};

// Enhanced TradingChart with debug mode
const TradingChartWithDebug = ({ symbol, sessionToken, debug = true}) => {
  const [lastWebSocketData, setLastWebSocketData] = useState(null);
  const [lastHistoricalData, setLastHistoricalData] = useState(null);
  const [chartErrors, setChartErrors] = useState([]);

  // Custom WebSocket message handler with debugging
  const debugHandleWebSocketMessage = useCallback((data, candleSeriesRef, series) => {
    if (debug) {
      setLastWebSocketData({
        timestamp: new Date().toISOString(),
        rawData: data,
        processed: data?.data || data
      });
    }

    try {
      // Call original handler
      handleWebSocketMessage(data, candleSeriesRef);
    } catch (error) {
      console.error('Chart update error:', error);
      if (debug) {
        setChartErrors(prev => [...prev.slice(-4), {
          timestamp: new Date().toISOString(),
          error: error.message,
          data: data
        }]);
      }
    }
  }, [debug]);

  // Historical data handler
  const handleHistoricalData = useCallback((data) => {
    if (debug) {
      setLastHistoricalData({
        timestamp: new Date().toISOString(),
        count: data?.length || 0,
        sample: data?.slice(0, 3) || null
      });
    }
  }, [debug]);

  return (
    <div className="w-full">
      {debug && (
        <div className="mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Debug Mode Enabled</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setLastWebSocketData(null)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded"
              >
                Clear WS Data
              </button>
              <button
                onClick={() => setChartErrors([])}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded"
              >
                Clear Errors
              </button>
            </div>
          </div>
          
          <DataInspector 
            data={lastWebSocketData} 
            title={`Last WebSocket Message (${symbol})`} 
          />
          
          <DataInspector 
            data={lastHistoricalData} 
            title="Last Historical Data Response" 
          />
          
          {chartErrors.length > 0 && (
            <div className="border border-red-300 rounded p-3 bg-red-50">
              <h4 className="font-semibold text-red-800 mb-2">
                Chart Errors ({chartErrors.length})
              </h4>
              {chartErrors.map((error, idx) => (
                <div key={idx} className="text-sm text-red-700 mb-2">
                  <div className="font-mono text-xs text-gray-600">{error.timestamp}</div>
                  <div className="font-medium">{error.error}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <TradingChart 
        symbol={symbol} 
        sessionToken={sessionToken}
        onWebSocketMessage={debugHandleWebSocketMessage}
        onHistoricalData={handleHistoricalData}
      />
    </div>
  );
};

export default DataInspector;
export { TradingChartWithDebug };