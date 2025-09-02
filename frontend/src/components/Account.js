import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { User, Mail, Phone, CreditCard, Package, RefreshCw, Building, Calendar, ShoppingBag, ListOrdered, BarChart } from 'lucide-react';
import axios from 'axios';

const Account = () => {
  const { isAuthenticated } = useAuth();
  const [accountData, setAccountData] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) {
      fetchAccountData();
    }
  }, [isAuthenticated]);

  const fetchAccountData = async () => {
    try {
      setRefreshing(true);
      setError('');
      
      const [userDetailsRes, ordersRes, tradesRes,holdingsRes] = await Promise.all([
        axios.get('/api/account/user-details'),
        axios.get('/api/account/orders'),
        axios.get('/api/account/trades')
        //axios.get('/api/account/holdings'),
       
      
      ]);

      if (userDetailsRes.data) {
        console.log(userDetailsRes.data);
        setAccountData(userDetailsRes.data);
      }
      
      if (holdingsRes.data) {
        setHoldings(holdingsRes.data.data || []);
      }
      
      if (ordersRes.data) {
        setOrders(ordersRes.data.orders || []);
      }
      
      if (tradesRes.data) {
        setTrades(tradesRes.data.data || []);
      }

    } catch (error) {
      console.error('Error fetching account data:', error);
      setError(error.response?.data?.detail || 'Failed to fetch account data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchAccountData();
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

  const account = accountData?.account || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Account</h1>
          <p className="text-gray-600 mt-2">Your account details and holdings</p>
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

      {/* Account Information */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="h-5 w-5 mr-2" />
          Account Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-primary-100">
                <Building className="h-4 w-4 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Client ID</p>
                <p className="font-medium text-gray-900">{account.user_id || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-success-100">
                <User className="h-4 w-4 text-success-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium text-gray-900">{account.name || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-warning-100">
                <Mail className="h-4 w-4 text-warning-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{account.email || 'N/A'}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-blue-100">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Mobile</p>
                <p className="font-medium text-gray-900">{account.m_num || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-purple-100">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">PAN</p>
                <p className="font-medium text-gray-900">{account.pan || 'N/A'}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-gray-100">
                <Calendar className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Account Type</p>
                <p className="font-medium text-gray-900">{account.account_type || 'Trading'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Access */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Trading Access
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Available Exchanges</h4>
            <div className="flex flex-wrap gap-2">
              {account.exchanges?.map((exchange, index) => (
                <span key={index} className="px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-sm">
                  {exchange}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-3">Order Types</h4>
            <div className="flex flex-wrap gap-2">
              {account.order_types?.map((type, index) => (
                <span key={index} className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Available Products
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available On
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {account.products?.map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">{product.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {product.exchanges?.map((exchange, idx) => (
                        <span key={idx} className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-800">
                          {exchange}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holdings */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ShoppingBag className="h-5 w-5 mr-2" />
          Holdings
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {holdings.map((holding, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{holding.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{holding.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{holding.avgPrice}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{holding.currentValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ListOrdered className="h-5 w-5 mr-2" />
          Recent Orders
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            
              {orders.map((order, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.order_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.side}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.order_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trades */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart className="h-5 w-5 mr-2" />
          Recent Trades
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trade ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trades.map((trade, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{trade.tradeid}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.trantype}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-primary">
            Update Profile
          </button>
          <button className="btn-secondary">
            Download Statement
          </button>
          <button className="btn-success">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default Account;
