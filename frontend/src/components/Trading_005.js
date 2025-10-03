import React, { useRef, useEffect, useState } from "react";
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShoppingCart, TrendingUp, TrendingDown, Search, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { createChart } from 'lightweight-charts';
import TradingChart from './TradingChart';
import { WS_BASE_URL } from '../config';

const Trading = ({ symbol: propSymbol = "TCS-EQ" }) => {
  const chartContainerRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const wsRef = useRef(null);

  const { isAuthenticated, sessionToken, user } = useAuth();
  const [orderForm, setOrderForm] = useState({
    symbol: propSymbol,
    side: 'buy',
    quantity: 1,
    price: ''
  });
  const [selectedSymbol, setSelectedSymbol] = useState(propSymbol);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [marketData, setMarketData] = useState(null);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Fetch market data
  useEffect(() => {
    if (!selectedSymbol) return;
    const fetchMarketData = async () => {
      try {
        const response = await axios.get(
          `/api/market-data/${selectedSymbol}`,
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
        setMarketData(response.data);
      } catch (error) {
        console.error("Error fetching market data:", error);
      }
    };
    fetchMarketData();
  }, [selectedSymbol, sessionToken]);

  // WebSocket subscription
  useEffect(() => {
    if (!selectedSymbol || !sessionToken) return;
    const wsUrl = `${WS_BASE_URL}/api/market/ws/${selectedSymbol}?token=${sessionToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log(`[ws] Connected to ${wsUrl}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMarketData((prev) => ({ ...prev, ...data }));
      } catch (e) {
        console.error("Error parsing WS data:", e);
      }
    };
    ws.onclose = () => console.log(`[ws] Disconnected from ${wsUrl}`);

    wsRef.current = ws;
    return () => ws.close();
  }, [selectedSymbol, sessionToken]);

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/orders', orderForm, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      alert("Order placed successfully!");
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Order failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Trading Dashboard</h1>

      {/* Symbol Search */}
      <div className="flex space-x-2">
        <input
          type="text"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          placeholder="Search symbol..."
          className="border rounded px-3 py-2 w-64"
        />
        <button
          onClick={() => setSelectedSymbol(searchSymbol)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          <Search className="inline-block w-4 h-4 mr-1" />
          Search
        </button>
      </div>

      {/* Market Data */}
      {marketData && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Market Data
            </h3>
            <p>Symbol: {marketData.symbol}</p>
            <p>Last Price: {marketData.last_price}</p>
            <p>Volume: {marketData.volume}</p>
          </div>

          {/* Price Chart */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="h-5 w-5 mr-2 inline-block" />
              Price Chart
            </h3>
            <TradingChart
              symbol={marketData?.symbol || selectedSymbol}
              sessionToken={sessionToken}
              debug={false}
            />
          </div>
        </div>
      )}

      {/* Order Form */}
      <form onSubmit={handleOrderSubmit} className="card space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ShoppingCart className="h-5 w-5 mr-2" />
          Place Order
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700">Side</label>
          <select
            value={orderForm.side}
            onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value })}
            className="mt-1 block w-full border rounded px-3 py-2"
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Quantity</label>
          <input
            type="number"
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Price</label>
          <input
            type="number"
            value={orderForm.price}
            onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Submit Order
        </button>
      </form>
    </div>
  );
};

export default Trading;
