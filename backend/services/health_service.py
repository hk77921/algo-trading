
# services/health_service.py
from datetime import datetime
from typing import Dict, Any
from fastapi import HTTPException
import httpx
from config.settings import get_settings
from core.logging import get_logger

logger = get_logger(__name__) 

class api_health_service:
    """Client  Flattrade API health check operations"""
    def __init__(self):
        self.start_time = datetime.utcnow()
        self.settings = get_settings()

    async def initialize(self):
        try:
            # Validate required settings
            return await self._flattrade_health_check()
        except Exception as e:
            logger.error(f"Failed to initialize HealthService: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize HealthService: {str(e)}"
            )
    async def _flattrade_health_check(self):
    
        try:
            if not self.settings.FLATTRADE_API_KEY or not self.settings.FLATTRADE_API_SECRET:
                return {
                    "status": "unconfigured",
                    "message": "Flattrade API credentials not configured",
                    "timestamp": datetime.utcnow().isoformat(),
                    "version": "1.0.0",
                    "missing": [
                        "FLATTRADE_API_KEY" if not self.settings.FLATTRADE_API_KEY else None,
                        "FLATTRADE_API_SECRET" if not self.settings.FLATTRADE_API_SECRET else None
                    ]
                }
            
            if not self.settings.FLATTRADE_TOKEN_URL:
                return {
                    "status": "unconfigured",
                    "message": "Flattrade token URL not configured",
                    "timestamp": datetime.utcnow().isoformat(),
                    "version": "1.0.0",
                    "missing": ["FLATTRADE_TOKEN_URL"]
                }
            
            # Try to make a simple API call to check connectivity
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.settings.FLATTRADE_BASE_URL}/health")
                return {
                    "status": "connected" if resp.status_code == 200 else "error",
                    "flattrade_status": resp.status_code,
                    "message": "Flattrade API is accessible" if resp.status_code == 200 else f"Flattrade API returned {resp.status_code}",
                    "timestamp": datetime.utcnow().isoformat(),
                    "version": "1.0.0",
                    "config": {
                        "base_url": self.settings.FLATTRADE_BASE_URL,
                        "token_url": self.settings.FLATTRADE_TOKEN_URL,
                        "redirect_uri": self.settings.FLATTRADE_REDIRECT_URI
                    }
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to connect to Flattrade API: {str(e)}",
                "timestamp": datetime.utcnow().isoformat(),
                "version": "1.0.0",
                "config": {
                    "base_url": self.settings.FLATTRADE_BASE_URL,
                    "token_url": self.settings.FLATTRADE_TOKEN_URL,
                    "redirect_uri": self.settings.FLATTRADE_REDIRECT_URI
                }
        }
#global instance
health_service = api_health_service()