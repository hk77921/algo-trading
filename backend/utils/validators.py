from datetime import datetime
from typing import Union, Optional
from utils.constants import (
    ORDER_TYPE_MARKET, ORDER_TYPE_LIMIT, ORDER_TYPE_SL, ORDER_TYPE_SLM,
    ORDER_SIDE_BUY, ORDER_SIDE_SELL,
    PRODUCT_CNC, PRODUCT_MIS, PRODUCT_NRML
)

def validate_order_type(order_type: str) -> bool:
    """Validate order type"""
    return order_type in (ORDER_TYPE_MARKET, ORDER_TYPE_LIMIT, ORDER_TYPE_SL, ORDER_TYPE_SLM)

def validate_order_side(side: str) -> bool:
    """Validate order side"""
    return side in (ORDER_SIDE_BUY, ORDER_SIDE_SELL)

def validate_product_type(product: str) -> bool:
    """Validate product type"""
    return product in (PRODUCT_CNC, PRODUCT_MIS, PRODUCT_NRML)

def validate_quantity(quantity: int) -> bool:
    """Validate order quantity"""
    return quantity > 0

def validate_price(price: Optional[float], order_type: str) -> bool:
    """Validate order price based on order type"""
    if order_type == ORDER_TYPE_MARKET:
        return True
    return price is not None and price > 0

def validate_trigger_price(trigger_price: Optional[float], order_type: str) -> bool:
    """Validate trigger price for stop loss orders"""
    if order_type in (ORDER_TYPE_SL, ORDER_TYPE_SLM):
        return trigger_price is not None and trigger_price > 0
    return True
