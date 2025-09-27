// WebSocket Connection Debugger Component
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

const WebSocketDebugger = ({ symbol, sessionToken }) => {
  const [connectionTests, setConnectionTests] = useState({
    configCheck: 'pending',
    tokenValidation: 'pending',
    websocketConnection: 'pending',
    messageReceived: 'pending'
  });
  
  const [debugInfo, setDebugInfo] = useState({});
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), { timestamp, message, type }]);
  };

  const getWebSocketURL = () => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      //return `${protocol}//${host}`;
       return 'ws://localhost:8000';
    }
    return 'ws://localhost:8000';
  };

  const testWebSocketConnection = async () => {
    // Reset states
    setConnectionTests({
      configCheck: 'pending',
      tokenValidation: 'pending',
      websocketConnection: 'pending',
      messageReceived: 'pending'
    });

    try {
      // 1. Config Check
      addLog('Starting WebSocket connection tests...', 'info');
      const wsBaseUrl = getWebSocketURL();
      setDebugInfo(prev => ({ ...prev, wsBaseUrl }));
      
      if (!wsBaseUrl) {
        setConnectionTests(prev => ({ ...prev, configCheck: 'failed' }));
        addLog('Config check failed: No WebSocket URL found', 'error');
        return;
      }
      
      setConnectionTests(prev => ({ ...prev, configCheck: 'success' }));
      addLog(`Config check passed: ${wsBaseUrl}`, 'success');

      // 2. Token Validation
      if (!sessionToken || sessionToken.length < 32) {
        setConnectionTests(prev => ({ ...prev, tokenValidation: 'failed' }));
        addLog('Token validation failed: Invalid or missing token', 'error');
        return;
      }
      
      setConnectionTests(prev => ({ ...prev, tokenValidation: 'success' }));
      addLog('Token validation passed', 'success');

      // 3. WebSocket Connection Test
      const wsUrl = `${wsBaseUrl}/api/market/ws/${symbol}?token=${sessionToken}&exchange=NSE&feed_type=t`;
      addLog(`Attempting WebSocket connection to: ${wsUrl.replace(sessionToken, '***')}`, 'info');
      
      const ws = new WebSocket(wsUrl);
      let messageReceived = false;
      
      const timeout = setTimeout(() => {
        if (!messageReceived) {
          ws.close();
          setConnectionTests(prev => ({ ...prev, messageReceived: 'failed' }));
          addLog('Message timeout: No data received within 10 seconds', 'warning');
        }
      }, 10000);

      ws.onopen = () => {
        setConnectionTests(prev => ({ ...prev, websocketConnection: 'success' }));
        addLog('WebSocket connection established successfully', 'success');
      };

      ws.onmessage = (event) => {
        if (!messageReceived) {
          messageReceived = true;
          clearTimeout(timeout);
          setConnectionTests(prev => ({ ...prev, messageReceived: 'success' }));
          addLog(`First message received: ${event.data.substring(0, 100)}...`, 'success');
          ws.close();
        }
      };

      ws.onerror = (error) => {
        setConnectionTests(prev => ({ 
          ...prev, 
          websocketConnection: 'failed',
          messageReceived: 'failed'
        }));
        addLog(`WebSocket error: ${error.message || 'Unknown error'}`, 'error');
        clearTimeout(timeout);
      };

      ws.onclose = (event) => {
        const reason = event.reason || 'No reason provided';
        const code = event.code;
        addLog(`WebSocket closed: Code ${code}, Reason: ${reason}`, 'info');
        clearTimeout(timeout);
      };

    } catch (error) {
      addLog(`Test failed with exception: ${error.message}`, 'error');
      setConnectionTests(prev => ({
        ...prev,
        websocketConnection: 'failed',
        messageReceived: 'failed'
      }));
    }
  };

  useEffect(() => {
    if (symbol && sessionToken) {
      testWebSocketConnection();
    }
  }, [symbol, sessionToken]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'success':
        return 'Passed';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Testing...';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          WebSocket Connection Debugger
        </h3>
        <button
          onClick={testWebSocketConnection}
          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
        >
          Retest
        </button>
      </div>

      {/* Connection Tests */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Configuration Check</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionTests.configCheck)}
            <span className="text-sm">{getStatusText(connectionTests.configCheck)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Token Validation</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionTests.tokenValidation)}
            <span className="text-sm">{getStatusText(connectionTests.tokenValidation)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">WebSocket Connection</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionTests.websocketConnection)}
            <span className="text-sm">{getStatusText(connectionTests.websocketConnection)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Data Reception</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon(connectionTests.messageReceived)}
            <span className="text-sm">{getStatusText(connectionTests.messageReceived)}</span>
          </div>
        </div>
      </div>

      {/* Debug Info */}
      {Object.keys(debugInfo).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Information</h4>
          <div className="bg-gray-50 p-2 rounded text-xs font-mono">
            <div>WebSocket URL: {debugInfo.wsBaseUrl}</div>
            <div>Symbol: {symbol}</div>
            <div>Token: {sessionToken ? `${sessionToken.substring(0, 8)}...` : 'Not provided'}</div>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Connection Logs</h4>
          <div className="bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-xs font-mono mb-1">
                <span className="text-gray-500">[{log.timestamp}]</span>
                <span className={`ml-2 ${
                  log.type === 'error' ? 'text-red-600' :
                  log.type === 'success' ? 'text-green-600' :
                  log.type === 'warning' ? 'text-yellow-600' : 'text-gray-700'
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSocketDebugger;