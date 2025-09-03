# config/settings.py
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import List
from typing import Optional
import secrets

class Settings(BaseSettings):
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://trd-integration.centralus.cloudapp.azure.com:3000,http://trd-integration.centralus.cloudapp.azure.com"  # Store as string in env
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        """Convert comma-separated CORS_ORIGINS string to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Flattrade Configuration
    FLATTRADE_API_KEY :str = "30b47befaf514f32ad0a42d458a34e6a"
    FLATTRADE_API_SECRET :str = "28f4f329738f5a95d295e492bbcd93a25ffa18abc1502c70f05532b963b576b4"
    FLATTRADE_BASE_URL: str = "https://auth.flattrade.in"
    FLATTRADE_BASE_URL_TRADE: str = "https://piconnect.flattrade.in/PiConnectTP"
    FLATTRADE_TOKEN_URL: str  = "https://authapi.flattrade.in/trade/apitoken"
    FLATTRADE_REDIRECT_URI: str = "http://localhost:3000/callback"
    
    # Default User ID for API calls
    DEFAULT_USER_ID: str = "FZ12004"
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "use_enum_values": True
    }

@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()