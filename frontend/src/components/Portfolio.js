import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, DollarSign, Package, Trophy, AlertTriangle, RefreshCw } from 'lucide-react';
import axios from 'axios';

const Portfolio = () => {
  const { isAuthenticated } = useAuth();
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchPortfolio();
    }
  }, [isAuthenticated]);

  const fetchPortfolio = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get('/api/portfolio');
      setPortfolioData(response.data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchPortfolio();
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

  const totalValue = portfolioData?.current_value || 0;
  const totalPnL = portfolioData?.total_pnl || 0;
  const totalInvestment = portfolioData?.total_investment || 0;
  const totalQuantity = portfolioData?.total_quantity || 0;
  const winningPositions = portfolioData?.winning_positions || 0;
  const losingPositions = portfolioData?.losing_positions || 0;
  const bestPerformer = portfolioData?.best_performer;
  const worstPerformer = portfolioData?.worst_performer;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
          <p className="text-gray-600 mt-2">Your current positions and performance</p>
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

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Value</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-success-100">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total P&L</p>
              <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                ₹{totalPnL.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-warning-100">
              <Package className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Investment</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalInvestment.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-success-600">{winningPositions}</p>
            <p className="text-sm text-gray-600">Winning Positions</p>
          </div>
        </div>

        <div className="card">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-danger-600">{losingPositions}</p>
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

      {/* Best & Worst Performers */}
      {(bestPerformer || worstPerformer) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {bestPerformer && (
            <div className="card bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
                Best Performer
              </h3>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-800">{bestPerformer.symbol}</p>
                <p className="text-lg text-green-600">+₹{bestPerformer.pnl.toLocaleString()}</p>
              </div>
            </div>
          )}

          {worstPerformer && (
            <div className="card bg-gradient-to-r from-red-50 to-red-100 border-red-200">
              <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Worst Performer
              </h3>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-800">{worstPerformer.symbol}</p>
                <p className="text-lg text-red-600">₹{worstPerformer.pnl.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portfolio Performance Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Overview</h3>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="h-16 w-16 text-primary-400 mx-auto mb-4" />
            <p className="text-gray-600">Performance chart will be displayed here</p>
            <p className="text-sm text-gray-500">Integration with charting library</p>
          </div>
        </div>
      </div>

      {/* Positions Table */}
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
                    Market Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P&L
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    P&L %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {portfolioData.portfolio.map((position, index) => {
                  const marketValue = position.quantity * position.current_price;
                  const investment = position.quantity * position.entry_price;
                  const pnl = position.pnl;
                  const pnlPercent = ((pnl / investment) * 100);
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{position.symbol}</div>
                        <div className="text-sm text-gray-500">{position.side}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {position.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{position.entry_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{position.current_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{marketValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${pnl >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${pnlPercent >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No positions found</p>
            <p className="text-sm text-gray-500">Start trading to see your positions here</p>
          </div>
        )}
      </div>

      {/* Portfolio Allocation */}
      {portfolioData?.portfolio && portfolioData.portfolio.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Allocation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">By Stock</h4>
              <div className="space-y-3">
                {portfolioData.portfolio.map((position, index) => {
                  const marketValue = position.quantity * position.current_price;
                  const allocation = totalValue > 0 ? (marketValue / totalValue) * 100 : 0;
                  
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{position.symbol}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full" 
                            style={{ width: `${allocation}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900 w-12 text-right">{allocation.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="text-md font-medium text-gray-700 mb-3">Performance Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Return</span>
                  <span className={`text-sm font-medium ${totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {totalPnL >= 0 ? '+' : ''}{((totalPnL / totalInvestment) * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Win Rate</span>
                  <span className="text-sm font-medium text-gray-900">
                    {portfolioData.portfolio.length > 0 ? ((winningPositions / portfolioData.portfolio.length) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg P&L per Position</span>
                  <span className={`text-sm font-medium ${totalPnL >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    ₹{(totalPnL / (portfolioData.portfolio.length || 1)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portfolio;
