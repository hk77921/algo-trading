export const INDICATOR_DEFAULTS = {
  sma: {
    name: 'Simple Moving Average',
    params: {
      period: 14
    },
    color: '#2962FF'
  },
  ema: {
    name: 'Exponential Moving Average',
    params: {
      period: 21
    },
    color: '#7B1FA2'
  },
  rsi: {
    name: 'Relative Strength Index',
    params: {
      period: 14
    },
    color: '#FF6D00',
    separatePane: true
  },
  macd: {
    name: 'MACD',
    params: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    },
    color: '#2962FF',
    separatePane: true
  },
  bollinger: {
    name: 'Bollinger Bands',
    params: {
      period: 20,
      stdDev: 2
    },
    color: '#2962FF'
  }
};

export const TRADING_STRATEGIES = {
  goldenCross: {
    name: 'Golden Cross',
    description: 'SMA 50 crosses above SMA 200',
    indicators: ['sma50', 'sma200'],
    condition: (data, indicators) => {
      // Implementation
      return false;
    }
  },
  rsiOversold: {
    name: 'RSI Oversold',
    description: 'RSI below 30',
    indicators: ['rsi'],
    condition: (data, indicators) => {
      // Implementation
      return false;
    }
  }
};