// ChartDataDebugger.js - Diagnose the exact data issue
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChartDataDebugger = ({ symbol = "TCS-EQ", sessionToken }) => {
  const [rawData, setRawData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeCandle = (candle, index) => {
    const issues = [];
    const warnings = [];
    
    // Check structure
    if (!candle || typeof candle !== 'object') {
      issues.push('Not an object');
      return { issues, warnings, valid: false };
    }

    // Check time
    const time = candle.time || candle.timestamp;
    if (time === null || time === undefined) {
      issues.push('Missing time field');
    } else {
      if (typeof time === 'string') {
        const parsed = parseInt(time, 10);
        if (isNaN(parsed)) {
          issues.push(`Invalid time string: "${time}"`);
        } else if (parsed <= 0) {
          issues.push(`Non-positive time: ${parsed}`);
        } else if (parsed.toString() !== time) {
          warnings.push(`Time string "${time}" parsed as ${parsed}`);
        }
      } else if (typeof time === 'number') {
        if (!Number.isFinite(time)) {
          issues.push(`Non-finite time: ${time}`);
        } else if (time <= 0) {
          issues.push(`Non-positive time: ${time}`);
        }
      } else {
        issues.push(`Time is not string or number: ${typeof time}`);
      }
    }

    // Check OHLC
    const ohlcFields = ['open', 'high', 'low', 'close'];
    const ohlcValues = {};
    
    for (const field of ohlcFields) {
      const value = candle[field];
      if (value === null || value === undefined) {
        issues.push(`Missing ${field} field`);
      } else {
        const numValue = parseFloat(value);
        if (!Number.isFinite(numValue)) {
          issues.push(`Non-finite ${field}: ${value}`);
        } else if (numValue <= 0) {
          issues.push(`Non-positive ${field}: ${numValue}`);
        } else {
          ohlcValues[field] = numValue;
        }
      }
    }

    // Check OHLC relationships
    if (ohlcValues.high && ohlcValues.low && ohlcValues.high < ohlcValues.low) {
      issues.push(`High (${ohlcValues.high}) < Low (${ohlcValues.low})`);
    }

    return {
      issues,
      warnings,
      valid: issues.length === 0,
      ohlcValues,
      timeValue: time,
      // default duplicate flags (will be set later by cross-candle pass)
      duplicate: false,
      duplicateOf: null
    };
  };

  const loadAndAnalyzeData = async () => {
    setLoading(true);
    setError('');
    setRawData(null);
    setProcessedData(null);
    setAnalysis(null);

    try {
      console.log('🔍 Loading data for analysis...');
      
      const response = await axios.get(`/api/market/${symbol}/history`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        },
        params: {
          interval: '60',
          days: 2
        }
      });

      if (!response.data.success || !response.data.candles) {
        throw new Error('Invalid response structure');
      }

      const rawCandles = response.data.candles;
      setRawData(rawCandles);
      
      console.log(`🔍 Analyzing ${rawCandles.length} candles...`);

      // Analyze each candle
      const analysisResults = rawCandles.map((candle, index) => ({
        index,
        candle,
        analysis: analyzeCandle(candle, index)
      }));

      // CROSS-CANDLE DUPLICATE DETECTION PASS
      // canonicalKey: `${time}|${open}|${high}|${low}|${close}` (uses raw values normalized)
      const canonicalMap = new Map(); // canonicalKey -> firstIndex
      const timeMap = new Map(); // timeKey -> [indices] (to detect same-time conflicts)
      for (const r of analysisResults) {
        const { index, candle } = r;
        // Normalize time for key using raw string/number (not converting to ms/s here)
        const rawTime = candle.time ?? candle.timestamp ?? '';
        // Use stringified numeric OHLC so keys consistent
        const o = (candle.open === undefined || candle.open === null) ? '' : String(parseFloat(candle.open));
        const h = (candle.high === undefined || candle.high === null) ? '' : String(parseFloat(candle.high));
        const l = (candle.low === undefined || candle.low === null) ? '' : String(parseFloat(candle.low));
        const cval = (candle.close === undefined || candle.close === null) ? '' : String(parseFloat(candle.close));

        const canonicalKey = `${rawTime}|${o}|${h}|${l}|${cval}`;

        if (canonicalMap.has(canonicalKey)) {
          const firstIndex = canonicalMap.get(canonicalKey);
          r.analysis.duplicate = true;
          r.analysis.duplicateOf = firstIndex;
        } else {
          canonicalMap.set(canonicalKey, index);
        }

        // same-time map
        const timeKey = String(rawTime);
        const arr = timeMap.get(timeKey) || [];
        arr.push(index);
        timeMap.set(timeKey, arr);
      }

      // Build same-time conflict list (same timestamp but different OHLC)
      const sameTimeConflicts = [];
      for (const [timeKey, indices] of timeMap.entries()) {
        if (indices.length > 1) {
          // check if all indices have identical canonical key; if not, it's a conflict
          const keys = new Set(indices.map(i => {
            const c = rawCandles[i];
            const o = (c.open === undefined || c.open === null) ? '' : String(parseFloat(c.open));
            const h = (c.high === undefined || c.high === null) ? '' : String(parseFloat(c.high));
            const l = (c.low === undefined || c.low === null) ? '' : String(parseFloat(c.low));
            const cval = (c.close === undefined || c.close === null) ? '' : String(parseFloat(c.close));
            return `${timeKey}|${o}|${h}|${l}|${cval}`;
          }));
          if (keys.size > 1) {
            sameTimeConflicts.push({ time: timeKey, indices });
          }
        }
      }

      // Generate summary
      const validCandles = analysisResults.filter(r => r.analysis.valid);
      const invalidCandles = analysisResults.filter(r => !r.analysis.valid);
      const warningCandles = analysisResults.filter(r => r.analysis.warnings.length > 0);
      const duplicateCandles = analysisResults.filter(r => r.analysis.duplicate);
      const duplicateMap = {};
      duplicateCandles.forEach(({ analysis }) => {
        const key = `dup->${analysis.duplicateOf}`;
        duplicateMap[key] = (duplicateMap[key] || 0) + 1;
      });

      const issueTypes = {};
      invalidCandles.forEach(({ analysis }) => {
        analysis.issues.forEach(issue => {
          issueTypes[issue] = (issueTypes[issue] || 0) + 1;
        });
      });

      const summary = {
        total: rawCandles.length,
        valid: validCandles.length,
        invalid: invalidCandles.length,
        warnings: warningCandles.length,
        duplicates: duplicateCandles.length,
        duplicateBuckets: duplicateMap,              // grouping by first index
        sameTimeConflicts: sameTimeConflicts.length,
        sameTimeSamples: sameTimeConflicts.slice(0, 3),
        issueTypes,
        firstInvalid: invalidCandles[0] || null,
        sampleValid: validCandles.slice(0, 3),
        sampleInvalid: invalidCandles.slice(0, 3),
        sampleDuplicates: duplicateCandles.slice(0, 5)
      };

      setAnalysis(summary);

      // Try to process valid data
      if (validCandles.length > 0) {
        const processedCandles = validCandles.map(({ candle, index, analysis: a }) => {
          let time = candle.time || candle.timestamp;
          if (typeof time === 'string') {
            time = parseInt(time, 10);
          }
          if (time > 1e12) {
            time = Math.floor(time / 1000);
          }

          return {
            // keep original index to allow mapping back to raw
            originalIndex: index,
            time: time,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            // duplicate info from analysis (cross-check)
            isDuplicate: a.duplicate || false,
            duplicateOf: a.duplicateOf
          };
        });

        // Sort by time
        processedCandles.sort((a, b) => a.time - b.time);
        
        setProcessedData(processedCandles);
        console.log('✅ Data processing complete');
      }

    } catch (err) {
      console.error('💥 Analysis failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol && sessionToken) {
      loadAndAnalyzeData();
    }
  }, [symbol, sessionToken]);

  if (loading) {
    return (
      <div className="w-full p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-center text-sm text-gray-600">Analyzing data...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Chart Data Debugger</h3>
        <button
          onClick={loadAndAnalyzeData}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Reanalyze
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {analysis && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Analysis Summary</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{analysis.total}</div>
              <div className="text-sm text-blue-800">Total Candles</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded">
              <div className="text-2xl font-bold text-green-600">{analysis.valid}</div>
              <div className="text-sm text-green-800">Valid Candles</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{analysis.invalid}</div>
              <div className="text-sm text-red-800">Invalid Candles</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <div className="text-2xl font-bold text-yellow-600">{analysis.warnings}</div>
              <div className="text-sm text-yellow-800">Warnings</div>
            </div>
          </div>

          {/* Duplicate info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-800">{analysis.duplicates}</div>
              <div className="text-sm text-gray-600">Duplicate Candles</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-800">{analysis.sameTimeConflicts}</div>
              <div className="text-sm text-gray-600">Same-time Conflicts</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-gray-800">{Object.keys(analysis.duplicateBuckets || {}).length}</div>
              <div className="text-sm text-gray-600">Duplicate Buckets</div>
            </div>
          </div>

          {analysis.invalid > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-red-700">Issue Types:</h5>
              <div className="bg-red-50 p-3 rounded">
                {Object.entries(analysis.issueTypes).map(([issue, count]) => (
                  <div key={issue} className="flex justify-between text-sm">
                    <span>{issue}:</span>
                    <span className="font-medium">{count} candles</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.sampleInvalid.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-red-700">Sample Invalid Candles:</h5>
              <div className="bg-red-50 p-3 rounded max-h-48 overflow-auto">
                {analysis.sampleInvalid.map(({ index, candle, analysis: candleAnalysis }) => (
                  <details key={index} className="mb-2">
                    <summary className="cursor-pointer font-mono text-sm">
                      Index {index}: {candleAnalysis.issues.join(', ')}
                    </summary>
                    <pre className="text-xs mt-1 bg-white p-2 rounded">
                      {JSON.stringify(candle, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}

          {analysis.sampleDuplicates && analysis.sampleDuplicates.length > 0 && (
            <div className="mb-4">
              <h5 className="font-medium mb-2 text-gray-800">Sample Duplicate Candles:</h5>
              <div className="bg-gray-50 p-3 rounded max-h-48 overflow-auto">
                {analysis.sampleDuplicates.map(({ index, candle, analysis: a }) => (
                  <details key={index} className="mb-2">
                    <summary className="cursor-pointer font-mono text-sm">
                      Index {index}: duplicateOf={a.duplicateOf}
                    </summary>
                    <pre className="text-xs mt-1 bg-white p-2 rounded">
                      {JSON.stringify(candle, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}

          {processedData && (
            <div>
              <h5 className="font-medium mb-2 text-green-700">Processed Data Sample:</h5>
              <div className="bg-green-50 p-3 rounded max-h-48 overflow-auto">
                <div className="text-sm mb-2">
                  First 3 processed candles (out of {processedData.length}):
                </div>
                <pre className="text-xs bg-white p-2 rounded">
                  {JSON.stringify(processedData.slice(0, 3), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {rawData && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold mb-3">Raw Data Sample</h4>
          <div className="text-sm mb-2">First 3 raw candles:</div>
          <div className="bg-gray-50 p-3 rounded max-h-48 overflow-auto">
            <pre className="text-xs">
              {JSON.stringify(rawData.slice(0, 3), null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold mb-2 text-yellow-800">Quick Test</h4>
        <p className="text-sm text-yellow-700 mb-3">
          Use this processed data to test if the lightweight-charts library accepts it:
        </p>
        <button
          onClick={() => {
            if (processedData && processedData.length > 0) {
              // Create a minimal chart to test
              import('lightweight-charts').then(({ createChart }) => {
                const testContainer = document.createElement('div');
                testContainer.style.width = '400px';
                testContainer.style.height = '200px';
                document.body.appendChild(testContainer);
                
                try {
                  const testChart = createChart(testContainer, { width: 400, height: 200 });
                  const testSeries = testChart.addCandlestickSeries();
                  
                  console.log('🧪 Testing with processed data:', processedData.slice(0, 5));
                  testSeries.setData(processedData);
                  
                  alert('✅ Success! The processed data works with lightweight-charts.');
                  
                  testChart.remove();
                  document.body.removeChild(testContainer);
                } catch (error) {
                  console.error('🧪 Test failed:', error);
                  alert(`❌ Test failed: ${error.message}`);
                  
                  document.body.removeChild(testContainer);
                }
              });
            } else {
              alert('No processed data available to test');
            }
          }}
          disabled={!processedData || processedData.length === 0}
          className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 disabled:opacity-50"
        >
          Test Processed Data
        </button>
      </div>
    </div>
  );
};

export default ChartDataDebugger;
