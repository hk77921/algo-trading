import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import axios from 'axios';

const Orders = () => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    quantity: '',
    side: 'BUY',
    order_type: 'MARKET',
    price: '',
    trigger_price: '',
    product: 'MIS'
  });
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setRefreshing(true);
      setError('');
      const response = await axios.get('/api/orders/history');
      const orders = response.data.orders || [];
      setOrders(orders);
      if (orders.length === 0) {
        setError('No orders found');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.detail || 'Failed to fetch orders. Please try again.');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchOrders();
  };

  const handleOrderFormChange = (e) => {
    const { name, value } = e.target;
    setOrderForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setOrderLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/orders/place', {
        ...orderForm,
        quantity: parseInt(orderForm.quantity),
        price: orderForm.price ? parseFloat(orderForm.price) : undefined,
        trigger_price: orderForm.trigger_price ? parseFloat(orderForm.trigger_price) : undefined
      });

      if (response.data.status === 'success') {
        setShowOrderModal(false);
        setOrderForm({
          symbol: '',
          quantity: '',
          side: 'BUY',
          order_type: 'MARKET',
          price: '',
          trigger_price: '',
          product: 'MIS'
        });
        fetchOrders();
      } else {
        setError(response.data.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      setError(error.response?.data?.detail || 'Failed to place order. Please try again.');
    } finally {
      setOrderLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-success-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-warning-600" />;
      case 'CANCELLED':
        return <XCircle className="h-5 w-5 text-danger-600" />;
      case 'REJECTED':
        return <AlertCircle className="h-5 w-5 text-danger-600" />;
      case 'PARTIALLY_FILLED':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-success-100 text-success-800';
      case 'PENDING':
        return 'bg-warning-100 text-warning-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'REJECTED':
        return 'bg-danger-100 text-danger-800';
      case 'PARTIALLY_FILLED':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'ALL') return true;
    return order.status?.toUpperCase() === filter;
  });

  const getOrderStats = () => {
    const total = orders.length;
    const completed = orders.filter(o => o.status?.toUpperCase() === 'COMPLETED').length;
    const pending = orders.filter(o => o.status?.toUpperCase() === 'PENDING').length;
    const failed = orders.filter(o => 
      o.status?.toUpperCase() === 'REJECTED' || 
      o.status?.toUpperCase() === 'CANCELLED'
    ).length;
    const partiallyFilled = orders.filter(o => o.status?.toUpperCase() === 'PARTIALLY_FILLED').length;

    return { total, completed, pending, failed, partiallyFilled };
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = getOrderStats();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-2">View your order history and status</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Order Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600">Total Orders</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-success-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-warning-600">{stats.pending}</p>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.partiallyFilled}</p>
            <p className="text-sm text-gray-600">Partially Filled</p>
          </div>
        </div>
        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-danger-600">{stats.failed}</p>
            <p className="text-sm text-gray-600">Failed</p>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Order History
          </h3>
          
          <div className="flex space-x-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field"
            >
              <option value="ALL">All Orders</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_FILLED">Partially Filled</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No orders found</p>
            <p className="text-sm text-gray-500">
              {filter === 'ALL' ? 'Start trading to see your orders here' : `No ${filter.toLowerCase().replace('_', ' ')} orders`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Side
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.order_id || `ORDER_${index + 1}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.order_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.quantity ? order.quantity.toLocaleString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.side === 'BUY' 
                          ? 'bg-success-100 text-success-800' 
                          : 'bg-danger-100 text-danger-800'
                      }`}>
                        {order.side}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(order.status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status || 'UNKNOWN'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.timestamp ? new Date(order.timestamp).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-primary" onClick={() => setShowOrderModal(true)}>
            Place New Order
          </button>
          <button className="btn-secondary">
            Export Orders
          </button>
          <button className="btn-success">
            View Analytics
          </button>
        </div>
      </div>

      {/* Order Placement Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Place New Order</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-500 hover:text-gray-700">
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Symbol</label>
                <input
                  type="text"
                  name="symbol"
                  value={orderForm.symbol}
                  onChange={handleOrderFormChange}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  value={orderForm.quantity}
                  onChange={handleOrderFormChange}
                  className="input-field"
                  required
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Side</label>
                <select
                  name="side"
                  value={orderForm.side}
                  onChange={handleOrderFormChange}
                  className="input-field"
                  required
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Order Type</label>
                <select
                  name="order_type"
                  value={orderForm.order_type}
                  onChange={handleOrderFormChange}
                  className="input-field"
                  required
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="SL">Stop Loss</option>
                  <option value="SL-M">Stop Loss Market</option>
                </select>
              </div>

              {orderForm.order_type !== 'MARKET' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price</label>
                  <input
                    type="number"
                    name="price"
                    value={orderForm.price}
                    onChange={handleOrderFormChange}
                    className="input-field"
                    required
                    step="0.05"
                    min="0"
                  />
                </div>
              )}

              {(orderForm.order_type === 'SL' || orderForm.order_type === 'SL-M') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Trigger Price</label>
                  <input
                    type="number"
                    name="trigger_price"
                    value={orderForm.trigger_price}
                    onChange={handleOrderFormChange}
                    className="input-field"
                    required
                    step="0.05"
                    min="0"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Product</label>
                <select
                  name="product"
                  value={orderForm.product}
                  onChange={handleOrderFormChange}
                  className="input-field"
                  required
                >
                  <option value="MIS">Intraday (MIS)</option>
                  <option value="CNC">Delivery (CNC)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="btn-secondary"
                  disabled={orderLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={orderLoading}
                >
                  {orderLoading ? (
                    <div className="flex items-center">
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Placing Order...
                    </div>
                  ) : (
                    'Place Order'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
