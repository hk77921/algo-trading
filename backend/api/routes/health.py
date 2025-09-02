from fastapi import APIRouter
from datetime import datetime
from pydantic import BaseModel
from services import health_service
from services.health_service import api_health_service
from models.schemas import HealthResponse

health_service_instance = api_health_service()
router = APIRouter(tags=["Health"])

@router.get("/health", summary="API Health Check", response_model=HealthResponse)
async def health_check():
    """API health check endpoint"""
  
    flattrade_status = await health_service_instance._flattrade_health_check()
    if flattrade_status:
        return flattrade_status
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "message":"API is healthy"
    }



