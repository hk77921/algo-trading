// src/utils/indicators.js
// Comprehensive technical indicators library for algorithmic trading

/**
 * Simple Moving Average (SMA)
 * @param {Array} data - Array of candle objects with 'close' property
 * @param {number} period - Number of periods for calculation
 * @returns {Array} Array of {time, value} objects
 */
export function calculateSMA(data, period = 20) {
  if (!data || data.length < period) return [];
  
  const result = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    const average = sum / period;
    
    result.push({
      time: data[i].time,
      value: parseFloat(average.toFixed(2))
    });
  }
  
  return result;
}

/**
 * Exponential Moving Average (EMA)
 * @param {Array} data - Array of candle objects with 'close' property
 * @param {number} period - Number of periods for calculation
 * @returns {Array} Array of {time, value} objects
 */
export function calculateEMA(data, period = 20) {
  if (!data || data.length < period) return [];
  
  const result = [];
  const multiplier = 2 / (period + 1);
  
  // Calculate initial SMA for first EMA value
  const initialSlice = data.slice(0, period);
  const initialSMA = initialSlice.reduce((acc, candle) => acc + candle.close, 0) / period;
  
  let ema = initialSMA;
  result.push({
    time: data[period - 1].time,
    value: parseFloat(ema.toFixed(2))
  });
  
  // Calculate EMA for remaining data points
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: data[i].time,
      value: parseFloat(ema.toFixed(2))
    });
  }
  
  return result;
}

/**
 * Relative Strength Index (RSI)
 * @param {Array} data - Array of candle objects with 'close' property
 * @param {number} period - Number of periods for calculation (default 14)
 * @returns {Array} Array of {time, value} objects
 */
export function calculateRSI(data, period = 14) {
  if (!data || data.length < period + 1) return [];
  
  const result = [];
  const changes = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Calculate RSI for each subsequent period
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      time: data[i + 1].time,
      value: parseFloat(rsi.toFixed(2))
    });
  }
  
  return result;
}

/**
 * Bollinger Bands
 * @param {Array} data - Array of candle objects with 'close' property
 * @param {number} period - Number of periods for SMA calculation (default 20)
 * @param {number} stdDev - Number of standard deviations (default 2)
 * @returns {Object} Object with upper, middle, and lower band arrays
 */
export function calculateBollingerBands(data, period = 20, stdDev = 2) {
  if (!data || data.length < period) return { upper: [], middle: [], lower: [] };
  
  const upper = [];
  const middle = [];
  const lower = [];
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const closes = slice.map(candle => candle.close);
    
    // Calculate SMA (middle band)
    const sma = closes.reduce((acc, val) => acc + val, 0) / period;
    
    // Calculate standard deviation
    const squaredDiffs = closes.map(close => Math.pow(close - sma, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate bands
    const upperBand = sma + (standardDeviation * stdDev);
    const lowerBand = sma - (standardDeviation * stdDev);
    
    const time = data[i].time;
    
    upper.push({ time, value: parseFloat(upperBand.toFixed(2)) });
    middle.push({ time, value: parseFloat(sma.toFixed(2)) });
    lower.push({ time, value: parseFloat(lowerBand.toFixed(2)) });
  }
  
  return { upper, middle, lower };
}

/**
 * Moving Average Convergence Divergence (MACD)
 * @param {Array} data - Array of candle objects with 'close' property
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line period (default 9)
 * @returns {Object} Object with macd, signal, and histogram arrays
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!data || data.length < slowPeriod + signalPeriod) {
    return { macd: [], signal: [], histogram: [] };
  }
  
  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // Calculate MACD line (difference between fast and slow EMA)
  const macdLine = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < slowEMA.length; i++) {
    const macdValue = fastEMA[i + startIndex].value - slowEMA[i].value;
    macdLine.push({
      time: slowEMA[i].time,
      close: macdValue // Use 'close' for EMA calculation
    });
  }
  
  // Calculate signal line (EMA of MACD line)
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram (MACD - Signal)
  const macd = [];
  const signal = [];
  const histogram = [];
  
  for (let i = 0; i < signalLine.length; i++) {
    const macdValue = macdLine[i + signalPeriod - 1].close;
    const signalValue = signalLine[i].value;
    const histValue = macdValue - signalValue;
    
    const time = signalLine[i].time;
    
    macd.push({ time, value: parseFloat(macdValue.toFixed(2)) });
    signal.push({ time, value: parseFloat(signalValue.toFixed(2)) });
    histogram.push({ time, value: parseFloat(histValue.toFixed(2)) });
  }
  
  return { macd, signal, histogram };
}

/**
 * Stochastic Oscillator
 * @param {Array} data - Array of candle objects with high, low, close
 * @param {number} period - %K period (default 14)
 * @param {number} smoothK - %K smoothing (default 3)
 * @param {number} smoothD - %D smoothing (default 3)
 * @returns {Object} Object with k and d line arrays
 */
export function calculateStochastic(data, period = 14, smoothK = 3, smoothD = 3) {
  if (!data || data.length < period) return { k: [], d: [] };
  
  const rawK = [];
  
  // Calculate raw %K
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(candle => candle.high));
    const low = Math.min(...slice.map(candle => candle.low));
    const close = data[i].close;
    
    const k = ((close - low) / (high - low)) * 100;
    rawK.push({
      time: data[i].time,
      close: k // Use 'close' for SMA calculation
    });
  }
  
  // Smooth %K
  const kLine = calculateSMA(rawK, smoothK);
  
  // Calculate %D (SMA of %K)
  const kForD = kLine.map(point => ({ time: point.time, close: point.value }));
  const dLine = calculateSMA(kForD, smoothD);
  
  return {
    k: kLine.map(p => ({ time: p.time, value: parseFloat(p.value.toFixed(2)) })),
    d: dLine.map(p => ({ time: p.time, value: parseFloat(p.value.toFixed(2)) }))
  };
}

