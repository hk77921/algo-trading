from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from typing import List, Dict, Any
from core.dependencies import get_current_session
from models.schemas import OrderRequest
from models.schemas import OrderHistoryItem
from services.portfolio_service import portfolio_service
from services.flattrade_client import flattrade_client
from utils.validators import (
    validate_order_type,
    validate_order_side,
    validate_product_type,
    validate_quantity,
    validate_price,
    validate_trigger_price
)

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("/place")
async def place_order(
    order: OrderRequest,
    session_token: str = Depends(get_current_session)
) -> Dict[str, Any]:
    """Place a new order"""
    # Validate order parameters
    if not validate_order_type(order.order_type):
        raise HTTPException(status_code=400, detail="Invalid order type")
    if not validate_order_side(order.side):
        raise HTTPException(status_code=400, detail="Invalid order side")
    if not validate_product_type(order.product):
        raise HTTPException(status_code=400, detail="Invalid product type")
    if not validate_quantity(order.quantity):
        raise HTTPException(status_code=400, detail="Invalid quantity")
    if not validate_price(order.price, order.order_type):
        raise HTTPException(status_code=400, detail="Invalid price")
    if not validate_trigger_price(order.trigger_price, order.order_type):
        raise HTTPException(status_code=400, detail="Invalid trigger price")
    
    return await portfolio_service.place_order(session_token, order)

@router.get("/history", response_model=Dict[str, List[OrderHistoryItem]])
async def get_order_history(session_token: str = Depends(get_current_session)) -> Dict[str, List[OrderHistoryItem]]:
    """Get order history"""
    raw_orders = await portfolio_service.get_order_history(session_token)
    # raw_orders is a list of OrderHistoryItem objects
    # Use jsonable_encoder to ensure datetime is converted to ISO string
    return {"orders": jsonable_encoder(raw_orders)}
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