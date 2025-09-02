# Trading API Backend

A FastAPI-based backend for integrating with the Flattrade broker system.

## Features

- Flattrade broker authentication
- Portfolio management
- Order placement and management
- Real-time market data
- Secure API endpoints with JWT authentication

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file based on `env.example`:
```bash
cp env.example .env
```

3. Update the `.env` file with your Flattrade API credentials:
```
FLATTRADE_API_KEY=your_actual_api_key
FLATTRADE_API_SECRET=your_actual_api_secret
```

4. Run the application:
```bash
python main.py
```

Or using uvicorn:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

- `POST /api/auth/flattrade` - Authenticate with Flattrade
- `GET /api/portfolio` - Get portfolio positions
- `POST /api/order` - Place trading orders
- `GET /api/market-data/{symbol}` - Get market data
- `GET /api/orders` - Get order history

## Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation.

## Security

- Uses JWT tokens for authentication
- CORS enabled for frontend integration
- Session management for trading operations

## Note

This is a development version with mock data. For production use:
- Implement proper database storage
- Add Redis for session management
- Implement real Flattrade API integration
- Add proper error handling and logging
- Implement rate limiting and security measures
