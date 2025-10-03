// WebSocketDebugger.js - Enhanced debugging component
import React, { useRef, useEffect, useState, useCallback } from 'react';

const WebSocketDebugger = ({ symbol = "TCS-EQ", sessionToken, debug = true }) => {
  const wsRef = useRef(null);
  const mountedRef = useRef(false);
  const messageCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalMessages: 0,
    connectTime: null,
    lastMessageTime: null,
    reconnectCount: 0
  });


  
  const getWebSocketURL = () => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      //return `${protocol}//${host}`;
       return 'ws://localhost:8000';
    }
    return 'ws://localhost:8000';
  };

  // Add message to debug log
  const addMessage = useCallback((type, data, timestamp = new Date()) => {
    messageCountRef.current += 1;
    
    const message = {
      id: messageCountRef.current,
      type,
      data,
      timestamp: timestamp.toISOString(),
      displayTime: timestamp.toLocaleTimeString()
    };

    setMessages(prev => [...prev.slice(-19), message]); // Keep last 20 messages
    
    setStats(prev => ({
      ...prev,
      totalMessages: messageCountRef.current,
      lastMessageTime: timestamp.toISOString()
    }));
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (!symbol || !sessionToken || !mountedRef.current) {
      addMessage('error', 'Missing required parameters');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      addMessage('info', 'Already connected');
      return;
    }

    try {
      addMessage('info', `Connecting to ${symbol}...`);
      
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      //const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      //const wsUrl = `${protocol}//${window.location.host}:8000/api/market/ws/${encodeURIComponent(symbol)}?token=${sessionToken}&exchange=NSE&feed_type=t`;
      const wsBaseUrl = getWebSocketURL();
      const wsUrl = `${wsBaseUrl}/api/market/ws/${symbol}?token=${sessionToken}&exchange=NSE&feed_type=t`;
      
      addMessage('info', `WebSocket URL: ${wsUrl.replace(sessionToken, '***')}`);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setConnectionStatus('connecting');

      ws.onopen = (event) => {
        const connectTime = new Date();
        setConnectionStatus('connected');
        setError('');
        setStats(prev => ({ ...prev, connectTime: connectTime.toISOString() }));
        addMessage('success', 'WebSocket connected successfully', connectTime);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addMessage('message', {
            symbol: data.symbol,
            last_price: data.data?.last_price,
            volume: data.data?.volume,
            timestamp: data.timestamp,
            feed_type: data.feed_type,
            raw: data
          });
        } catch (err) {
          addMessage('error', `Failed to parse message: ${err.message}`, new Date());
        }
      };

      ws.onerror = (error) => {
        setConnectionStatus('error');
        setError('WebSocket connection error');
        addMessage('error', 'WebSocket error occurred');
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        
        const reason = event.code === 1000 ? 'Normal closure' : 
                      event.code === 1006 ? 'Connection lost' :
                      event.reason || `Code: ${event.code}`;
        
        addMessage('warning', `Connection closed: ${reason}`);
        
        // Auto-reconnect for abnormal closures
        if (mountedRef.current && event.code !== 1000) {
          setStats(prev => ({ ...prev, reconnectCount: prev.reconnectCount + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              addMessage('info', 'Attempting to reconnect...');
              connectWebSocket();
            }
          }, 3000);
        }
      };

    } catch (error) {
      setConnectionStatus('error');
      setError(`Connection failed: ${error.message}`);
      addMessage('error', `Connection failed: ${error.message}`);
    }
  }, [symbol, sessionToken, addMessage]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnectionStatus('disconnected');
    addMessage('info', 'Manually disconnected');
  }, [addMessage]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageCountRef.current = 0;
    setStats(prev => ({ ...prev, totalMessages: 0 }));
  }, []);

  // Test connection
  const testConnection = useCallback(async () => {
    try {
      addMessage('info', 'Testing connection parameters...');
      
      // Test if session token works
      const response = await fetch(`/api/market/${symbol}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      
      if (response.ok) {
        addMessage('success', 'Session token and symbol are valid');
      } else {
        addMessage('error', `API test failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      addMessage('error', `Connection test failed: ${error.message}`);
    }
  }, [symbol, sessionToken, addMessage]);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Auto-connect when symbol or token changes
  useEffect(() => {
    if (symbol && sessionToken && mountedRef.current) {
      connectWebSocket();
    }
  }, [symbol, sessionToken, connectWebSocket]);

  // Get status color
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-50 border-green-200';
      case 'connecting': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getMessageTypeStyle = (type) => {
    switch (type) {
      case 'success': return 'text-green-700 bg-green-50';
      case 'error': return 'text-red-700 bg-red-50';
      case 'warning': return 'text-yellow-700 bg-yellow-50';
      case 'message': return 'text-blue-700 bg-blue-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="w-full border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">WebSocket Debugger</h3>
        <div className="flex gap-2">
          <button
            onClick={testConnection}
            className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
          >
            Test Connection
          </button>
          <button
            onClick={clearMessages}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Clear Log
          </button>
          {connectionStatus === 'connected' ? (
            <button
              onClick={disconnectWebSocket}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={connectWebSocket}
              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Status Panel */}
      <div className={`p-3 rounded-lg border mb-4 ${getStatusColor()}`}>
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold capitalize">Status: {connectionStatus}</div>
            <div className="text-sm">Symbol: {symbol} | Token: {sessionToken ? '✅' : '❌'}</div>
          </div>
          <div className="text-right text-sm">
            <div>Messages: {stats.totalMessages}</div>
            <div>Reconnects: {stats.reconnectCount}</div>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm font-medium">{error}</div>
        )}
      </div>

      {/* Connection Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-semibold">{stats.totalMessages}</div>
          <div className="text-xs text-gray-600">Total Messages</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-semibold">{stats.reconnectCount}</div>
          <div className="text-xs text-gray-600">Reconnects</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-semibold">
            {stats.connectTime ? new Date(stats.connectTime).toLocaleTimeString() : '-'}
          </div>
          <div className="text-xs text-gray-600">Connected At</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-semibold">
            {stats.lastMessageTime ? new Date(stats.lastMessageTime).toLocaleTimeString() : '-'}
          </div>
          <div className="text-xs text-gray-600">Last Message</div>
        </div>
      </div>

      {/* Message Log */}
      <div className="h-64 border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-3 py-2 border-b">
          <div className="flex justify-between items-center">
            <span className="font-medium">Message Log</span>
            <span className="text-sm text-gray-600">{messages.length} messages</span>
          </div>
        </div>
        <div className="h-full overflow-y-auto p-2 space-y-1">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages yet. Connect to start receiving data.
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`p-2 rounded text-sm ${getMessageTypeStyle(message.type)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{message.type}</div>
                    <div className="mt-1">
                      {typeof message.data === 'string' ? (
                        message.data
                      ) : message.type === 'message' ? (
                        <div>
                          <div>Price: ₹{message.data.last_price} | Vol: {message.data.volume}</div>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs">Raw Data</summary>
                            <pre className="text-xs mt-1 bg-white p-1 rounded">
                              {JSON.stringify(message.data.raw, null, 2)}
                            </pre>
                          </details>
                        </div>
                      ) : (
                        <pre className="text-xs">{JSON.stringify(message.data, null, 2)}</pre>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-2">
                    {message.displayTime}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Connection Instructions */}
      <div className="mt-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
        <div className="font-medium mb-1">Debug Information:</div>
        <div>• WebSocket connects to: <code>ws://localhost:8000/api/market/ws/{symbol}</code></div>
        <div>• Authentication via query parameter: <code>?token={sessionToken}</code></div>
        <div>• Feed type: Touchline (t) for real-time price updates</div>
        <div>• Auto-reconnects on connection loss with 3-second delay</div>
      </div>
    </div>
  );
};

export default WebSocketDebugger;