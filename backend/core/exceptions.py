from fastapi import HTTPException, status

class TradingAPIException(HTTPException):
    """Base exception for Trading API"""
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class AuthenticationError(TradingAPIException):
    """Raised when authentication fails"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

class InvalidSessionError(TradingAPIException):
    """Raised when session is invalid or expired"""
    def __init__(self, detail: str = "Invalid or expired session"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

class BrokerAPIError(TradingAPIException):
    """Raised when broker API request fails"""
    def __init__(self, detail: str = "Broker API request failed"):
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)

def add_exception_handlers(app):
    """Add exception handlers to the FastAPI app"""
    @app.exception_handler(TradingAPIException)
    async def trading_exception_handler(request, exc):
        return {"success": False, "error": exc.detail}, exc.status_code
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
