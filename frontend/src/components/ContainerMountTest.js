// ContainerMountTest.js - Debug container mounting issues
import React, { useRef, useEffect, useState, useCallback } from 'react';

const ContainerMountTest = () => {
  const containerRef = useRef(null);
  const [mountStatus, setMountStatus] = useState({
    refSet: false,
    hasElement: false,
    hasDimensions: false,
    width: 0,
    height: 0,
    clientRect: null,
    offsetParent: null,
    isVisible: false
  });

  const checkContainer = useCallback(() => {
    const element = containerRef.current;
    
    if (element) {
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      setMountStatus({
        refSet: true,
        hasElement: true,
        hasDimensions: element.clientWidth > 0 && element.clientHeight > 0,
        width: element.clientWidth,
        height: element.clientHeight,
        clientRect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        },
        offsetParent: !!element.offsetParent,
        isVisible: computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
        display: computedStyle.display,
        position: computedStyle.position
      });
    } else {
      setMountStatus(prev => ({
        ...prev,
        refSet: false,
        hasElement: false
      }));
    }
  }, []);

  const handleRef = useCallback((element) => {
    containerRef.current = element;
    console.log('📍 Ref callback called with:', element);
    
    if (element) {
      // Check immediately
      checkContainer();
      
      // Check after RAF
      requestAnimationFrame(() => {
        checkContainer();
      });
      
      // Check after timeout
      setTimeout(() => {
        checkContainer();
      }, 100);
    }
  }, [checkContainer]);

  useEffect(() => {
    // Check periodically for the first few seconds
    const interval = setInterval(checkContainer, 500);
    
    // Stop checking after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkContainer]);

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Container Mount Test</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className={`p-3 rounded ${mountStatus.refSet ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="font-medium">Ref Set</div>
          <div>{mountStatus.refSet ? '✅' : '❌'}</div>
        </div>
        
        <div className={`p-3 rounded ${mountStatus.hasElement ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="font-medium">Has Element</div>
          <div>{mountStatus.hasElement ? '✅' : '❌'}</div>
        </div>
        
        <div className={`p-3 rounded ${mountStatus.hasDimensions ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
          <div className="font-medium">Has Dimensions</div>
          <div>{mountStatus.hasDimensions ? '✅' : '⏳'}</div>
        </div>
        
        <div className="p-3 rounded bg-blue-50 text-blue-800">
          <div className="font-medium">Width</div>
          <div>{mountStatus.width}px</div>
        </div>
        
        <div className="p-3 rounded bg-blue-50 text-blue-800">
          <div className="font-medium">Height</div>
          <div>{mountStatus.height}px</div>
        </div>
        
        <div className={`p-3 rounded ${mountStatus.isVisible ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="font-medium">Visible</div>
          <div>{mountStatus.isVisible ? '✅' : '❌'}</div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Detailed Info:</h4>
        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
          {JSON.stringify(mountStatus, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <button
          onClick={checkContainer}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Recheck Container
        </button>
      </div>

      {/* Test Container */}
      <div className="border-2 border-dashed border-gray-300 p-4">
        <h4 className="font-medium mb-2">Test Container:</h4>
        <div
          ref={handleRef}
          className="w-full bg-gray-50 border border-gray-300 rounded"
          style={{ 
            height: '400px',
            minHeight: '400px',
            minWidth: '300px'
          }}
        >
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <div className="text-center">
              <div className="text-2xl mb-2">📊</div>
              <div>Test Chart Container</div>
              <div className="text-sm mt-2">
                {mountStatus.width}×{mountStatus.height}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainerMountTest;