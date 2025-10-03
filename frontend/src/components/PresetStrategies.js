// src/components/PresetStrategies.js
// Pre-built trading strategies using technical indicators

import React, { useState } from 'react';
import { TrendingUp, Zap, Target, Activity } from 'lucide-react';

const PRESET_STRATEGIES = [
  {
    id: 'golden_cross',
    name: 'Golden Cross Strategy',
    description: 'Buy when fast MA crosses above slow MA, sell when it crosses below',
    category: 'Trend Following',
    icon: TrendingUp,
    indicators: [
      { type: 'sma', params: { period: 50 }, color: '#2962FF' },
      { type: 'sma', params: { period: 200 }, color: '#FF6D00' }
    ],
    signalLogic: (data, indicators) => {
      if (data.length < 2) return 'HOLD';
      
      const sma50 = indicators.find(i => i.params.period === 50).data;
      const sma200 = indicators.find(i => i.params.period === 200).data;
      
      if (!sma50 || !sma200 || sma50.length < 2 || sma200.length < 2) return 'HOLD';
      
      const currentIdx = sma50.length - 1;
      const prevIdx = currentIdx - 1;
      
      // Golden cross - bullish signal
      if (sma50[prevIdx].value < sma200[prevIdx].value && 
          sma50[currentIdx].value > sma200[currentIdx].value) {
        return 'BUY';
      }
      
      // Death cross - bearish signal
      if (sma50[prevIdx].value > sma200[prevIdx].value && 
          sma50[currentIdx].value < sma200[currentIdx].value) {
        return 'SELL';
      }
      
      return 'HOLD';
    },
    params: {
      fastPeriod: 50,
      slowPeriod: 200
    }
  },
  {
    id: 'rsi_oversold',
    name: 'RSI Oversold/Overbought',
    description: 'Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)',
    category: 'Mean Reversion',
    icon: Activity,
    indicators: [
      { type: 'rsi', params: { period: 14 }, color: '#9C27B0' }
    ],
    signalLogic: (data, indicators) => {
      const rsi = indicators[0].data;
      if (!rsi || rsi.length === 0) return 'HOLD';
      
      const currentRSI = rsi[rsi.length - 1].value;
      
      if (currentRSI < 30) return 'BUY';
      if (currentRSI > 70) return 'SELL';
      
      return 'HOLD';
    },
    params: {
      oversoldLevel: 30,
      overboughtLevel: 70,
      period: 14
    }
  },
  {
    id: 'bollinger_bounce',
    name: 'Bollinger Band Bounce',
    description: 'Buy at lower band, sell at upper band',
    category: 'Mean Reversion',
    icon: Target,
    indicators: [
      { type: 'bollinger', params: { period: 20, stdDev: 2 }, color: '#2962FF' }
    ],
    signalLogic: (data, indicators) => {
      if (data.length === 0) return 'HOLD';
      
      const bb = indicators[0];
      if (!bb.upper || !bb.lower || bb.upper.length === 0) return 'HOLD';
      
      const currentPrice = data[data.length - 1].close;
      const upperBand = bb.upper[bb.upper.length - 1].value;
      const lowerBand = bb.lower[bb.lower.length - 1].value;
      
      // Price at or below lower band - oversold
      if (currentPrice <= lowerBand * 1.01) return 'BUY';
      
      // Price at or above upper band - overbought
      if (currentPrice >= upperBand * 0.99) return 'SELL';
      
      return 'HOLD';
    },
    params: {
      period: 20,
      stdDev: 2
    }
  },
  {
    id: 'macd_crossover',
    name: 'MACD Crossover',
    description: 'Buy when MACD crosses above signal, sell when it crosses below',
    category: 'Momentum',
    icon: Zap,
    indicators: [
      { type: 'macd', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, color: '#FF6D00' }
    ],
    signalLogic: (data, indicators) => {
      const macdData = indicators[0];
      if (!macdData.macd || !macdData.signal || macdData.macd.length < 2) return 'HOLD';
      
      const currentIdx = macdData.macd.length - 1;
      const prevIdx = currentIdx - 1;
      
      const macdCurrent = macdData.macd[currentIdx].value;
      const macdPrev = macdData.macd[prevIdx].value;
      const signalCurrent = macdData.signal[currentIdx].value;
      const signalPrev = macdData.signal[prevIdx].value;
      
      // Bullish crossover
      if (macdPrev < signalPrev && macdCurrent > signalCurrent) {
        return 'BUY';
      }
      
      // Bearish crossover
      if (macdPrev > signalPrev && macdCurrent < signalCurrent) {
        return 'SELL';
      }
      
      return 'HOLD';
    },
    params: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    }
  },
  {
    id: 'ema_scalping',
    name: 'EMA Scalping',
    description: 'Fast scalping with 9 and 21 EMA crossovers',
    category: 'Scalping',
    icon: Zap,
    indicators: [
      { type: 'ema', params: { period: 9 }, color: '#4CAF50' },
      { type: 'ema', params: { period: 21 }, color: '#F44336' }
    ],
    signalLogic: (data, indicators) => {
      if (data.length < 2) return 'HOLD';
      
      const ema9 = indicators.find(i => i.params.period === 9).data;
      const ema21 = indicators.find(i => i.params.period === 21).data;
      
      if (!ema9 || !ema21 || ema9.length < 2 || ema21.length < 2) return 'HOLD';
      
      const currentIdx = ema9.length - 1;
      const prevIdx = currentIdx - 1;
      
      // Bullish crossover
      if (ema9[prevIdx].value < ema21[prevIdx].value && 
          ema9[currentIdx].value > ema21[currentIdx].value) {
        return 'BUY';
      }
      
      // Bearish crossover
      if (ema9[prevIdx].value > ema21[prevIdx].value && 
          ema9[currentIdx].value < ema21[currentIdx].value) {
        return 'SELL';
      }
      
      return 'HOLD';
    },
    params: {
      fastPeriod: 9,
      slowPeriod: 21
    }
  },
  {
    id: 'stochastic_divergence',
    name: 'Stochastic Momentum',
    description: 'Buy when Stochastic crosses above 20, sell when crosses below 80',
    category: 'Momentum',
    icon: Activity,
    indicators: [
      { type: 'stochastic', params: { period: 14, smoothK: 3, smoothD: 3 }, color: '#4CAF50' }
    ],
    signalLogic: (data, indicators) => {
      const stoch = indicators[0];
      if (!stoch.k || !stoch.d || stoch.k.length < 2) return 'HOLD';
      
      const currentIdx = stoch.k.length - 1;
      const prevIdx = currentIdx - 1;
      
      const kCurrent = stoch.k[currentIdx].value;
      const kPrev = stoch.k[prevIdx].value;
      const dCurrent = stoch.d[currentIdx].value;
      const dPrev = stoch.d[prevIdx].value;
      
      // Bullish - K crosses above D in oversold zone
      if (kPrev < 20 && kCurrent > 20 && kPrev < dPrev && kCurrent > dCurrent) {
        return 'BUY';
      }
      
      // Bearish - K crosses below D in overbought zone
      if (kPrev > 80 && kCurrent < 80 && kPrev > dPrev && kCurrent < dCurrent) {
        return 'SELL';
      }
      
      return 'HOLD';
    },
    params: {
      period: 14,
      oversoldLevel: 20,
      overboughtLevel: 80
    }
  },
  {
    id: 'triple_ma',
    name: 'Triple Moving Average',
    description: 'Trend confirmation with 3 moving averages',
    category: 'Trend Following',
    icon: TrendingUp,
    indicators: [
      { type: 'ema', params: { period: 5 }, color: '#4CAF50' },
      { type: 'ema', params: { period: 20 }, color: '#2196F3' },
      { type: 'ema', params: { period: 50 }, color: '#FF9800' }
    ],
    signalLogic: (data, indicators) => {
      if (data.length === 0) return 'HOLD';
      
      const ema5 = indicators.find(i => i.params.period === 5).data;
      const ema20 = indicators.find(i => i.params.period === 20).data;
      const ema50 = indicators.find(i => i.params.period === 50).data;
      
      if (!ema5 || !ema20 || !ema50 || ema5.length === 0) return 'HOLD';
      
      const idx = ema5.length - 1;
      const price = data[data.length - 1].close;
      
      // Strong bullish - all EMAs aligned and price above
      if (ema5[idx].value > ema20[idx].value && 
          ema20[idx].value > ema50[idx].value && 
          price > ema5[idx].value) {
        return 'BUY';
      }
      
      // Strong bearish - all EMAs aligned and price below
      if (ema5[idx].value < ema20[idx].value && 
          ema20[idx].value < ema50[idx].value && 
          price < ema5[idx].value) {
        return 'SELL';
      }
      
      return 'HOLD';
    },
    params: {
      fast: 5,
      medium: 20,
      slow: 50
    }
  }
];

