from datetime import datetime, time
from typing import Union, Dict, Any

def is_market_open() -> bool:
    """Check if market is currently open"""
    now = datetime.now().time()
    market_start = time(9, 15)  # 9:15 AM
    market_end = time(15, 30)   # 3:30 PM
    
    return market_start <= now <= market_end

def format_order_response(raw_response: Dict[str, Any]) -> Dict[str, Any]:
    """Format broker order response to standardized format"""
    return {
        "order_id": raw_response.get("order_id"),
        "status": raw_response.get("status"),
        "message": raw_response.get("message"),
        "exchange_order_id": raw_response.get("exchange_order_id"),
        "placed_at": raw_response.get("placed_at")
    }

def calculate_position_pnl(
    quantity: int,
    average_price: float,
    current_price: float
) -> float:
    """Calculate P&L for a position"""
    return quantity * (current_price - average_price)
