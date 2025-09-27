# services/websocket_service.py - Fixed version
import asyncio
import json
import logging
import random
from dataclasses import dataclass, field
from typing import Dict, Optional, Set, Any
import websockets
from fastapi import WebSocket
from services.flattrade_client import flattrade_client

logger = logging.getLogger("services.websocket_service")
logger.setLevel(logging.INFO)

@dataclass(frozen=True)  # Make it hashable by making it frozen (immutable)
class SymbolInfo:
    formatted_symbol: str  # NSE|TCS-EQ
    token: str            # Numeric token from FlatTrade
    tsym: str            # Trading symbol (TCS-EQ)
    exchange: str        # NSE
    
    def __hash__(self):
        return hash((self.formatted_symbol, self.token, self.tsym, self.exchange))
    
@dataclass
class FTSession:
    user_id: str
    session_token: str
    ws: Optional[Any] = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    listen_task: Optional[asyncio.Task] = None
    connected: bool = False
    # subscription sets hold SymbolInfo objects (now hashable)
    detailed_symbols: Set[SymbolInfo] = field(default_factory=set)
    touchline_symbols: Set[SymbolInfo] = field(default_factory=set)
    # clients: token -> set of FastAPI WebSocket objects
    clients: Dict[str, Set[WebSocket]] = field(default_factory=dict)
    # mapping FT token to SymbolInfo
    token_to_symbol: Dict[str, SymbolInfo] = field(default_factory=dict)
    # reconnect state
    reconnect_backoff: float = 1.0
    reconnecting: bool = False
    stop_reconnect: bool = False

