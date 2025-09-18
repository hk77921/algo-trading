import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Package, Trophy, AlertTriangle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import PortfolioChart from './PortfolioChart';

const Portfolio = () => {
  const { isAuthenticated } = useAuth();
  const [portfolioData, setPortfolioData] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPerformanceData = async () => {
    try {
      const response = await axios.get('/api/portfolio/performance/history');
      if (response.data) {
        setPerformanceData(response.data);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    }
  };

  const fetchPortfolio = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      const response = await axios.get('/api/portfolio');
      if (response.data) {
        setPortfolioData(response.data);
      }
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated()) {
      fetchPortfolio();
      fetchPerformanceData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary-500 mx-auto" />
          <p className="mt-2 text-gray-600">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  const {
    total_pnl = 0,
    total_investment = 0,
    total_quantity = 0,
    winning_positions = 0,
    losing_positions = 0,
    best_performer,
    worst_performer
  } = portfolioData || {};

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Portfolio Overview</h2>
        <button
          onClick={fetchPortfolio}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className={`p-3 rounded-full ${total_pnl >= 0 ? 'bg-success-100' : 'bg-danger-100'}`}>
              {total_pnl >= 0 ? (
                <TrendingUp className="h-6 w-6 text-success-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-danger-600" />
              )}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total P&L</p>
              <p className={`text-2xl font-bold ${total_pnl >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                ₹{Number(total_pnl).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-warning-100">
              <DollarSign className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Investment</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{Number(total_investment).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Quantity</p>
              <p className="text-2xl font-bold text-gray-900">
                {Number(total_quantity).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
        <PortfolioChart performanceData={performanceData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-success-600">{winning_positions}</p>
            <p className="text-sm text-gray-600">Winning Positions</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-danger-600">{losing_positions}</p>
            <p className="text-sm text-gray-600">Losing Positions</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {portfolioData?.portfolio?.length || 0}
            </p>
            <p className="text-sm text-gray-600">Total Positions</p>
          </div>
        </div>
      </div>

      {(best_performer || worst_performer) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {best_performer && (
            <div className="card bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
                Best Performer
              </h3>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-800">{best_performer.symbol}</p>
                <p className="text-lg text-green-600">+₹{Number(best_performer.pnl).toLocaleString()}</p>
              </div>
            </div>
          )}

          {worst_performer && (
            <div className="card bg-gradient-to-r from-red-50 to-red-100 border-red-200">
              <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Worst Performer
              </h3>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-800">{worst_performer.symbol}</p>
                <p className="text-lg text-red-600">₹{Number(worst_performer.pnl).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Positions</h3>
        {portfolioData?.portfolio && portfolioData.portfolio.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P&L
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {portfolioData.portfolio.map((position, index) => (
                  <tr key={`${position.symbol}-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {position.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {position.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ₹{Number(position.entry_price).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ₹{Number(position.current_price).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${position.pnl >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      ₹{Number(position.pnl).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No positions to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;