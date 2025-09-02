from fastapi import Depends, Header, HTTPException, status
from typing import Optional
from services.auth_service import auth_service

async def get_current_session(authorization: Optional[str] = Header(None)):
    """
    FastAPI dependency to validate session token from Authorization header
    
    Args:
        authorization: Authorization header value
        
    Returns:
        str: Session token if valid
        
    Raises:
        HTTPException: If no valid authorization token is provided
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authorization token provided"
        )
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme"
            )
        return token
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format"
        )
