import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, TrendingDown, Search, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';

const Trading = () => {
  const { isAuthenticated } = useAuth();
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    quantity: '',
    side: 'BUY',
    order_type: 'MARKET',
    price: ''
  });
  const [marketData, setMarketData] = useState(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      // Load default market data
      fetchMarketData('RELIANCE');
    }
  }, [isAuthenticated]);

  const fetchMarketData = async (symbol) => {
    try {
      setRefreshing(true);
      setError('');
      const response = await axios.get(`/api/market-data/${symbol}`);
      if (response.data.success) {
        setMarketData(response.data.market_data);
      } else {
        setError('Failed to fetch market data');
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      setError(error.response?.data?.detail || 'Failed to fetch market data');
      // Fallback to mock data if API fails
      setMarketData({
        symbol: symbol,
        last_price: 2500.0,
        change: 50.0,
        change_percent: 2.0,
        volume: 1000000,
        high: 2600.0,
        low: 2500.0,
        open: 2500.0
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
        price: orderForm.order_type === 'LIMIT' ? parseFloat(orderForm.price) : null
      };

      const response = await axios.post('/api/order', orderData);
      
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
      } else {
        setError('Order placement failed');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchSymbol.trim()) {
      fetchMarketData(searchSymbol.toUpperCase());
    }
  };

  const handleRefresh = () => {
    if (marketData?.symbol) {
      fetchMarketData(marketData.symbol);
    }
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trading</h1>
        <p className="text-gray-600 mt-2">Place orders and monitor market data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Form */}
        <div className="card">
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
                onChange={(e) => setOrderForm({...orderForm, symbol: e.target.value.toUpperCase()})}
                className="input-field"
                placeholder="e.g., RELIANCE"
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
                  onChange={(e) => setOrderForm({...orderForm, side: e.target.value})}
                  className="input-field"
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
                  onChange={(e) => setOrderForm({...orderForm, order_type: e.target.value})}
                  className="input-field"
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
                  onChange={(e) => setOrderForm({...orderForm, quantity: e.target.value})}
                  className="input-field"
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
                    onChange={(e) => setOrderForm({...orderForm, price: e.target.value})}
                    className="input-field"
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
                Order placed successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                orderForm.side === 'BUY' ? 'bg-success-600 hover:bg-success-700' : 'bg-danger-600 hover:bg-danger-700'
              }`}
            >
              {loading ? 'Placing Order...' : `${orderForm.side} ${orderForm.symbol || 'STOCK'}`}
            </button>
          </form>
        </div>

        {/* Market Data */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Market Data
            </h3>
            {marketData && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                title="Refresh market data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex">
              <input
                type="text"
                value={searchSymbol}
                onChange={(e) => setSearchSymbol(e.target.value)}
                className="input-field rounded-r-none"
                placeholder="Search symbol..."
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-r-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          {marketData ? (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-gray-900">{marketData.symbol}</h4>
                <p className="text-3xl font-bold text-gray-900">₹{marketData.last_price?.toLocaleString() || 'N/A'}</p>
                <div className={`flex items-center justify-center text-lg font-medium ${
                  (marketData.change || 0) >= 0 ? 'text-success-600' : 'text-danger-600'
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
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.open || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">High</p>
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.high || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Low</p>
                  <p className="text-lg font-semibold text-gray-900">₹{(marketData.low || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Volume</p>
                  <p className="text-lg font-semibold text-gray-900">{(marketData.volume || 0).toLocaleString()}</p>
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

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button 
            onClick={() => setOrderForm({...orderForm, symbol: 'RELIANCE', side: 'BUY'})}
            className="btn-primary"
          >
            Buy RELIANCE
          </button>
          <button 
            onClick={() => setOrderForm({...orderForm, symbol: 'TCS', side: 'BUY'})}
            className="btn-primary"
          >
            Buy TCS
          </button>
          <button 
            onClick={() => setOrderForm({...orderForm, symbol: 'INFY', side: 'BUY'})}
            className="btn-primary"
          >
            Buy INFY
          </button>
          <button 
            onClick={() => setOrderForm({...orderForm, symbol: 'HDFC', side: 'BUY'})}
            className="btn-primary"
          >
            Buy HDFC
          </button>
        </div>
      </div>
    </div>
  );
};

export default Trading;