/**
 * Average True Range (ATR)
 * Measures market volatility
 * @param {Array} data - Array of candle objects with high, low, close
 * @param {number} period - Number of periods (default 14)
 * @returns {Array} Array of {time, value} objects
 */
export function calculateATR(data, period = 14) {
  if (!data || data.length < period + 1) return [];
  
  const trueRanges = [];
  
  // Calculate True Range for each period
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trueRanges.push({ time: data[i].time, close: tr });
  }
  
  // Calculate ATR using EMA of True Range
  const atr = calculateEMA(trueRanges, period);
  
  return atr;
}

/**
 * Volume Weighted Average Price (VWAP)
 * @param {Array} data - Array of candle objects with high, low, close, volume
 * @returns {Array} Array of {time, value} objects
 */
export function calculateVWAP(data) {
  if (!data || data.length === 0) return [];
  
  const result = [];
  let cumulativeTPV = 0; // Typical Price * Volume
  let cumulativeVolume = 0;
  
  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    const tpv = typicalPrice * (data[i].volume || 1);
    
    cumulativeTPV += tpv;
    cumulativeVolume += (data[i].volume || 1);
    
    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
    
    result.push({
      time: data[i].time,
      value: parseFloat(vwap.toFixed(2))
    });
  }
  
  return result;
}

/**
 * Parabolic SAR (Stop and Reverse)
 * @param {Array} data - Array of candle objects with high, low
 * @param {number} accelerationFactor - Initial AF (default 0.02)
 * @param {number} maxAcceleration - Maximum AF (default 0.2)
 * @returns {Array} Array of {time, value, trend} objects
 */
export function calculateParabolicSAR(data, accelerationFactor = 0.02, maxAcceleration = 0.2) {
  if (!data || data.length < 2) return [];
  
  const result = [];
  let trend = 1; // 1 for uptrend, -1 for downtrend
  let sar = data[0].low;
  let ep = data[0].high; // Extreme Point
  let af = accelerationFactor;
  
  result.push({ time: data[0].time, value: sar, trend });
  
  for (let i = 1; i < data.length; i++) {
    const prevSAR = sar;
    
    // Calculate new SAR
    sar = prevSAR + af * (ep - prevSAR);
    
    if (trend === 1) {
      // Uptrend
      sar = Math.min(sar, data[i - 1].low, i > 1 ? data[i - 2].low : data[i - 1].low);
      
      if (data[i].low < sar) {
        trend = -1;
        sar = ep;
        ep = data[i].low;
        af = accelerationFactor;
      } else {
        if (data[i].high > ep) {
          ep = data[i].high;
          af = Math.min(af + accelerationFactor, maxAcceleration);
        }
      }
    } else {
      // Downtrend
      sar = Math.max(sar, data[i - 1].high, i > 1 ? data[i - 2].high : data[i - 1].high);
      
      if (data[i].high > sar) {
        trend = 1;
        sar = ep;
        ep = data[i].high;
        af = accelerationFactor;
      } else {
        if (data[i].low < ep) {
          ep = data[i].low;
          af = Math.min(af + accelerationFactor, maxAcceleration);
        }
      }
    }
    
    result.push({
      time: data[i].time,
      value: parseFloat(sar.toFixed(2)),
      trend
    });
  }
  
  return result;
}

/**
 * Ichimoku Cloud
 * @param {Array} data - Array of candle objects
 * @returns {Object} Object with tenkan, kijun, senkouA, senkouB, chikou arrays
 */
