# Trading API v2.0

A modular and scalable FastAPI-based trading API with Flattrade integration.

## Features

- 🔐 **OAuth Authentication** with Flattrade
- 📊 **Portfolio Management** - View holdings, positions, and P&L
- 📈 **Order Management** - Place and track orders
- 💹 **Market Data** - Real-time market data integration
- 👤 **Account Management** - User account details and settings
- 🏥 **Health Monitoring** - API health checks and status
- 🔄 **Error Handling** - Comprehensive error handling and logging
- 📝 **API Documentation** - Auto-generated OpenAPI docs

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
trading-api/
├── api/
│   └── routes/          # API route handlers
│       ├── auth.py
│       ├── portfolio.py
│       ├── orders.py
│       ├── market_data.py
│       ├── account.py
│       └── health.py
├── config/
│   └── settings.py      # Configuration management
├── core/
│   ├── exceptions.py    # Exception handling
│   ├── logging.py       # Logging configuration
│   └── dependencies.py  # FastAPI dependencies
├── models/
│   └── schemas.py       # Pydantic models
├── services/
│   ├── auth_service.py     # Authentication logic
│   ├── portfolio_service.py # Portfolio operations
│   └── flattrade_client.py  # Flattrade API client
├── utils/
│   ├── helpers.py       # Utility functions
│   ├── validators.py    # Data validation
│   ├── constants.py     # Application constants
│   └── decorators.py    # Utility decorators
├── main.py             # Application entry point
├── requirements.txt    # Python dependencies
└── .env.example       # Environment variables template
```

## Quick Start

### Prerequisites

- Python 3.11+
- Flattrade API credentials
- (Optional) Docker and Docker Compose

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd trading-api
```

2. **Create virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Run the application**
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or run with Docker only
docker build -t trading-api .
docker run -p 8000:8000 --env-file .env trading-api
```

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Server host | `0.0.0.0` |
| `PORT` | Server port | `8000` |
| `DEBUG` | Debug mode | `false` |
| `SECRET_KEY` | JWT secret key | Auto-generated |
| `FLATTRADE_API_KEY` | Flattrade API key | Required |
| `FLATTRADE_API_SECRET` | Flattrade API secret | Required |
| `FLATTRADE_TOKEN_URL` | Token exchange URL | Required |
| `FLATTRADE_REDIRECT_URI` | OAuth redirect URI | `http://localhost:3000/callback` |
| `DEFAULT_USER_ID` | Default Flattrade user ID | `FZ12004` |

## API Endpoints

### Authentication
- `GET /api/auth/flattrade` - Start OAuth flow
- `POST /api/auth/flattrade/callback` - Handle OAuth callback
- `POST /api/auth/get-access-token` - Exchange session for access token

### Portfolio
- `GET /api/portfolio` - Get portfolio positions and statistics

### Orders
- `GET /api/orders` - Get order book
- `GET /api/trades` - Get trade book  
- `POST /api/order` - Place new order

### Account
- `GET /api/account` - Get account details

### Market Data
- `GET /api/market-data/{symbol}` - Get market data for symbol

### Health
- `GET /api/health` - Basic health check
- `GET /api/health/flattrade` - Flattrade API connectivity check

## Authentication Flow

1. **Initiate OAuth**: `GET /api/auth/flattrade`
   - Returns login URL and state parameter
   
2. **User Authorization**: User visits login URL and authorizes app

3. **Handle Callback**: `POST /api/auth/flattrade/callback`
   - Exchange authorization code for session token
   
4. **API Access**: Use session token in Authorization header
   ```
   Authorization: Bearer <session-token>
   ```

## Error Handling

The API uses structured error responses:

```json
{
  "success": false,
  "error": "Error message",
  "type": "ErrorType",
  "details": {}
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Development

### Code Structure

- **Services**: Business logic and external API interactions
- **Routes**: HTTP request handling and response formatting
- **Models**: Data validation and serialization
- **Core**: Common functionality (logging, exceptions, dependencies)
- **Utils**: Helper functions and utilities

### Adding New Features

1. **Add Model**: Define Pydantic models in `models/schemas.py`
2. **Create Service**: Implement business logic in `services/`
3. **Add Routes**: Create API endpoints in `api/routes/`
4. **Update Main**: Include router in `main.py`

### Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_portfolio.py
```

### Code Quality

```bash
# Format code
black .

# Sort imports
isort .

# Lint code
flake8 .
```

## Deployment

### Production Considerations

1. **Security**:
   - Use strong SECRET_KEY
   - Enable HTTPS
   - Implement rate limiting
   - Validate all inputs

2. **Performance**:
   - Use Redis for session storage
   - Implement connection pooling
   - Add request/response caching

3. **Monitoring**:
   - Set up logging aggregation
   - Monitor health endpoints
   - Track API metrics

4. **Scalability**:
   - Use load balancer
   - Scale horizontally
   - Implement circuit breakers

### Example Production Deploy

```bash
# Using Docker with production settings
docker run -d \
  -p 8000:8000 \
  --name trading-api \
  --env-file .env.prod \
  --restart unless-stopped \
  trading-api
```

## API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation at `/docs`
- Review the health endpoints for system status