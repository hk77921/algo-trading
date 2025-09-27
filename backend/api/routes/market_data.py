# api/routes/market_data.py - Fixed WebSocket endpoint
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Depends, HTTPException, Query
from core.dependencies import verify_ws_token, get_current_session
from services.websocket_service import websocket_service
from services.flattrade_client import flattrade_client

router = APIRouter(prefix="/market", tags=["Market Data"])
logger = logging.getLogger("api.routes.market_data")

def _mask_token(token: str) -> str:
    if not token:
        return "None"
    if len(token) <= 12:
        return token[:4] + "..."
    return token[:6] + "..." + token[-4:]

@router.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    """Enhanced WebSocket endpoint with proper error handling"""
    session_token = None
    
    try:
        # 1) Verify token during handshake (BEFORE accept)
        session_token = await verify_ws_token(websocket)
    except HTTPException as e:
        logger.warning("WebSocket handshake failed: %s", e.detail if hasattr(e, "detail") else str(e))
        # Don't call accept() - let FastAPI handle the handshake rejection
        raise

    # Extract parameters
    qs = dict(websocket.query_params)
    exchange = qs.get("exchange", "NSE")
    feed_type = qs.get("feed_type", "t")
    user_id = "FZ12004"  # Use your actual user ID

    masked = _mask_token(session_token)
    logger.info("WS handshake OK for symbol=%s (masked token=%s)", symbol, masked)

    # 2) Accept WebSocket connection AFTER successful token verification
    await websocket.accept()
    logger.info("WebSocket accepted for client (symbol=%s)", symbol)

    try:
        # 3) Connect to FlatTrade backend
        connected = await websocket_service.connect_to_flattrade(user_id=user_id, session_token=session_token)
        if not connected:
            logger.error("Failed to connect to FlatTrade for masked token=%s", masked)
            await websocket.close(code=4003, reason="Failed to connect to market data provider")
            return

        # 4) Subscribe client to symbol
        try:
            await websocket_service.subscribe_symbol(
                session_token=session_token,
                symbol=symbol,
                client_ws=websocket,
                exchange=exchange,
                feed_type=feed_type
            )
            logger.info("Successfully subscribed client to %s", symbol)
        except Exception as e:
            logger.exception("Failed to subscribe client to symbol %s: %s", symbol, e)
            await websocket.close(code=4004, reason="Subscription failed")
            return

        # 5) Keep connection alive and handle client messages
        try:
            while True:
                # Wait for client messages or ping/pong
                # This will raise WebSocketDisconnect when client disconnects
                try:
                    msg = await websocket.receive_text()
                    logger.debug("Received client message (masked=%s): %s", masked, msg)
                    # Handle client control messages if needed
                    # For now, just acknowledge receipt
                except Exception as msg_error:
                    # If we can't receive messages, the connection might be broken
                    logger.debug("Error receiving message: %s", msg_error)
                    break
        except WebSocketDisconnect:
            logger.info("Client disconnected normally (symbol=%s masked_token=%s)", symbol, masked)
        except Exception as e:
            logger.exception("Unexpected error in websocket loop for symbol=%s: %s", symbol, e)

    finally:
        # 6) Cleanup: always unsubscribe, even if there were errors
        if session_token:  # Only cleanup if we had a valid session
            try:
                await websocket_service.unsubscribe_symbol(
                    session_token=session_token,
                    symbol=symbol,
                    client_ws=websocket,
                    exchange=exchange
                )
                logger.info("Cleanup done for client (symbol=%s masked_token=%s)", symbol, masked)
            except Exception as cleanup_error:
                logger.exception("Cleanup failed for client (symbol=%s masked_token=%s): %s", 
                               symbol, masked, cleanup_error)

@router.get("/{symbol}/history")
async def get_historical_data(
    symbol: str,
    session_token: str = Depends(get_current_session),
    interval: str = Query("60", description="Candle interval in minutes"),
    days: int = Query(2, description="Number of days of historical data")
):
    """Get historical candle data for charting"""
    try:
        # Calculate time range
        end_time = int(datetime.now().timestamp())
        start_time = int((datetime.now() - timedelta(days=days)).timestamp())
        
        logger.info("Fetching historical data for %s from %s to %s", symbol, start_time, end_time)
        
        # Get historical data from FlatTrade
        candles = await flattrade_client.get_time_price_data(
            session_token=session_token,
            symbol=symbol,
            start_time=start_time,
            end_time=end_time,
            interval=interval
        )
        
        return {
            "success": True,
            "candles": candles,
            "symbol": symbol,
            "interval": interval,
            "count": len(candles)
        }
        
    except Exception as e:
        logger.exception("Failed to get historical data for %s: %s", symbol, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get historical data: {str(e)}"
        )

@router.get("/{symbol}")
async def get_market_data(
    symbol: str,
    session_token: str = Depends(get_current_session)
):
    """Get current market data for a symbol"""
    try:
        quote = await flattrade_client.get_quote(session_token, symbol)
        
        if quote.get("success"):
            return {
                "success": True,
                "market_data": {
                    "symbol": quote["data"]["symbol"],
                    "last_price": quote["data"]["last_price"],
                    "open": quote["data"]["open"],
                    "high": quote["data"]["high"],
                    "low": quote["data"]["low"],
                    "close": quote["data"]["close"],
                    "volume": quote["data"]["volume"],
                    "change": quote["data"]["last_price"] - quote["data"]["close"],
                    "change_percent": ((quote["data"]["last_price"] - quote["data"]["close"]) / quote["data"]["close"] * 100) if quote["data"]["close"] > 0 else 0
                }
            }
        else:
            raise HTTPException(status_code=400, detail=quote.get("error", "Failed to get market data"))
            
    except Exception as e:
        logger.exception("Failed to get market data for %s: %s", symbol, e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get market data: {str(e)}"
        )

@router.get("/search")
async def search_symbols(
    q: str = Query(..., description="Search query"),
    session_token: str = Depends(get_current_session)
):
    """Search for tradeable symbols"""
    try:
        symbols = await flattrade_client.search_symbols(session_token, q)
        return {
            "success": True,
            "symbols": symbols[:20]  # Limit to 20 results
        }
    except Exception as e:
        logger.exception("Symbol search failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )