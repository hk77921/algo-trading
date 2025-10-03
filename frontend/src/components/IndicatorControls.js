import React from 'react';
import { INDICATOR_DEFAULTS } from '../utils/indicator-config';

const IndicatorControls = ({ activeIndicators, onAdd, onRemove, onUpdate }) => {
  const handleAddIndicator = (type) => {
    const config = INDICATOR_DEFAULTS[type];
    onAdd({
      id: `${type}_${Date.now()}`,
      type,
      ...config,
      visible: true
    });
  };

  return (
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <div className="flex gap-2 mb-4">
        {Object.keys(INDICATOR_DEFAULTS).map(type => (
          <button
            key={type}
            onClick={() => handleAddIndicator(type)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add {INDICATOR_DEFAULTS[type].name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {activeIndicators.map(indicator => (
          <div key={indicator.id} className="flex items-center gap-2 p-2 bg-white rounded">
            <span className="font-medium">{INDICATOR_DEFAULTS[indicator.type].name}</span>
            <button
              onClick={() => onRemove(indicator.id)}
              className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded"
            >
              Remove
            </button>
            {/* Add parameter controls here */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndicatorControls;