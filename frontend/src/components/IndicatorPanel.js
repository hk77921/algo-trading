// src/components/IndicatorPanel.js
// Control panel for adding and configuring technical indicators

import React, { useState } from 'react';
import { TrendingUp, Settings, X, Plus, Eye, EyeOff } from 'lucide-react';

const AVAILABLE_INDICATORS = [
  {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    category: 'Trend',
    defaultParams: { period: 20 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 1, max: 200, default: 20 }
    ],
    color: '#2962FF'
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    category: 'Trend',
    defaultParams: { period: 20 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 1, max: 200, default: 20 }
    ],
    color: '#FF6D00'
  },
  {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    category: 'Momentum',
    defaultParams: { period: 14 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 2, max: 50, default: 14 }
    ],
    color: '#9C27B0',
    separatePane: true
  },
  {
    id: 'bollinger',
    name: 'Bollinger Bands',
    shortName: 'BB',
    category: 'Volatility',
    defaultParams: { period: 20, stdDev: 2 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 2, max: 100, default: 20 },
      { name: 'stdDev', label: 'Std Dev', type: 'number', min: 1, max: 4, step: 0.1, default: 2 }
    ],
    color: '#2962FF'
  },
  {
    id: 'macd',
    name: 'MACD',
    shortName: 'MACD',
    category: 'Momentum',
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    params: [
      { name: 'fastPeriod', label: 'Fast', type: 'number', min: 2, max: 50, default: 12 },
      { name: 'slowPeriod', label: 'Slow', type: 'number', min: 2, max: 100, default: 26 },
      { name: 'signalPeriod', label: 'Signal', type: 'number', min: 2, max: 50, default: 9 }
    ],
    color: '#FF6D00',
    separatePane: true
  },
  {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    shortName: 'Stoch',
    category: 'Momentum',
    defaultParams: { period: 14, smoothK: 3, smoothD: 3 },
    params: [
      { name: 'period', label: 'K Period', type: 'number', min: 2, max: 50, default: 14 },
      { name: 'smoothK', label: 'K Smooth', type: 'number', min: 1, max: 10, default: 3 },
      { name: 'smoothD', label: 'D Smooth', type: 'number', min: 1, max: 10, default: 3 }
    ],
    color: '#4CAF50',
    separatePane: true
  },
  {
    id: 'atr',
    name: 'Average True Range',
    shortName: 'ATR',
    category: 'Volatility',
    defaultParams: { period: 14 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 2, max: 50, default: 14 }
    ],
    color: '#FF9800',
    separatePane: true
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price',
    shortName: 'VWAP',
    category: 'Volume',
    defaultParams: {},
    params: [],
    color: '#00BCD4'
  },
  {
    id: 'sar',
    name: 'Parabolic SAR',
    shortName: 'SAR',
    category: 'Trend',
    defaultParams: { acceleration: 0.02, maximum: 0.2 },
    params: [
      { name: 'acceleration', label: 'Acceleration', type: 'number', min: 0.01, max: 0.1, step: 0.01, default: 0.02 },
      { name: 'maximum', label: 'Maximum', type: 'number', min: 0.1, max: 0.5, step: 0.1, default: 0.2 }
    ],
    color: '#E91E63'
  },
  {
    id: 'mfi',
    name: 'Money Flow Index',
    shortName: 'MFI',
    category: 'Volume',
    defaultParams: { period: 14 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 2, max: 50, default: 14 }
    ],
    color: '#673AB7',
    separatePane: true
  },
  {
    id: 'obv',
    name: 'On-Balance Volume',
    shortName: 'OBV',
    category: 'Volume',
    defaultParams: {},
    params: [],
    color: '#795548',
    separatePane: true
  },
  {
    id: 'cci',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    category: 'Momentum',
    defaultParams: { period: 20 },
    params: [
      { name: 'period', label: 'Period', type: 'number', min: 2, max: 100, default: 20 }
    ],
    color: '#607D8B',
    separatePane: true
  }
];

