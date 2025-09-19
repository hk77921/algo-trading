// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://trd-integration.centralus.cloudapp.azure.com/:8000';

// OAuth Configuration
export const OAUTH_CONFIG = {
  FLATTRADE: {
    AUTH_URL: 'https://auth.flattrade.in',
    CALLBACK_PATH: '/callback'
  }
};

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    FLATTRADE_START: '/api/auth/flattrade',
    FLATTRADE_CALLBACK: '/api/auth/flattrade/callback',
    FLATTRADE_TOKEN_URL: '/trade/apitoken' , // Updated endpoint for token retrieval  
    GET_ACCESS_TOKEN: '/api/auth/get-access-token'

  },
  PORTFOLIO: '/api/portfolio',
  ORDERS: '/api/orders',
  ACCOUNT: '/api/account',
  MARKET_DATA: '/api/market-data'
};
