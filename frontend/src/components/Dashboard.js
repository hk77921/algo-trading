import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { TrendingUp, TrendingDown,  Activity, ArrowUpRight, ArrowDownRight, RefreshCw, Trophy, AlertTriangle, Wifi, WifiOff, IndianRupee } from 'lucide-react';
import axios from 'axios';
import HoldingsChart from './HoldingsChart';
import PnLChart from './PnLChart';

const Dashboard = () => {
  const { isAuthenticated } = useAuth();
  const [portfolioData, setPortfolioData] = useState(null);
  const [ordersData, setOrdersData] = useState(null);
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchDashboardData();
      checkApiStatus();
    }
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const [portfolioRes, ordersRes] = await Promise.all([
        axios.get('/api/portfolio'),
        axios.get('/api/orders/history')
      ]);

      setPortfolioData(portfolioRes.data);
      setOrdersData(ordersRes.data);
      
      // Fetch real market data for popular stocks
      const popularStocks = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'];
      const marketDataPromises = popularStocks.map(symbol => 
        axios.get(`/api/market/SearchScrip/${symbol}`)
      );
      
      const marketResponses = await Promise.all(marketDataPromises);
      const realMarketData = marketResponses.map((response, index) => {
        const data = response.data;
        return {
          symbol: popularStocks[index],
          price: data.ltp || 0,
          change: data.change_perc || 0,
          volume: data.volume || 0
        };
      });
      setMarketData(realMarketData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkApiStatus = async () => {
    try {
      const response = await axios.get('/api/health');
      setApiStatus(response.data);
    } catch (error) {
      console.error('Error checking API status:', error);
      setApiStatus({ status: 'error', message: 'Failed to check API status' });
    }
  };

  const handleRefresh = () => {
    fetchDashboardData();
    checkApiStatus();
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

  const totalPnL = portfolioData?.total_pnl || 0;
  const totalInvestment = portfolioData?.total_investment || 0;
  const currentValue = portfolioData?.current_value || 0;
  const totalQuantity = portfolioData?.total_quantity || 0;
  const winningPositions = portfolioData?.winning_positions || 0;
  const losingPositions = portfolioData?.losing_positions || 0;
  const bestPerformer = portfolioData?.best_performer;
  const worstPerformer = portfolioData?.worst_performer;
  const isPositive = totalPnL >= 0;
  const totalReturn = totalInvestment > 0 ? ((totalPnL / totalInvestment) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome to your trading dashboard</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-primary-100">
              <IndianRupee className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total P&L</p>
              <p className={`text-2xl font-bold ${isPositive ? 'text-success-600' : 'text-danger-600'}`}>
                {totalPnL.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            {isPositive ? (
              <ArrowUpRight className="h-4 w-4 text-success-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-danger-600" />
            )}
            <span className={`text-sm ml-1 ${isPositive ? 'text-success-600' : 'text-danger-600'}`}>
              {isPositive ? '+' : ''}{totalReturn.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-success-100">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Value</p>
              <p className="text-2xl font-bold text-gray-900">₹{currentValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-warning-100">
              <Activity className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Investment</p>
              <p className="text-2xl font-bold text-gray-900">₹{totalInvestment.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 rounded-full bg-blue-100">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Quantity</p>
              <p className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Status */}
      {apiStatus && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            {apiStatus.status === 'connected' ? (
              <Wifi className="h-5 w-5 mr-2 text-success-600" />
            ) : (
              <WifiOff className="h-5 w-5 mr-2 text-danger-600" />
            )}
            Flattrade API Status
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${
                apiStatus.status === 'connected' ? 'text-success-600' : 
                apiStatus.status === 'unconfigured' ? 'text-warning-600' : 'text-danger-600'
              }`}>
                {apiStatus.status === 'connected' ? 'Connected' : 
                 apiStatus.status === 'unconfigured' ? 'Not Configured' : 'Connection Error'}
              </p>
              <p className="text-sm text-gray-600">{apiStatus.message}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                apiStatus.status === 'connected' ? 'bg-success-100 text-success-800' : 
                apiStatus.status === 'unconfigured' ? 'bg-warning-100 text-warning-800' : 'bg-danger-100 text-danger-800'
              }`}>
                {apiStatus.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Overview */}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Holdings Distribution</h3>
          <HoldingsChart portfolio={portfolioData?.portfolio || []} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">P&L Distribution</h3>
          <PnLChart portfolio={portfolioData?.portfolio || []} />
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

      {/* Market Watch Section will follow */}

      {/* Market Watch */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Watch</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {marketData.map((stock, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="font-medium text-gray-900">{stock.symbol}</p>
                <p className="text-lg font-bold text-gray-900">₹{stock.price.toFixed(2)}</p>
                <p className={`text-sm ${stock.change >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Vol: {stock.volume.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn-primary">
            Place New Order
          </button>
          <button className="btn-secondary">
            View Portfolio
          </button>
          <button className="btn-success">
            Market Analysis
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
