from fastapi import APIRouter, Depends
from typing import Dict, List, Any
from core.dependencies import get_current_session
from services.flattrade_client import flattrade_client

router = APIRouter(prefix="/market", tags=["Market Data"])

@router.get("/quote/{symbol}")
async def get_quote(
    symbol: str,
    session_token: str = Depends(get_current_session)
) -> Dict[str, Any]:
    """Get market quote for a symbol"""
    return await flattrade_client.get_quote(session_token, symbol)

@router.get("/search")
async def search_symbols(
    query: str,
    session_token: str = Depends(get_current_session)
) -> List[Dict[str, Any]]:
    """Search for tradeable symbols"""
    return await flattrade_client.search_symbols(session_token, query)
