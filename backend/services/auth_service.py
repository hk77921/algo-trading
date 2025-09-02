# services/auth_service.py
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from jose import jwt, JWTError
from fastapi import HTTPException, status

from config.settings import get_settings
from services.flattrade_client import flattrade_client
from core.logging import get_logger

logger = get_logger(__name__)

class AuthService:
    """Service for authentication and session management"""
    
    def __init__(self):
        self.settings = get_settings()
        # In production, use Redis or database
        self.trading_sessions: Dict[str, Dict[str, Any]] = {}
        self.oauth_states: Dict[str, float] = {}
    
    def generate_oauth_state(self) -> str:
        """Generate OAuth state parameter"""
        state = secrets.token_urlsafe(16)
        self.oauth_states[state] = datetime.now(timezone.utc).timestamp()
        return state
    
    def validate_oauth_state(self, state: str) -> bool:
        """Validate OAuth state parameter"""
        if state not in self.oauth_states:
            return False
        
        # Clean up expired states (10 minutes)
        cutoff = datetime.now(timezone.utc).timestamp() - 600
        for s, ts in list(self.oauth_states.items()):
            if ts < cutoff:
                del self.oauth_states[s]
        
        if state in self.oauth_states:
            del self.oauth_states[state]
            return True
        
        return False
    
    def create_session_jwt(self, session_id: str, subject: str) -> str:
        """Create session JWT token"""
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {"sid": session_id, "sub": subject, "exp": expire}
        return jwt.encode(to_encode, self.settings.SECRET_KEY, algorithm=self.settings.ALGORITHM)
    
    def decode_session_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode and validate session JWT"""
        try:
            payload = jwt.decode(token, self.settings.SECRET_KEY, algorithms=[self.settings.ALGORITHM])
            return payload
        except JWTError as e:
            logger.warning(f"JWT decode error: {str(e)}")
            return None
    
    def get_login_url(self) -> Dict[str, Any]:
        """Generate Flattrade OAuth login URL"""
        if not self.settings.FLATTRADE_API_KEY:
            raise HTTPException(status_code=500, detail="FLATTRADE_API_KEY not configured")
        
        state = self.generate_oauth_state()
        login_url = (
            f"{self.settings.FLATTRADE_BASE_URL}/"
            f"?app_key={self.settings.FLATTRADE_API_KEY}"
            f"&redirect_url={self.settings.FLATTRADE_REDIRECT_URI}"
            f"&state={state}"
        )
        
        logger.info(f"Generated login URL with state: {state}")
        
        return {
            "success": True,
            "login_url": login_url,
            "state": state
        }
    
    async def process_oauth_callback(self, callback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process OAuth callback and exchange code for token"""
        print("Raw callback data received:", callback_data)
        # Add explicit logging for each field
        logger.info(f"Checking fields - code: {callback_data.get('code')}, request_token: {callback_data.get('request_token')}")
        code = (
            callback_data.get("code") or 
            callback_data.get("request_token") or
            callback_data.get("request_code") or 
            callback_data.get("token") or 
            callback_data.get("oauth_code")
        )
        state = callback_data.get("state") or callback_data.get("oauth_state")
        
        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")
        
        if not self.settings.FLATTRADE_API_SECRET:
            raise HTTPException(status_code=500, detail="FLATTRADE_API_SECRET not configured")
        
        if not self.settings.FLATTRADE_TOKEN_URL:
            raise HTTPException(status_code=500, detail="FLATTRADE_TOKEN_URL not configured")
        
        # Validate state if provided
        if state and not self.validate_oauth_state(state):
            raise HTTPException(status_code=400, detail="Invalid or expired state")
        
        logger.info(f"Processing OAuth callback with code: {code[:8]}...")
        
        try:
            # Exchange code for broker token
            broker_tokens = await flattrade_client.exchange_code_for_token(code)
            
            # Create session
            session_id = secrets.token_urlsafe(32)
            
            # Store session data
            self.trading_sessions[session_id] = {
                "auth_code": code,
                "broker_tokens": broker_tokens,
                "created_at": datetime.now(timezone.utc).timestamp()
            }
            
            logger.info(f"Session created: {session_id[:8]}...")
            
            return {
                "success": True,
                "session_token": broker_tokens.get("token"),
                "user": {"id": f"ft_{session_id[:8]}"}
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Callback processing failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Callback processing failed: {str(e)}")
    
    async def get_access_token(self, session_token: str) -> Dict[str, Any]:
        """Get or refresh access token from session token"""
        try:
            # For now, we'll use the session_token directly as it contains the broker token
            # In a more complex setup, you might need to decode the JWT and fetch from storage
            
            return {
                "success": True,
                "access_token": session_token
            }
            
        except Exception as e:
            logger.error(f"Failed to get access token: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def extract_session_from_bearer(self, bearer_token: str) -> Optional[str]:
        """Extract session ID from bearer token"""
        decoded = self.decode_session_jwt(bearer_token)
        if decoded and "sid" in decoded:
            return decoded["sid"]
        # Fallback: treat token as direct session token
        return bearer_token

# Global service instance
auth_service = AuthService()