const IndicatorPanel = ({ activeIndicators, onAddIndicator, onRemoveIndicator, onUpdateIndicator }) => {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingIndicator, setEditingIndicator] = useState(null);
  
  const categories = ['All', 'Trend', 'Momentum', 'Volatility', 'Volume'];
  
  const filteredIndicators = selectedCategory === 'All'
    ? AVAILABLE_INDICATORS
    : AVAILABLE_INDICATORS.filter(ind => ind.category === selectedCategory);

  const handleAddIndicator = (indicator) => {
    const newIndicator = {
      id: `${indicator.id}_${Date.now()}`,
      type: indicator.id,
      name: indicator.name,
      shortName: indicator.shortName,
      params: { ...indicator.defaultParams },
      color: indicator.color,
      visible: true,
      separatePane: indicator.separatePane || false
    };
    
    onAddIndicator(newIndicator);
    setShowAddPanel(false);
  };

  const handleUpdateParams = (indicatorId, newParams) => {
    onUpdateIndicator(indicatorId, newParams);
    setEditingIndicator(null);
  };

  const toggleVisibility = (indicatorId) => {
    const indicator = activeIndicators.find(ind => ind.id === indicatorId);
    if (indicator) {
      onUpdateIndicator(indicatorId, { visible: !indicator.visible });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Technical Indicators
        </h3>
        <button
          onClick={() => setShowAddPanel(!showAddPanel)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Indicator
        </button>
      </div>

      {/* Active Indicators List */}
      {activeIndicators.length > 0 && (
        <div className="space-y-2 mb-4">
          {activeIndicators.map((indicator) => (
            <div
              key={indicator.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: indicator.color }}
                />
                <div>
                  <div className="font-medium text-gray-900">
                    {indicator.shortName}
                    {Object.keys(indicator.params).length > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        ({Object.entries(indicator.params).map(([key, val]) => val).join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{indicator.name}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleVisibility(indicator.id)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                  title={indicator.visible ? 'Hide' : 'Show'}
                >
                  {indicator.visible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>
                
                <button
                  onClick={() => setEditingIndicator(indicator)}
                  className="p-1 text-gray-500 hover:text-gray-700 rounded"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                
                <button
                  onClick={() => onRemoveIndicator(indicator.id)}
                  className="p-1 text-red-500 hover:text-red-700 rounded"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Indicator Panel */}
      {showAddPanel && (
        <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-gray-700">Category:</span>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {filteredIndicators.map((indicator) => {
              const isActive = activeIndicators.some(
                (active) => active.type === indicator.id
              );
              
              return (
                <button
                  key={indicator.id}
                  onClick={() => !isActive && handleAddIndicator(indicator)}
                  disabled={isActive}
                  className={`p-3 text-left rounded-md border transition-colors ${
                    isActive
                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                      : 'bg-white border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: indicator.color }}
                    />
                    <span className="font-medium text-gray-900">
                      {indicator.shortName}
                    </span>
                    {indicator.separatePane && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                        Panel
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{indicator.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {indicator.category}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Indicator Parameters Modal */}
      {editingIndicator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Configure {editingIndicator.shortName}
              </h3>
              <button
                onClick={() => setEditingIndicator(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <IndicatorSettings
              indicator={editingIndicator}
              onSave={(newParams) => handleUpdateParams(editingIndicator.id, newParams)}
              onCancel={() => setEditingIndicator(null)}
            />
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeIndicators.length === 0 && !showAddPanel && (
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No indicators added yet</p>
          <p className="text-sm mt-1">Click "Add Indicator" to get started</p>
        </div>
      )}
    </div>
  );
};

// Component for editing indicator parameters
const IndicatorSettings = ({ indicator, onSave, onCancel }) => {
  const [params, setParams] = useState({ ...indicator.params });
  
  const indicatorConfig = AVAILABLE_INDICATORS.find(
    (ind) => ind.id === indicator.type
  );

  const handleParamChange = (paramName, value) => {
    setParams((prev) => ({
      ...prev,
      [paramName]: parseFloat(value) || value
    }));
  };

  const handleSave = () => {
    onSave({ params });
  };

  if (!indicatorConfig || indicatorConfig.params.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No parameters to configure
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4 mb-6">
        {indicatorConfig.params.map((param) => (
          <div key={param.name}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {param.label}
            </label>
            <input
              type={param.type}
              value={params[param.name] || param.default}
              onChange={(e) => handleParamChange(param.name, e.target.value)}
              min={param.min}
              max={param.max}
              step={param.step || 1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Min: {param.min}</span>
              <span>Max: {param.max}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default IndicatorPanel