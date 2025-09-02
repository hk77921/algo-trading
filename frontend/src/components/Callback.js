import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Callback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeLoginFromCallback } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(location.search);
      const request_token = params.get('code') || params.get('request_token') || params.get('token');
      const state = params.get('state') || params.get('oauth_state');
      
      console.log('URL Parameters:', {
        request_token,
        state,
        raw_params: Object.fromEntries(params.entries())
      });
      
      if (!request_token) {
        setError('Missing authorization code/request_token from Flattrade');
        return;
      }
      
      const result = await completeLoginFromCallback({ request_token, state });
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
      }
    };
    run();
  }, [location.search, completeLoginFromCallback, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {!error ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Completing login...</p>
          </>
        ) : (
          <>
            <p className="text-red-600 font-medium mb-2">{error}</p>
            <button onClick={() => navigate('/login')} className="btn-primary">Go to Login</button>
          </>
        )}
      </div>
    </div>
  );
};

export default Callback;
