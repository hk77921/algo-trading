# OAuth Setup Guide for FlatTrade Integration

## Issue Resolution

The OAuth callback was not working because of configuration mismatches between the frontend, backend, and FlatTrade's expected redirect URLs.

## What Was Fixed

1. **Redirect URI Configuration**: Updated backend to use `http://localhost:3000/callback` instead of `http://localhost:8000/api/auth/flattrade`
2. **Callback Handling**: Added proper callback endpoint at `/api/auth/flattrade/callback`
3. **Frontend Integration**: Updated Callback component to properly extract and send authorization code
4. **Configuration Centralization**: Created config files for better maintainability

## Setup Steps

### 1. Backend Environment Configuration

Create a `.env` file in the `backend/` directory:

```bash
# Flattrade API Configuration
FLATTRADE_API_KEY=your_actual_api_key_here
FLATTRADE_API_SECRET=your_actual_api_secret_here
FLATTRADE_BASE_URL=https://auth.flattrade.in
FLATTRADE_REDIRECT_URI=http://localhost:3000/callback
FLATTRADE_TOKEN_URL=https://authapi.flattrade.in/ftauth/token
#FLATTRADE_API_BASE_URL=https://api.flattrade.in

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Security
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 2. FlatTrade App Configuration

In your FlatTrade developer console, ensure the redirect URI is set to:
```
http://localhost:3000/callback
```

**NOT** `http://localhost:8000/api/auth/flattrade`

### 3. Start the Services

1. **Backend**: 
   ```bash
   cd backend
   python main.py
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm start
   ```

## OAuth Flow

1. User clicks "Login with FlatTrade"
2. Backend generates OAuth URL with redirect to `http://localhost:3000/callback`
3. User is redirected to FlatTrade login
4. After login, FlatTrade redirects to `http://localhost:3000/callback?code=...&state=...`
5. Frontend Callback component extracts the code and state
6. Frontend sends code to backend `/api/auth/flattrade/callback`
7. Backend exchanges code for access token
8. User is authenticated and redirected to dashboard

## Troubleshooting

- **"Missing authorization code"**: Check that FlatTrade redirect URI matches exactly
- **"State mismatch"**: OAuth state validation failed, try logging in again
- **"Token exchange failed"**: Check FLATTRADE_API_KEY, FLATTRADE_API_SECRET, and FLATTRADE_TOKEN_URL

## Important Notes

- The redirect URI in FlatTrade's app configuration MUST match `http://localhost:3000/callback`
- Never use the backend API endpoint as the redirect URI
- Ensure your `.env` file has the correct API credentials
- The frontend runs on port 3000, backend on port 8000
