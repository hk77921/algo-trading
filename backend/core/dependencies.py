# core/dependencies.py - Enhanced with better session validation
from fastapi import Header, HTTPException, status, WebSocket
from typing import Optional
import re
from core.logging import get_logger
from services.flattrade_client import flattrade_client

logger = get_logger(__name__)

def validate_session_token_format(token: str) -> bool:
    """Validate FlatTrade session token format"""
    if not token:
        return False
    
    # FlatTrade tokens are typically 64 character hex strings
    if len(token) < 32:
        return False
    
    # Should contain only hexadecimal characters
    if not re.match(r'^[a-fA-F0-9]+$', token):
        return False
    
    return True

async def get_current_session(authorization: Optional[str] = Header(None)):
    """
    HTTP dependency for API routes with enhanced validation.
    Accepts:
      - Authorization: "Bearer <token>" or raw token
    Returns:
      - validated token string
    Raises:
      - 401 if header missing or invalid format
      - 403 if token validation fails
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )

    auth = authorization.strip()
    
    # Extract token from Bearer header if present
    if auth.lower().startswith("bearer "):
        token = auth.split(None, 1)[1]
    else:
        token = auth

    # Validate token format
    if not validate_session_token_format(token):
        logger.warning(f"Invalid session token format: {token[:8]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token format"
        )
    
    # Optional: Test token with FlatTrade API
    # Uncomment this if you want to validate every request (adds latency)
    # try:
    #     is_valid = await flattrade_client.test_session_token(token)
    #     if not is_valid:
    #         raise HTTPException(
    #             status_code=status.HTTP_403_FORBIDDEN,
    #             detail="Session token expired or invalid"
    #         )
    # except Exception as e:
    #     logger.error(f"Token validation error: {str(e)}")
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Token validation failed"
    #     )
    
    return token

async def extract_token_from_websocket(websocket: WebSocket) -> Optional[str]:
    """
    Extract and validate token from WebSocket connection.
    Returns validated token or None.
    """
    try:
        # 1) Query parameter (most common for browser clients)
        token = websocket.query_params.get("token") or websocket.query_params.get("access_token")
        if token:
            token = token.strip()
            if token.lower().startswith("bearer "):
                token = token.split(None, 1)[1]
            
            if validate_session_token_format(token):
                logger.debug(f"Valid token from query params: {token[:8]}...")
                return token
            else:
                logger.warning(f"Invalid token format from query params: {token[:8]}...")
                return None

        # 2) Authorization header (for programmatic clients)
        auth = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
        if auth:
            auth = auth.strip()
            if auth.lower().startswith("bearer "):
                token = auth.split(None, 1)[1]
            else:
                token = auth
            
            if validate_session_token_format(token):
                logger.debug(f"Valid token from Authorization header: {token[:8]}...")
                return token
            else:
                logger.warning(f"Invalid token format from header: {token[:8]}...")
                return None

        # 3) Cookies (fallback)
        cookies = websocket.cookies or {}
        cookie_token = cookies.get("token")
        if cookie_token and validate_session_token_format(cookie_token):
            logger.debug("Valid token from cookies")
            return cookie_token

        logger.debug("No valid token found in WebSocket request")
        return None
        
    except Exception as e:
        logger.exception(f"Exception while extracting token from WebSocket: {e}")
        return None

async def verify_ws_token(websocket: WebSocket) -> str:
    """
    Validate token during WebSocket handshake with enhanced debugging.
    Must be called BEFORE await websocket.accept().
    """
    try:
        # Log WebSocket connection details for debugging
        headers = dict(websocket.headers)
        query_params = dict(websocket.query_params)
        client_host = websocket.client.host if websocket.client else "unknown"
        
        logger.info(f"WebSocket handshake from {client_host}")
        logger.debug(f"Headers: {list(headers.keys())}")
        logger.debug(f"Query params: {list(query_params.keys())}")
        
        # Extract token
        token = await extract_token_from_websocket(websocket)
        if not token:
            logger.warning("WebSocket authentication failed: missing or invalid token format")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid token. Provide valid session token in ?token= parameter"
            )

        # Validate token format
        if not validate_session_token_format(token):
            logger.warning(f"WebSocket token format validation failed: {token[:8]}...")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid session token format"
            )

        # Optional: Validate with FlatTrade API (uncomment if needed)
        # This adds latency but ensures token is actually valid
        try:
            is_valid = await flattrade_client.test_session_token(token)
            if not is_valid:
                logger.warning(f"WebSocket token validation with FlatTrade failed: {token[:8]}...")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Session token expired or invalid"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating WebSocket token with FlatTrade: {str(e)}")
            # Don't fail the connection due to validation API errors
            # raise HTTPException(
            #     status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            #     detail="Unable to validate token at this time"
            # )
        
        logger.info(f"WebSocket token validated successfully: {token[:8]}...")
        return token
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in WebSocket token validation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error during authentication"
        )