export function calculateIchimoku(data, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
  if (!data || data.length < senkouBPeriod) {
    return { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] };
  }
  
  const tenkan = [];
  const kijun = [];
  const senkouA = [];
  const senkouB = [];
  const chikou = [];
  
  const calculateLine = (period, index) => {
    const slice = data.slice(Math.max(0, index - period + 1), index + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    return (high + low) / 2;
  };
  
  for (let i = 0; i < data.length; i++) {
    // Tenkan-sen (Conversion Line)
    if (i >= tenkanPeriod - 1) {
      tenkan.push({
        time: data[i].time,
        value: parseFloat(calculateLine(tenkanPeriod, i).toFixed(2))
      });
    }
    
    // Kijun-sen (Base Line)
    if (i >= kijunPeriod - 1) {
      kijun.push({
        time: data[i].time,
        value: parseFloat(calculateLine(kijunPeriod, i).toFixed(2))
      });
    }
    
    // Senkou Span A (Leading Span A)
    if (i >= kijunPeriod - 1) {
      const tenkanValue = calculateLine(tenkanPeriod, i);
      const kijunValue = calculateLine(kijunPeriod, i);
      senkouA.push({
        time: data[Math.min(i + kijunPeriod, data.length - 1)].time,
        value: parseFloat(((tenkanValue + kijunValue) / 2).toFixed(2))
      });
    }
    
    // Senkou Span B (Leading Span B)
    if (i >= senkouBPeriod - 1) {
      senkouB.push({
        time: data[Math.min(i + kijunPeriod, data.length - 1)].time,
        value: parseFloat(calculateLine(senkouBPeriod, i).toFixed(2))
      });
    }
    
    // Chikou Span (Lagging Span)
    chikou.push({
      time: data[Math.max(0, i - kijunPeriod)].time,
      value: parseFloat(data[i].close.toFixed(2))
    });
  }
  
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

/**
 * Money Flow Index (MFI)
 * Volume-weighted RSI
 * @param {Array} data - Array of candle objects with high, low, close, volume
 * @param {number} period - Number of periods (default 14)
 * @returns {Array} Array of {time, value} objects
 */
export function calculateMFI(data, period = 14) {
  if (!data || data.length < period + 1) return [];
  
  const result = [];
  const typicalPrices = [];
  const moneyFlows = [];
  
  // Calculate typical price and money flow
  for (let i = 0; i < data.length; i++) {
    const tp = (data[i].high + data[i].low + data[i].close) / 3;
    typicalPrices.push(tp);
    moneyFlows.push(tp * (data[i].volume || 1));
  }
  
  // Calculate MFI
  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += moneyFlows[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += moneyFlows[j];
      }
    }
    
    const moneyRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    const mfi = 100 - (100 / (1 + moneyRatio));
    
    result.push({
      time: data[i].time,
      value: parseFloat(mfi.toFixed(2))
    });
  }
  
  return result;
}

/**
 * On-Balance Volume (OBV)
 * Cumulative volume indicator
 * @param {Array} data - Array of candle objects with close, volume
 * @returns {Array} Array of {time, value} objects
 */
export function calculateOBV(data) {
  if (!data || data.length < 2) return [];
  
  const result = [];
  let obv = 0;
  
  result.push({ time: data[0].time, value: 0 });
  
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv += (data[i].volume || 1);
    } else if (data[i].close < data[i - 1].close) {
      obv -= (data[i].volume || 1);
    }
    
    result.push({
      time: data[i].time,
      value: parseFloat(obv.toFixed(2))
    });
  }
  
  return result;
}

/**
 * Commodity Channel Index (CCI)
 * @param {Array} data - Array of candle objects with high, low, close
 * @param {number} period - Number of periods (default 20)
 * @returns {Array} Array of {time, value} objects
 */
export function calculateCCI(data, period = 20) {
  if (!data || data.length < period) return [];
  
  const result = [];
  const constant = 0.015;
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    
    // Calculate typical price
    const typicalPrices = slice.map(candle => 
      (candle.high + candle.low + candle.close) / 3
    );
    
    // Calculate SMA of typical price
    const sma = typicalPrices.reduce((acc, val) => acc + val, 0) / period;
    
    // Calculate mean deviation
    const meanDeviation = typicalPrices.reduce((acc, val) => 
      acc + Math.abs(val - sma), 0
    ) / period;
    
    // Calculate CCI
    const currentTP = typicalPrices[typicalPrices.length - 1];
    const cci = (currentTP - sma) / (constant * meanDeviation);
    
    result.push({
      time: data[i].time,
      value: parseFloat(cci.toFixed(2))
    });
  }
  
  return result;
}

// Export all indicators
export default {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateBollingerBands,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateVWAP,
  calculateParabolicSAR,
  calculateIchimoku,
  calculateMFI,
  calculateOBV,
  calculateCCI
};