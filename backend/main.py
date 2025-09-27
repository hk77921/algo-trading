from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config.settings import get_settings
from api.routes import auth, portfolio, orders,  account, health, market_data
from core.exceptions import add_exception_handlers

# --- ASGI middleware to log raw websocket handshake scope (query string + headers) ---
class WSLoggingMiddleware:
    def __init__(self, app):
        self.app = app
        # configure a logger specifically for ws debug logs
        self.logger = logging.getLogger("ws_debug")
        if not self.logger.handlers:
            # Avoid adding multiple handlers if module reloaded
            ch = logging.StreamHandler()
            ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
            self.logger.addHandler(ch)
        self.logger.setLevel(logging.WARNING)

    async def __call__(self, scope, receive, send):
        # only log websocket handshake attempts
        if scope.get("type") == "websocket":
            # decode headers to readable tuples
            headers = []
            try:
                headers = [(h[0].decode("utf-8", errors="ignore"), h[1].decode("utf-8", errors="ignore")) for h in scope.get("headers", [])]
            except Exception:
                headers = [("error", "failed to decode headers")]
            qs = scope.get("query_string", b"").decode("utf-8", errors="ignore")
            client = scope.get("client")
            path = scope.get("path")
            self.logger.warning("ASGI WS HANDSHAKE: path=%s query_string=%s headers=%s client=%s",
                                path, qs, headers, client)
        await self.app(scope, receive, send)


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    settings = get_settings()

    app = FastAPI(
        title="Trading API",
        version="2.0.0",
        description="Modular Trading API with Flattrade Integration"
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,                        # <--- allow everything during dev
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allow_headers=["*"],
        expose_headers=["*"]
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


# create the app and wrap it with the ASGI WS logging middleware
app = create_app()
app = WSLoggingMiddleware(app)


if __name__ == "__main__":
    print("************************************************************************")
    print("Starting Trading API server...")
    import uvicorn
    settings = get_settings()
    print(f"Server running on http://{settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
   