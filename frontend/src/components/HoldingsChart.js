import React, { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

// Predefined colors for consistent appearance
const CHART_COLORS = [
  '#FF6384', // red
  '#36A2EB', // blue
  '#FFCE56', // yellow
  '#4BC0C0', // turquoise
  '#9966FF', // purple
  '#FF9F40', // orange
  '#7C8DAB'  // gray (for Others)
];

const HoldingsChart = ({ portfolio }) => {
  if (!portfolio || portfolio.length === 0) {
    return null;
  }

  // Calculate total market value using current price for accurate value
  const totalValue = portfolio.reduce((sum, position) => 
    sum + (position.quantity * position.current_price), 0);

  // Prepare data for pie chart using current market value
  const holdings = portfolio.map(position => ({
    symbol: position.symbol,
    value: position.quantity * position.current_price,
    avgPrice: position.entry_price,
    ltp: position.current_price
  }));

  // Sort holdings by current value and get top holdings
  const topHoldings = holdings
    .sort((a, b) => b.value - a.value)
    .slice(0, 6); // Take top 6 holdings

  // Calculate others if there are more holdings
  if (holdings.length > 6) {
    const othersValue = holdings
      .slice(6)
      .reduce((sum, holding) => sum + holding.value, 0);
    topHoldings.push({ symbol: 'Others', value: othersValue });
  }

  const data = {
    labels: topHoldings.map(h => {
      const percentage = ((h.value / totalValue) * 100).toFixed(1);
      return `${h.symbol} (${percentage}%)`;
    }),
    datasets: [
      {
        data: topHoldings.map(h => h.value),
        backgroundColor: CHART_COLORS.slice(0, topHoldings.length),
        borderColor: CHART_COLORS.slice(0, topHoldings.length).map(c => c + '80'),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 20,
          padding: 15,
          font: {
            size: 11
          }
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const holding = topHoldings[context.dataIndex];
            const value = context.raw;
            const percentage = ((value / totalValue) * 100).toFixed(1);
            const formattedValue = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0
            }).format(value);
            
            if (holding.symbol === 'Others') {
              return `${formattedValue} (${percentage}%)`;
            }
            
            const change = ((holding.ltp - holding.avgPrice) / holding.avgPrice * 100).toFixed(1);
            const changeSymbol = change >= 0 ? '▲' : '▼';
            return `${formattedValue} (${percentage}%) ${changeSymbol}${Math.abs(change)}%`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Pie data={data} options={options} />
    </div>
  );
};

export default HoldingsChart;