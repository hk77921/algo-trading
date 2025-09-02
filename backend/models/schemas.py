# models/schemas.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Authentication Models
class AccessTokenRequest(BaseModel):
    session_token: str

class OAuthCallbackRequest(BaseModel):
    code: Optional[str] = None
    request_token: Optional[str] = None  # Add this field
    request_code: Optional[str] = None
    token: Optional[str] = None
    oauth_code: Optional[str] = None
    state: Optional[str] = None
    oauth_state: Optional[str] = None

class AuthResponse(BaseModel):
    success: bool
    login_url: Optional[str] = None
    state: Optional[str] = None
    session_token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None

# Trading Models
class OrderRequest(BaseModel):
    symbol: str
    quantity: int
    side: str  # BUY or SELL
    order_type: str  # MARKET or LIMIT
    price: Optional[float] = None
    trigger_price: Optional[float] = None
    product: str  # MIS, CNC, etc.

class OrderResponse(BaseModel):
    order_id: str
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None

class OrderHistoryItem(BaseModel):
    order_id: str = ""
    symbol: str = ""
    quantity: int = 0
    side: str = ""
    order_type: str = ""
    price: float = 0.0
    trigger_price: Optional[float] = None
    product: str = ""
    status: str = ""
    order_timestamp: datetime
    filled_quantity: int = 0
    pending_quantity: int = 0
    average_price: Optional[float] = None
    
    class Config:
        from_attributes = True

class Position(BaseModel):
    symbol: str
    quantity: int
    side: str
    entry_price: float
    current_price: float
    pnl: float

class PortfolioStats(BaseModel):
    total_pnl: float
    total_investment: float
    current_value: float
    total_quantity: int
    winning_positions: int
    losing_positions: int
    best_performer: Optional[Position] = None
    worst_performer: Optional[Position] = None

class PortfolioResponse(BaseModel):
    success: bool
    portfolio: List[Position]
    total_pnl: float
    total_investment: float
    current_value: float
    total_quantity: int
    winning_positions: int
    losing_positions: int
    best_performer: Optional[Position] = None
    worst_performer: Optional[Position] = None

# Account Models
class ProductInfo(BaseModel):
    code: str
    name: str
    exchanges: List[str]

class AccountDetails(BaseModel):
    user_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    broker: Optional[str] = None
    exchanges: List[str]
    products: List[ProductInfo]
    order_types: List[str]
    type: Optional[str] = None
    branch: Optional[str] = None

class AccountResponse(BaseModel):
    success: bool
    account: AccountDetails

# Generic Response Models
class SuccessResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    message: Optional[str] = None