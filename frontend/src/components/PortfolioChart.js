import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          size: 12
        }
      }
    },
    title: {
      display: true,
      text: 'Portfolio Performance',
      font: {
        size: 16,
        weight: 'bold'
      },
      padding: {
        top: 10,
        bottom: 20
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ₹';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
          }
          return label;
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        maxRotation: 45,
        minRotation: 45
      }
    },
    y: {
      beginAtZero: false,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      },
      ticks: {
        callback: function(value) {
          return '₹' + value.toLocaleString('en-IN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });
        }
      }
    }
  },
  interaction: {
    mode: 'index',
    intersect: false
  },
};

const PortfolioChart = ({ performanceData }) => {
  if (!performanceData || performanceData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 text-primary-400 mx-auto mb-4">📈</div>
          <p className="text-gray-600">No performance data available</p>
        </div>
      </div>
    );
  }

  // Format the date in a more readable way
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate percent changes
  const calculatePercentChange = (current, previous) => {
    return previous ? ((current - previous) / Math.abs(previous) * 100) : 0;
  };

  const chartData = {
    labels: performanceData.map(d => formatDate(d.timestamp)),
    datasets: [
      {
        label: 'Portfolio Value',
        data: performanceData.map(d => d.total_value),
        borderColor: 'rgb(45, 152, 218)',
        backgroundColor: 'rgba(45, 152, 218, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgb(45, 152, 218)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        order: 2
      },
      {
        label: 'Total P&L',
        data: performanceData.map(d => d.total_pnl),
        borderColor: (context) => {
          const value = context.raw;
          return value >= 0 ? 'rgb(46, 204, 113)' : 'rgb(231, 76, 60)';
        },
        backgroundColor: (context) => {
          const value = context.raw;
          return value >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';
        },
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0,
        pointHoverRadius: 5,
        order: 1
      },
      {
        label: 'Daily P&L',
        data: performanceData.map(d => d.day_pnl),
        borderColor: 'rgb(155, 89, 182)',
        borderWidth: 1.5,
        borderDash: [5, 5],
        tension: 0.2,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
        order: 3
      }
    ]
  };

  // Calculate key metrics
  const latestData = performanceData[performanceData.length - 1];
  const previousData = performanceData[performanceData.length - 2];
  
  const valueChange = previousData ? (latestData.total_value - previousData.total_value) : 0;
  const valueChangePercent = calculatePercentChange(latestData.total_value, previousData?.total_value);
  
  return (
    <div className="h-96 flex flex-col">
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h3 className="text-lg font-semibold">
            ₹{latestData.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h3>
          <div className={`text-sm ${valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {valueChange >= 0 ? '▲' : '▼'} ₹{Math.abs(valueChange).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            <span className="ml-1">({valueChangePercent.toFixed(2)}%)</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${latestData.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Total P&L: ₹{latestData.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className={`text-sm font-medium ${latestData.day_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Today's P&L: ₹{latestData.day_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <div className="flex-grow">
        <Line options={chartOptions} data={chartData} />
      </div>
    </div>
  );
};

export default PortfolioChart;