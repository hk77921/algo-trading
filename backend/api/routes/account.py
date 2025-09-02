from fastapi import APIRouter, Depends
from typing import Dict, Any
from core.dependencies import get_current_session
from services.flattrade_client import flattrade_client

router = APIRouter(prefix="/account", tags=["Account"])

@router.get("/user-details")
async def get_user_details(session_token: str = Depends(get_current_session)) -> Dict[str, Any]:
    """Get detailed user account information"""
    return await flattrade_client.get_user_details(session_token)

@router.get("/holdings")
async def get_holdings(session_token: str = Depends(get_current_session)) -> Dict[str, Any]:
    """Get current portfolio holdings"""
    return await flattrade_client.get_holdings(session_token)

from services.portfolio_service import portfolio_service

@router.get("/orders")
async def get_order_book(session_token: str = Depends(get_current_session)) -> Dict[str, Any]:
    """Get order book details, mapped to internal schema for frontend consistency"""
    raw_orders = await flattrade_client.get_order_book(session_token)
    # raw_orders is expected to be a dict with a 'data' key or a list
    orders_data = []
    if isinstance(raw_orders, dict):
        orders_data = raw_orders.get("data", [])
        if not isinstance(orders_data, list):
            orders_data = []
    elif isinstance(raw_orders, list):
        orders_data = raw_orders
    else:
        orders_data = []

    # Map each order to the internal schema
    mapped_orders = []
    for order in orders_data:
        try:
            parsed = portfolio_service.parse_order_data(order)
            if parsed:
                mapped_orders.append(parsed)
        except Exception:
            continue
    return {"orders": mapped_orders}

@router.get("/trades")
async def get_trade_book(session_token: str = Depends(get_current_session)) -> Dict[str, Any]:
    """Get trade book details"""
    return await flattrade_client.get_trade_book(session_token)
