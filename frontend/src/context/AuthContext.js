import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.defaults.baseURL = API_BASE_URL;
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('session_user');
    if (storedToken) {
      setSessionToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch { }
    }
  }, []);

  const startLogin = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(API_ENDPOINTS.AUTH.FLATTRADE_START);
      if (resp.data?.login_url && resp.data?.state) {
        localStorage.setItem('flattrade_oauth_state', resp.data.state);
        window.location.assign(resp.data.login_url);
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('Start login error:', error);
      setLoading(false);
      return { success: false, error: 'Failed to start login flow' };
    }
  };

  const completeLoginFromCallback = async (params) => {
    setLoading(true);
    try {
      const storedState = localStorage.getItem('flattrade_oauth_state');
      const { request_token, state } = params;

      if (!request_token) {
        return { success: false, error: 'Missing authorization code' };
      }

      // Validate state if we have it stored
      if (storedState && state && storedState !== state) {
        return { success: false, error: 'State mismatch' };
      }

      console.log('Sending callback request with:', { request_token, state });
      
      // Call the new callback endpoint
      const resp = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.FLATTRADE_CALLBACK}`, {
        request_token,
        state
      });

      if (resp.data?.session_token) {
        const token = resp.data.session_token;
        const sessionUser = resp.data.user || { id: 'flattrade_user' };
        
        console.log('Code-Session token:', resp.code);
        console.log('session token',sessionToken)
        // // Get access token
        // try {
        //   const accessTokenResp = await axios.post(API_ENDPOINTS.AUTH.GET_ACCESS_TOKEN, {
        //     session_token: token
        //   });
          
        //   if (accessTokenResp.data?.access_token) {
        //     sessionUser.access_token = accessTokenResp.data.access_token;
        //   }
        // } catch (error) {
        //   console.error('Access token fetch error:', error);
        // }

        setSessionToken(token);
        setUser(sessionUser);
        localStorage.setItem('session_token', token);
        localStorage.setItem('session_user', JSON.stringify(sessionUser));
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        localStorage.removeItem('flattrade_oauth_state');
        return { success: true };
      }
      return { success: false, error: 'Invalid token response' };
    } catch (error) {
      console.error('Callback error:', error);
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  // Backward compatibility
  const login = () => startLogin();

  const logout = () => {
    setUser(null);
    setSessionToken(null);
    delete axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('session_token');
    localStorage.removeItem('session_user');
  };

  const isAuthenticated = () => Boolean(sessionToken && user);

  const value = {
    user,
    sessionToken,
    loading,
    login,
    startLogin,
    completeLoginFromCallback,
    logout,
    isAuthenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
