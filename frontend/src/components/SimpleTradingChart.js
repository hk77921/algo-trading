// SimpleTradingChart.js - Minimal version for debugging
import React, { useRef, useEffect, useState } from 'react';
import { createChart } from 'lightweight-charts';
import axios from 'axios';

const SimpleTradingChart = ({ symbol = "TCS-EQ", sessionToken }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [status, setStatus] = useState('initializing');
  const [error, setError] = useState('');

  useEffect(() => {
    const initChart = async () => {
      try {
        console.log('🚀 Simple chart init started');
        setStatus('starting');

        const container = chartContainerRef.current;
        if (!container) {
          throw new Error('No container');
        }

        console.log('📦 Container found:', container.clientWidth, 'x', container.clientHeight);

        // Wait for container to have dimensions
        let attempts = 0;
        while (container.clientWidth === 0 && attempts < 10) {
          console.log('⏳ Waiting for container dimensions...');
          await new Promise(resolve => setTimeout(resolve, 200));
          attempts++;
        }

        if (container.clientWidth === 0) {
          throw new Error('Container has no width after waiting');
        }

        setStatus('creating chart');
        console.log('📊 Creating chart...');

        // Create chart
        const chart = createChart(container, {
          width: container.clientWidth,
          height: 400,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#333',
          }
        });

        const series = chart.addCandlestickSeries({
          upColor: '#26a69a',
          downColor: '#ef5350',
        });

        chartRef.current = chart;
        console.log('✅ Chart created successfully');

        setStatus('loading data');

        // Generate simple test data
        const testData = [];
        const now = Math.floor(Date.now() / 1000);
        for (let i = 0; i < 10; i++) {
          const time = now - (10 - i) * 24 * 60 * 60; // Daily intervals
          const price = 3000 + Math.random() * 100;
          testData.push({
            time: time,
            open: price,
            high: price + Math.random() * 50,
            low: price - Math.random() * 50,
            close: price + (Math.random() - 0.5) * 30
          });
        }

        console.log('📈 Setting test data:', testData);
        series.setData(testData);
        
        setStatus('ready');
        console.log('✅ Chart fully ready');

      } catch (err) {
        console.error('💥 Simple chart failed:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initChart, 100);
    
    return () => {
      clearTimeout(timer);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.warn('Chart cleanup error:', e);
        }
      }
    };
  }, [symbol]);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-semibold">Simple Chart Test - {symbol}</h4>
        <div className="text-sm">
          Status: <span className={`font-medium ${
            status === 'ready' ? 'text-green-600' :
            status === 'error' ? 'text-red-600' :
            'text-yellow-600'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-2">
          Error: {error}
        </div>
      )}

      <div 
        ref={chartContainerRef}
        className="w-full border border-gray-200 rounded-lg bg-white"
        style={{ height: '400px' }}
      >
        {status !== 'ready' && (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div>{status}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Simple test chart - just tests basic lightweight-charts functionality
      </div>
    </div>
  );
};

export default SimpleTradingChart;