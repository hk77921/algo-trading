// RefTestComponent.js - Test if refs work at all
import React, { useRef, useCallback, useState } from 'react';

const RefTestComponent = () => {
  const testRef = useRef(null);
  const [refStatus, setRefStatus] = useState('Not set');
  const [dimensions, setDimensions] = useState('0x0');

  const handleRef = useCallback((element) => {
    console.log('🧪 Test ref callback called with:', element);
    testRef.current = element;
    
    if (element) {
      setRefStatus('Set ✅');
      setDimensions(`${element.clientWidth}x${element.clientHeight}`);
      console.log('🧪 Ref set successfully:', element.clientWidth, 'x', element.clientHeight);
    } else {
      setRefStatus('Null ❌');
      setDimensions('0x0');
      console.log('🧪 Ref set to null');
    }
  }, []);

  const checkRef = () => {
    console.log('🧪 Manual ref check:', testRef.current);
    if (testRef.current) {
      setRefStatus('Exists ✅');
      setDimensions(`${testRef.current.clientWidth}x${testRef.current.clientHeight}`);
    } else {
      setRefStatus('Missing ❌');
      setDimensions('0x0');
    }
  };

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Ref Test Component</h3>
      
      <div className="mb-4 space-y-2">
        <div>Ref Status: <span className="font-mono">{refStatus}</span></div>
        <div>Dimensions: <span className="font-mono">{dimensions}</span></div>
        <button 
          onClick={checkRef}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          Check Ref Manually
        </button>
      </div>

      <div 
        ref={handleRef}
        className="w-full bg-gray-100 border-2 border-dashed border-gray-400 rounded p-4"
        style={{ height: '200px' }}
      >
        <div className="text-center text-gray-600">
          <div>Test Container</div>
          <div className="text-sm mt-2">This should trigger the ref callback</div>
          <div className="text-xs mt-2 font-mono">
            Current status: {refStatus}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        This component tests if React refs work properly in your setup.
        Check the console for ref callback messages.
      </div>
    </div>
  );
};

export default RefTestComponent;