// Trading.js - Updated with proper chart integration
import React, { useEffect, useState } from "react";
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, TrendingDown, Search, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';
import WebSocketDebugger from './WebSocketDebugger';
import ChartErrorBoundary from './ChartErrorBoundary';
// import ContainerMountTest from './ContainerMountTest';
// import SimpleTradingChart from './SimpleTradingChart';
// import FixedTradingChart from './FixedTradingChart';
// import RefTestComponent from './RefTestComponent';
//import TradingChart from './TradingChart';
//import BulletproofChart from './BulletproofChart';
import AdvancedTradingChart from './advancedTradingChart'
import AdvancedChart from "./AdvancedChart";

const Trading = () => {
  const { isAuthenticated, sessionToken } = useAuth();

  const [orderForm, setOrderForm] = useState({
    symbol: '',
    quantity: '',
    side: 'BUY',
    order_type: 'MARKET',
    price: ''
  });

  const [selectedSymbol, setSelectedSymbol] = useState('TCS-EQ');
  const [marketData, setMarketData] = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showDebugger, setShowDebugger] = useState(false);


  // Load default market data on mount
  useEffect(() => {
    if (sessionToken) {
      fetchMarketData(selectedSymbol);
    }
  }, [isAuthenticated, sessionToken, selectedSymbol]);

  // Setup axios default headers
  useEffect(() => {
    if (sessionToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;
    }
  }, [sessionToken]);

  const fetchMarketData = async (symbol) => {
    try {
      setRefreshing(true);
      setError('');

      const response = await axios.get(`/api/market/${symbol}`);

      if (response.data.success) {
        setMarketData(response.data.market_data);
      } else {
        setError('Failed to fetch market data');
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to fetch market data';
      setError(errorMsg);

      // Fallback to mock data for demo purposes
      setMarketData({
        symbol: symbol.replace('-EQ', ''),
        last_price: 2500.0,
        change: 50.0,
        change_percent: 2.0,
        volume: 0.0,
        high: 2600.0,
        low: 2450.0,
        open: 2480.0,
        close: 2450.0
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOrderSuccess(false);

    try {
      const orderData = {
        ...orderForm,
        quantity: parseInt(orderForm.quantity),
        price: orderForm.order_type === 'LIMIT' ? parseFloat(orderForm.price) : null,
        symbol: orderForm.symbol.toUpperCase()
      };

      const response = await axios.post('/api/orders', orderData);

      if (response.data.success) {
        setOrderSuccess(true);
        setOrderForm({
          symbol: '',
          quantity: '',
          side: 'BUY',
          order_type: 'MARKET',
          price: ''
        });

        // Refresh market data
        if (orderForm.symbol) {
          fetchMarketData(orderForm.symbol);
        }

        // Clear success message after 5 seconds
        setTimeout(() => setOrderSuccess(false), 5000);
      } else {
        setError(response.data.message || 'Order placement failed');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      setError(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const searchSymbols = async (query) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await axios.get('/api/market/search', {
        params: { q: query }
      });

      if (response.data.success) {
        setSearchResults(response.data.symbols);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Symbol search error:', error);
      setSearchResults([]);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchSymbol(value);

    // Debounce search
    clearTimeout(handleSearchChange.timeout);
    handleSearchChange.timeout = setTimeout(() => {
      searchSymbols(value);
    }, 300);
  };

  const selectSymbol = (symbol) => {
    const displaySymbol = symbol.endsWith('-EQ') ? symbol : `${symbol}-EQ`;
    setSelectedSymbol(displaySymbol);
    setSearchSymbol('');
    setShowSearchResults(false);
    fetchMarketData(displaySymbol);
  };

  const handleRefresh = () => {
    if (selectedSymbol) {
      fetchMarketData(selectedSymbol);
    }
  };

  const quickSymbolSelect = (symbol) => {
    selectSymbol(symbol);
    setOrderForm({ ...orderForm, symbol: symbol });
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
        <p className="text-gray-600 mt-2">Place orders and monitor real-time market data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ShoppingCart className="h-5 w-5 mr-2" />
            Place Order
          </h3>

          <form onSubmit={handleOrderSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol
              </label>
              <input
                type="text"
                name="symbol"
                value={orderForm.symbol}
                onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., RELIANCE, TCS, INFY"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Side
                </label>
                <select
                  name="side"
                  value={orderForm.side}
                  onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Type
                </label>
                <select
                  name="order_type"
                  value={orderForm.order_type}
                  onChange={(e) => setOrderForm({ ...orderForm, order_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MARKET">MARKET</option>
                  <option value="LIMIT">LIMIT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={orderForm.quantity}
                  onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="100"
                  min="1"
                  required
                />
              </div>

              {orderForm.order_type === 'LIMIT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={orderForm.price}
                    onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {error}
              </div>
            )}

            {orderSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
                ✅ Order placed successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${orderForm.side === 'BUY'
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                }`}
            >
              {loading ? 'Placing Order...' : `${orderForm.side} ${orderForm.symbol || 'STOCK'}`}
            </button>
          </form>
        </div>

        {/* Market Data */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Market Data
            </h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              title="Refresh market data"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <div className="flex">
              <input
                type="text"
                value={searchSymbol}
                onChange={handleSearchChange}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search symbols..."
              />
              <button
                type="button"
                onClick={() => selectSymbol(searchSymbol)}
                disabled={!searchSymbol.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => selectSymbol(result.symbol)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{result.symbol}</span>
                      <span className="text-sm text-gray-500">{result.exchange}</span>
                    </div>
                    <div className="text-sm text-gray-600 truncate">{result.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {marketData ? (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-gray-900">{marketData.symbol}</h4>
                <p className="text-3xl font-bold text-gray-900">₹{marketData.last_price?.toLocaleString('en-IN') || 'N/A'}</p>
                <div className={`flex items-center justify-center text-lg font-medium ${(marketData.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {(marketData.change || 0) >= 0 ? (
                    <TrendingUp className="h-5 w-5 mr-1" />
                  ) : (
                    <TrendingDown className="h-5 w-5 mr-1" />
                  )}
                  {(marketData.change || 0) >= 0 ? '+' : ''}{(marketData.change || 0).toFixed(2)} ({(marketData.change_percent || 0).toFixed(2)}%)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Open</p>
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.open || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">High</p>
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.high || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Low</p>
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.low || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Volume</p>
                  <p className="text-lg font-semibold text-gray-900">{(marketData.volume || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Search for a symbol to view market data</p>
            </div>
          )}
        </div>
      </div>

      {/* Trading Chart with WebSocket Integration */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Real-time Price Chart ({selectedSymbol})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDebugger(!showDebugger)}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              {showDebugger ? 'Hide Debugger' : 'Show Debugger'}
            </button>
          </div>
        </div>

        <AdvancedTradingChart symbol={selectedSymbol}
          sessionToken={sessionToken}
          debug="true" />

        {/* <SimpleTradingChart 
  symbol={selectedSymbol} 
  sessionToken={sessionToken} 
/> */}

        {/* <RefTestComponent /> */}


        <AdvancedChart
          symbol={selectedSymbol}
          sessionToken={sessionToken}
          debug="true"
        />

        {/* <FixedTradingChart 
  symbol={selectedSymbol} 
  sessionToken={sessionToken}
  debug={true}
/> */}



        {/* Add this component before your TradingChart */}
        {/* <ContainerMountTest /> */}
        {sessionToken ? (
          <ChartErrorBoundary>
            {/* <TradingChart 
              symbol={selectedSymbol} 
              sessionToken={sessionToken}
              debug={showDebugger}
            />  */}
          </ChartErrorBoundary>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Please login to view real-time charts
          </div>
        )}

        {/* WebSocket Debugger */}
        {showDebugger && sessionToken && (
          <div className="mt-6">
            <WebSocketDebugger
              symbol={selectedSymbol}
              sessionToken={sessionToken}
            />
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['RELIANCE', 'TCS', 'INFY', 'HDFC'].map((symbol) => (
            <button
              key={symbol}
              onClick={() => quickSymbolSelect(symbol)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              View {symbol}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Trading;