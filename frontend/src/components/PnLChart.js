import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const PnLChart = ({ portfolio }) => {
  if (!portfolio || portfolio.length === 0) {
    return null;
  }

  // Sort positions by P&L
  const sortedPositions = [...portfolio]
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 7); // Show top 7 positions by P&L

  const data = {
    labels: sortedPositions.map(p => p.symbol),
    datasets: [
      {
        label: 'P&L Distribution',
        data: sortedPositions.map(p => p.pnl),
        backgroundColor: sortedPositions.map(p => 
          p.pnl >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'
        ),
        borderColor: sortedPositions.map(p => 
          p.pnl >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
        ),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw;
            return `P&L: ₹${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div style={{ height: '300px', width: '100%' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default PnLChart;