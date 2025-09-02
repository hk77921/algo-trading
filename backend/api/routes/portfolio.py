from fastapi import APIRouter, Depends
from typing import List
from core.dependencies import get_current_session
from models.schemas import Position
from services.portfolio_service import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

@router.get("/positions", response_model=List[Position])
async def get_positions(session_token: str = Depends(get_current_session)):
    """Get current portfolio positions"""
    return await portfolio_service.get_positions(session_token)

@router.get("/holdings", response_model=List[Position])
async def get_holdings(session_token: str = Depends(get_current_session)):
    """Get current holdings"""
    return await portfolio_service.get_holdings(session_token)
