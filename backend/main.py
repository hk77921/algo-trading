from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import get_settings
from api.routes import auth, portfolio, orders, market_data, account, health
from core.exceptions import add_exception_handlers

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()
    
    app = FastAPI(
        title="Trading API",
        version="2.0.0",
        description="Modular Trading API with Flattrade Integration"
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
        expose_headers=["Content-Type"]
    )

    # Add exception handlers
    add_exception_handlers(app)

    # Include routers
    app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(portfolio.router, prefix="/api", tags=["Portfolio"])
    app.include_router(orders.router, prefix="/api", tags=["Orders"])
    app.include_router(market_data.router, prefix="/api", tags=["Market Data"])
    app.include_router(account.router, prefix="/api", tags=["Account"])
    app.include_router(health.router, prefix="/api", tags=["Health"])

    @app.get("/")
    async def root():
        return {"message": "Trading API is running", "version": "2.0.0"}

    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )