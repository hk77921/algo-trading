from fastapi import APIRouter, Depends, HTTPException, status
from services.auth_service import auth_service
from models.schemas import OAuthCallbackRequest, AuthResponse
from core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Authentication"])

@router.get("/flattrade", response_model=AuthResponse)
async def login_flattrade():
    """Generate Flattrade OAuth login URL"""
    return auth_service.get_login_url()

@router.post("/flattrade/callback", response_model=AuthResponse)
async def oauth_callback(callback_data: OAuthCallbackRequest):
    """Handle OAuth callback from Flattrade"""
    try:
        return await auth_service.process_oauth_callback(callback_data.dict())
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OAuth callback failed: {str(e)}"
        )

@router.get("/get-access-token", response_model=AuthResponse)
async def get_access_token(session_token: str):
    """Get access token from session token"""
    return await auth_service.get_access_token(session_token)