const PresetStrategies = ({ onApplyStrategy }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedStrategy, setExpandedStrategy] = useState(null);

  const categories = ['All', ...new Set(PRESET_STRATEGIES.map(s => s.category))];
  
  const filteredStrategies = selectedCategory === 'All'
    ? PRESET_STRATEGIES
    : PRESET_STRATEGIES.filter(s => s.category === selectedCategory);

  const handleApplyStrategy = (strategy) => {
    onApplyStrategy(strategy);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Preset Trading Strategies
        </h3>
        <p className="text-sm text-gray-600">
          Select a pre-configured strategy to automatically add indicators and set up signals
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStrategies.map((strategy) => {
          const Icon = strategy.icon;
          const isExpanded = expandedStrategy === strategy.id;
          
          return (
            <div
              key={strategy.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{strategy.name}</h4>
                    <span className="text-xs text-gray-500">{strategy.category}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">{strategy.description}</p>

              {/* Indicators Used */}
              <div className="mb-4">
                <div className="text-xs font-medium text-gray-700 mb-2">Indicators:</div>
                <div className="flex flex-wrap gap-2">
                  {strategy.indicators.map((indicator, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                    >
                      {indicator.type.toUpperCase()}
                      {indicator.params.period && ` (${indicator.params.period})`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Parameters (expandable) */}
              {isExpanded && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <div className="text-xs font-medium text-gray-700 mb-2">Parameters:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(strategy.params).map(([key, value]) => (
                      <div key={key} className="text-xs">
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium text-gray-900 ml-1">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleApplyStrategy(strategy)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                >
                  Apply Strategy
                </button>
                <button
                  onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                >
                  {isExpanded ? 'Less' : 'Details'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredStrategies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Target className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No strategies found in this category</p>
        </div>
      )}
    </div>
  );
};

export default PresetStrategies;
export { PRESET_STRATEGIES };