class WebSocketService:
    def __init__(self, ft_ws_url: str = "wss://piconnect.flattrade.in/PiConnectWSTp/"):
        self.ft_ws_url = ft_ws_url
        self.sessions: Dict[str, FTSession] = {}
        self.ack_timeout = 6.0
        self.connect_kwargs = dict(
            ping_interval=20,
            ping_timeout=10,
            max_size=2**22
        )

    async def connect_to_flattrade(self, user_id: str, session_token: str) -> bool:
        """Ensure FTSession exists and is connected"""
        session = self.sessions.get(session_token)
        if not session:
            session = FTSession(user_id=user_id, session_token=session_token)
            self.sessions[session_token] = session

        async with session.lock:
            if session.connected and session.ws is not None:
                logger.debug("FT session already connected for user %s", user_id)
                return True

            try:
                logger.info("Connecting to FlatTrade for user=%s", user_id)
                session.ws = await websockets.connect(
                    self.ft_ws_url,
                    ping_interval=self.connect_kwargs.get("ping_interval"),
                    ping_timeout=self.connect_kwargs.get("ping_timeout"),
                    max_size=self.connect_kwargs.get("max_size"),
                )

                connect_payload = {
                    "t": "c",
                    "uid": user_id,
                    "actid": user_id,
                    "source": "API",
                    "susertoken": session_token
                }
                await session.ws.send(json.dumps(connect_payload))
                logger.debug("Sent connection request to FlatTrade")

                try:
                    raw = await asyncio.wait_for(session.ws.recv(), timeout=self.ack_timeout)
                except asyncio.TimeoutError:
                    logger.error("Timeout waiting for FlatTrade ack")
                    await self._close_ft_ws(session)
                    return False

                try:
                    ack = json.loads(raw)
                except Exception as e:
                    logger.error("Invalid ack from FlatTrade: %s, error: %s", raw, e)
                    await self._close_ft_ws(session)
                    return False

                if ack.get("t") == "ck" and str(ack.get("s", "")).lower() == "ok":
                    logger.info("FlatTrade connect ack OK for user %s", user_id)
                    session.connected = True
                    session.reconnect_backoff = 1.0
                    
                    if not session.listen_task or session.listen_task.done():
                        session.listen_task = asyncio.create_task(self._listen_to_flattrade(session))
                    return True
                else:
                    logger.error("FlatTrade ack not OK: %s", ack)
                    await self._close_ft_ws(session)
                    return False

            except Exception as e:
                logger.exception("Exception connecting to FlatTrade: %s", e)
                await self._close_ft_ws(session)
                # Don't schedule reconnect here, let the caller handle it
                return False

    async def subscribe_symbol(self, session_token: str, symbol: str, client_ws: WebSocket,
                               exchange: str = "NSE", feed_type: str = "t") -> None:
        """Subscribe client to symbol with proper token resolution"""
        session = self.sessions.get(session_token)
        if not session:
            logger.error("No session found for token")
            return

        if not session.connected:
            logger.error("Session not connected to FlatTrade")
            raise Exception("Not connected to FlatTrade")

        try:
            # Get the actual token from FlatTrade API
            token = await flattrade_client.get_stock_token(session_token, symbol)
            if not token:
                logger.error("Could not get token for symbol %s", symbol)
                raise Exception(f"Invalid symbol: {symbol}")
                
            symbol_info = SymbolInfo(
                formatted_symbol=f"{exchange}|{symbol}",
                token=str(token),  # Ensure it's a string
                tsym=symbol,
                exchange=exchange
            )
            
            logger.info("Resolved symbol %s to token %s", symbol, token)
            
            # Add client to token-based mapping
            if symbol_info.token not in session.clients:
                session.clients[symbol_info.token] = set()
            session.clients[symbol_info.token].add(client_ws)
            
            # Store token mapping
            session.token_to_symbol[symbol_info.token] = symbol_info
            
            # Add to subscription set (now works because SymbolInfo is hashable)
            target_set = session.detailed_symbols if feed_type == "d" else session.touchline_symbols
            was_new_symbol = symbol_info not in target_set
            target_set.add(symbol_info)
            
            logger.info("Client subscribed to %s (token=%s), clients count: %d", 
                       symbol, token, len(session.clients[symbol_info.token]))
            
            # Send subscription request only if this is a new symbol
            if was_new_symbol:
                await self._send_subscription_request_for_session(session, feed_type)
                
        except Exception as e:
            logger.exception("Failed to subscribe to %s: %s", symbol, e)
            raise

    async def unsubscribe_symbol(self, session_token: str, symbol: str, client_ws: WebSocket,
                                 exchange: str = "NSE", feed_type: Optional[str] = None) -> None:
        """Unsubscribe client from symbol"""
        session = self.sessions.get(session_token)
        if not session:
            return

        # Find token for this symbol
        token = None
        symbol_info = None
        for t, info in session.token_to_symbol.items():
            if info.tsym == symbol and info.exchange == exchange:
                token = t
                symbol_info = info
                break
        
        if not token or token not in session.clients:
            return

        if client_ws in session.clients[token]:
            session.clients[token].remove(client_ws)
            
            if len(session.clients[token]) == 0:
                # Remove completely
                del session.clients[token]
                
                # Remove from subscription sets (now works because SymbolInfo is hashable)
                if symbol_info:
                    session.detailed_symbols.discard(symbol_info)
                    session.touchline_symbols.discard(symbol_info)
                    del session.token_to_symbol[token]
                
                # Update subscriptions
                await self._send_subscription_request_for_session(session, "d")
                await self._send_subscription_request_for_session(session, "t")
                
                logger.info("Unsubscribed %s (token=%s)", symbol, token)
            else:
                logger.info("Client removed from %s, %d remaining", symbol, len(session.clients[token]))

    async def _send_subscription_request_for_session(self, session: FTSession, subscription_type: str) -> None:
        """Send subscription request using tokens"""
        if not session.connected or not session.ws:
            logger.debug("Session not connected, cannot send subscription request")
            return

        symbols = session.detailed_symbols if subscription_type == "d" else session.touchline_symbols
        if not symbols:
            logger.debug("No symbols to subscribe for type %s", subscription_type)
            return
            
        # FlatTrade expects format: "NSE|token#NSE|token2"
        formatted_tokens = []
        for symbol_info in symbols:
            formatted_tokens.append(f"{symbol_info.exchange}|{symbol_info.token}")
            
        if formatted_tokens:
            payload = {"t": subscription_type, "k": "#".join(formatted_tokens)}
            try:
                await session.ws.send(json.dumps(payload))
                logger.info("Sent %s subscription for %d symbols: %s", 
                           subscription_type, len(formatted_tokens), formatted_tokens[:3])
            except Exception as e:
                logger.exception("Failed to send subscription: %s", e)

    async def _listen_to_flattrade(self, session: FTSession) -> None:
        """Listen for FlatTrade messages and forward to clients"""
        logger.info("Starting FT listener for session")
        
        while not session.stop_reconnect:
            try:
                if not session.ws:
                    logger.warning("WebSocket is None in listener")
                    break

                raw = await session.ws.recv()
                if raw is None:
                    logger.warning("Received None from WebSocket")
                    break

                try:
                    data = json.loads(raw)
                    logger.debug("FT message: %s", data)
                except Exception:
                    logger.debug("Non-JSON message from FT: %s", raw)
                    continue

                t = data.get("t")
                if t in ("df", "tf", "d", "t"):
                    # Get token from message
                    incoming_token = str(data.get("tk", ""))
                    
                    if incoming_token in session.clients:
                        symbol_info = session.token_to_symbol.get(incoming_token)
                        if symbol_info:
                            # Transform market data for chart
                            transformed = self._transform_market_data(data, symbol_info)
                            
                            # Send to all clients for this token
                            dead_clients = set()
                            for client in list(session.clients[incoming_token]):
                                try:
                                    await client.send_text(json.dumps(transformed))
                                except Exception as e:
                                    logger.debug("Client send failed, will remove: %s", e)
                                    dead_clients.add(client)
                            
                            # Clean up dead connections
                            for dead in dead_clients:
                                session.clients[incoming_token].discard(dead)
                    else:
                        logger.debug("No clients for token %s", incoming_token)
                elif t == "ck":
                    logger.debug("Received connect-ack: %s", data)
                else:
                    logger.debug("Other FT message type %s: %s", t, data)

            except websockets.ConnectionClosed:
                logger.warning("FlatTrade connection closed unexpectedly")
                session.connected = False
                break
            except Exception as e:
                logger.exception("Listener exception: %s", e)
                session.connected = False
                break

        logger.info("FT listener ended for session")
        session.connected = False

    async def _close_ft_ws(self, session: FTSession) -> None:
        """Close WebSocket connection"""
        try:
            if session.ws and not session.ws.closed:
                await session.ws.close()
        except Exception:
            pass
        session.ws = None
        session.connected = False

    def _transform_market_data(self, data: dict, symbol_info: SymbolInfo) -> dict:
        """Transform FlatTrade data to chart format"""
        import time
        
        # Extract price data
        ltp = float(data.get("lp", 0) or data.get("c", 0) or 0)
        open_price = float(data.get("o", ltp) or ltp)
        high_price = float(data.get("h", ltp) or ltp)
        low_price = float(data.get("l", ltp) or ltp)
        volume = int(data.get("v", 0) or 0)
        
        # Generate timestamp
        timestamp = int(time.time())
        
        return {
            "symbol": symbol_info.tsym.replace("-EQ", ""),
            "token": symbol_info.token,
            "exchange": symbol_info.exchange,
            "timestamp": timestamp,
            "data": {
                "open": open_price,
                "high": high_price,
                "low": low_price,
                "close": ltp,
                "last_price": ltp,
                "volume": volume,
                "time": timestamp
            },
            "feed_type": "detailed" if data.get("t", "").startswith("d") else "touchline",
            "raw": data
        }

# Global instance
websocket_service = WebSocketService()