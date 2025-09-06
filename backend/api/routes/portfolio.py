
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from fastapi.encoders import jsonable_encoder
from core.dependencies import get_current_session
from core.logging import get_logger
from models.schemas import Position
from services.portfolio_service import portfolio_service

logger = get_logger(__name__)

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

@router.get("/positions", response_model=List[Position])
async def get_positions(session_token: str = Depends(get_current_session)):
    """Get current portfolio positions"""
    portfolio_data = await portfolio_service.get_portfolio(session_token)
    print('Portfolio Data in get_positions:', portfolio_data)
    return portfolio_data.get("portfolio", [])


# Endpoint for portfolio stats and positions (for Portfolio.js)
@router.get("", tags=["Portfolio"])
async def get_portfolio(session_token: str = Depends(get_current_session)):
    """Get portfolio stats and positions for dashboard"""
    try:
        data = await portfolio_service.get_portfolio(session_token)
        print('Portfolio Data in get_portfolio:', data)
        return jsonable_encoder(data)
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "portfolio": [],
            "total_pnl": 0,
            "total_investment": 0,
            "current_value": 0,
            "total_quantity": 0,
            "winning_positions": 0,
            "losing_positions": 0,
            "best_performer": None,
            "worst_performer": None
        }

@router.get("/holdings", response_model=List[Position])
async def get_holdings(session_token: str = Depends(get_current_session)):
    """Get current holdings"""
    try:
        return await portfolio_service.get_holdings(session_token)
    except HTTPException as he:
        logger.error(f"HTTP error in get_holdings: {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in get_holdings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
