# services/flattrade_client.py
import hashlib
import json
import httpx
from typing import Dict, Any, Optional
from fastapi import HTTPException

from config.settings import get_settings
from core.logging import get_logger

logger = get_logger(__name__)

class FlattradeClient:
    """Client for Flattrade API operations"""
    
    def __init__(self):
        try:
            self.settings = get_settings()
            
            # Validate required settings
            if not self.settings.FLATTRADE_API_KEY:
                raise ValueError("FLATTRADE_API_KEY is not configured")
            if not self.settings.FLATTRADE_API_SECRET:
                raise ValueError("FLATTRADE_API_SECRET is not configured")
            if not self.settings.FLATTRADE_TOKEN_URL:
                raise ValueError("FLATTRADE_TOKEN_URL is not configured")
                
            self.base_url = self.settings.FLATTRADE_BASE_URL_TRADE
            self.token_url = self.settings.FLATTRADE_TOKEN_URL
            self.api_key = self.settings.FLATTRADE_API_KEY
            self.api_secret = self.settings.FLATTRADE_API_SECRET
            self.timeout = 15.0
            
        except Exception as e:
            logger.error(f"Failed to initialize FlattradeClient: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to initialize Flattrade client: {str(e)}"
            )
    
    def _create_api_secret_hash(self, request_code: str) -> str:
        """Create SHA-256 hash for API authentication"""
        combined_str = f"{self.api_key}{request_code}{self.api_secret}"
        return hashlib.sha256(combined_str.encode()).hexdigest()
    
    def _create_payload(self, data: Dict[str, Any], token: str) -> str:
        """Create payload dict for Flattrade API"""
       
       # FIXED: Create payload as raw string matching API documentation
        payload = f'jData={json.dumps(data)}&jKey={token}'
        return payload
    
    async def exchange_code_for_token(self, request_code: str) -> str:
        """Exchange request code for access token"""
        try:
            api_secret = self._create_api_secret_hash(request_code)
            data = {
                'api_key': self.api_key,
                'request_code': request_code,
                'api_secret': api_secret
            }
            
            logger.debug(f"Token URL: {self.token_url}")
            logger.debug(f"Request data: {json.dumps(data)}")
            print(f"Request data: {json.dumps(data)}")
            print(f"token_url: {self.token_url}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.token_url,
                    headers={
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    json=data
                )
                print(f"Response : {response}")
                print(f"Response status code: {response.status_code}")
                print(f"Response content: {response.text}")
                
                if response.status_code != 200:
                    logger.error(f"Token exchange failed with status {response.status_code}")
                    logger.error(f"Response content: {response.text}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Token exchange failed: {response.text}"
                    )
                
                try:
                    return response.json()
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON response. Response content: {response.text}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Invalid JSON response from token endpoint: {str(e)}"
                    )
                    
        except httpx.RequestError as e:
            logger.error(f"HTTP request failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to token endpoint: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Failed to exchange code for token: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to exchange code for token: {str(e)}"
            )

    async def place_order(self, token: str, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Place a new order"""
        try:
            endpoint = f"{self.base_url}/placeOrder"
            payload = self._create_payload(order_data, token)
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to place order: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to place order: {str(e)}"
            )

    async def get_order_history(self, token: str) -> Dict[str, Any]:
        """Get order history"""
        try:
            endpoint = f"{self.base_url}/OrderBook"
            #payload = self._create_payload({}, token)
            uid = "FZ12004"  # Replace with actual user ID as needed
            data = {"uid": uid}
            payload = f'jData={json.dumps(data)}&jKey={token}'
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    endpoint,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=payload
                )
                response.raise_for_status()
                
                if not response.content:
                    return {"success": True, "data": [], "message": "No orders found"}
                    
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get order history: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get order history: {str(e)}"
            )
        """Exchange authorization code for access token"""
        try:
            api_secret_hash = self._create_api_secret_hash(request_code)
            
            payload = {
                "api_key": self.api_key,
                "request_code": request_code,
                "api_secret": api_secret_hash,
            }
            
            logger.info(f"Exchanging code for token with payload: {payload}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(self.token_url, json=payload)
                
                if resp.status_code >= 400:
                    logger.error(f"Token exchange failed: {resp.status_code} - {resp.text}")
                    raise HTTPException(
                        status_code=resp.status_code,
                        detail=f"Token exchange failed: {resp.text}"
                    )
                
                token_data = resp.json()
                logger.info("Token exchange successful")
                return token_data
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token exchange error: {str(e)}")
            raise HTTPException(status_code=502, detail=f"Token exchange error: {str(e)}")
    
    async def make_api_call(
        self, 
        endpoint: str, 
        token: str, 
        data: Optional[Dict[str, Any]] = None,
        method: str = "POST"
    ) -> Dict[str, Any]:
        """Make authenticated API call to Flattrade"""
        try:
            url = f"{self.base_url}{endpoint}"
            logger.debug(f"Making API call to: {url}")
            
            if data is None:
                data = {"uid": self.settings.DEFAULT_USER_ID}
            
            payload = self._create_payload(data, token)
            headers = {'Content-Type': 'application/json'}
            
            logger.info(f"Making API call to {endpoint}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method.upper() == "POST":
                    resp = await client.post(url, content=payload, headers=headers)
                else:
                    resp = await client.get(url, headers=headers)
                
                logger.info(f"API response: {resp.status_code}")
                
                if resp.status_code >= 400:
                    logger.error(f"API call failed: {resp.status_code} - {resp.text}")
                    raise HTTPException(
                        status_code=resp.status_code,
                        detail=f"Flattrade API error: {resp.text}"
                    )
                
                response_data = resp.json()
                #print('response_data-->', response_data)
                
                # Handle "no data" error response
                if (isinstance(response_data, dict) and 
                    response_data.get("stat") == "Not_Ok" and 
                    "no data" in response_data.get("emsg", "").lower()):
                    return {"success": True, "data": [], "message": "No data available"}
                
                # Handle error response
                if isinstance(response_data, dict) and response_data.get("stat") == "Not_Ok":
                    raise HTTPException(
                        status_code=400,
                        detail=response_data.get("emsg", "API call failed")
                    )
                
                return response_data
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"API call failed for {endpoint}: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def get_holdings(self, token: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get portfolio holdings"""
        try:
            data = {
                "uid": user_id or self.settings.DEFAULT_USER_ID,
                "actid": user_id or self.settings.DEFAULT_USER_ID,
                "prd": "C"
            }
            response = await self.make_api_call("/Holdings", token, data)
            logger.debug(f"Raw holdings response: {response}")
            
            # Transform the Flattrade response to match our frontend structure
            transformed_holdings = []
            
            if isinstance(response, list):
                for holding_data in response:
                    try:
                        # Ensure we're working with a dictionary
                        if not isinstance(holding_data, dict):
                            continue
                            
                        holding: Dict[str, Any] = holding_data
                            
                        # Extract NSE symbol details
                        exch_tsym_data = holding.get("exch_tsym", [])
                        if not isinstance(exch_tsym_data, list):
                            continue
                            
                        # Find NSE symbol in exchange list
                        nse_symbol = None
                        for sym in exch_tsym_data:
                            if isinstance(sym, dict) and sym.get("exch") == "NSE":
                                nse_symbol = sym
                                break
                        
                        if not nse_symbol:
                            continue
                            
                        # Get quantities with proper type handling
                        npoadqty = str(holding.get("npoadqty", "0"))
                        benqty = str(holding.get("benqty", "0"))
                        holdqty = str(holding.get("holdqty", "0"))
                        
                        # Calculate total quantity
                        total_qty = sum(int(qty) for qty in [npoadqty, benqty, holdqty] if str(qty).isdigit())
                        
                        if total_qty <= 0:
                            continue
                            
                        # Get price information with safe conversion
                        try:
                            upld_price = float(holding.get("upldprc", 0))
                        except (ValueError, TypeError):
                            upld_price = 0.0
                        
                        transformed_holding = {
                            "symbol": str(nse_symbol.get("tsym", "")).replace("-EQ", "").replace("-BE", ""),
                            "quantity": total_qty,
                            "side": "LONG",  # Holdings are always long positions
                            "entry_price": upld_price,
                            "current_price": upld_price,  # We'll need to fetch current price separately
                            "pnl": 0.0,  # Will calculate once we have current price
                            "exchange": "NSE",
                            "product": str(holding.get("s_prdt_ali", "CNC"))
                        }
                        transformed_holdings.append(transformed_holding)
                        
                    except Exception as e:
                        logger.error(f"Error processing holding: {e}")
                        continue
                        
            return {
                "success": True,
                "data": transformed_holdings
            }
                
        except Exception as e:
            logger.error(f"Error fetching holdings: {str(e)}")
            return {
                "success": False,
                "data": [],
                "error": str(e)
            }
    
    async def get_order_book(self, token: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get order book"""
        data = {"uid": user_id or self.settings.DEFAULT_USER_ID}
        return await self.make_api_call("/OrderBook", token, data)
    
    async def get_trade_book(self, token: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get trade book"""
        data = {
            "uid": user_id or self.settings.DEFAULT_USER_ID,
            "actid": user_id or self.settings.DEFAULT_USER_ID
        }
        return await self.make_api_call("/TradeBook", token, data)
    
    async def get_user_details(self, token: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get user account details"""
        data = {"uid": user_id or self.settings.DEFAULT_USER_ID}
        response = await self.make_api_call("/UserDetails", token, data)
        
        if isinstance(response, dict) and response.get("stat") == "Ok":
            return {
                "success": True,
                "account": {
                    "user_id": response.get("uid"),
                    "name": response.get("uname"),
                    "email": response.get("email"),
                    "m_num": response.get("m_num"),
                    "pan": response.get("pan"),
                    "exchanges": response.get("exarr", []),
                    "products": [
                        {
                            "code": p.get("prd"),
                            "name": p.get("s_prdt_ali"),
                            "exchanges": p.get("exch", [])
                        }
                        for p in response.get("prarr", [])
                    ],
                    "order_types": response.get("orarr", []),
                    "account_type": response.get("actid_type"),
                }
            }
        
        return {"success": False, "account": None, "error": "Failed to fetch user details"}
    

# Global client instance
flattrade_client = FlattradeClient()