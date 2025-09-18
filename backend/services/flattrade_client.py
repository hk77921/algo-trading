# services/flattrade_client.py
import hashlib
import inspect
import json
import httpx
from typing import Dict, Any, Optional, List
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
                        # Use npoadqty for Net Position Open Adjusted Quantity
                        npoadqty = float(holding.get("npoadqty", "0") or "0")
                        # Use netqty for Net Quantity including T1 holdings
                        netqty = float(holding.get("netqty", "0") or "0")
                        # Use dayqty for intraday positions
                        dayqty = float(holding.get("dayqty", "0") or "0")
                        
                        # Calculate total quantity (use netqty as primary source)
                        total_qty = int(netqty or npoadqty or dayqty)
                        
                        if total_qty <= 0:
                            continue
                            
                        # Get average price for entry price calculation
                        try:
                            # Use avgprc (Average Price) if available, fallback to upldprc (Upload Price)
                            entry_price = float(holding.get("avgprc") or holding.get("upldprc") or "0")
                            if entry_price == 0:
                                # Try other possible price fields
                                entry_price = float(holding.get("buyavgprc") or holding.get("bep") or "0")
                        except (ValueError, TypeError):
                            entry_price = 0.0
                            
                        # Get real-time price using GetQuotes endpoint
                        quote_symbol = str(nse_symbol.get("tsym", ""))
                        current_price = entry_price  # Initialize with entry price as fallback
                        
                        try:
                            live_price = await self.get_live_price(token, quote_symbol)
                            print(f"Live price for {quote_symbol} is {live_price}")
                            if live_price is not None and live_price > 0:
                                current_price = live_price
                                logger.info(f"Got live price for {quote_symbol}: {current_price}")
                            else:
                                logger.warning(f"Could not get current market price for {quote_symbol}, using entry price as fallback")
                        except Exception as e:
                            logger.error(f"Failed to get live price for {quote_symbol}: {str(e)}")
                            logger.warning(f"Using entry price as fallback for {quote_symbol} due to error")

                        # Calculate P&L
                        pnl = (current_price - entry_price) * total_qty if total_qty > 0 and current_price > 0 and entry_price > 0 else 0.0

                        transformed_holding = {
                            "symbol": quote_symbol.replace("-EQ", "").replace("-BE", ""),
                            "quantity": total_qty,
                            "side": "LONG",  # Holdings are always long positions
                            "entry_price": entry_price,
                            "current_price": current_price,
                            "pnl": pnl,
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
        
    async def get_stock_token(self, token: str, symbol: str) -> Optional[str]:
        """Get stock token required for market data API calls
        
        Args:
            token (str): Session token for authentication
            symbol (str): Stock symbol (with or without -EQ/-BE suffix)
            
        Returns:
            Optional[str]: Stock token if found, None otherwise
        """
        try:
            symbol_base = symbol.replace("-EQ", "").replace("-BE", "").upper()
            method_name = inspect.currentframe().f_code.co_name # type: ignore
            #
            scrip_data = {
                "uid": self.settings.DEFAULT_USER_ID,
                "stext": symbol_base,
                "exch": "NSE"
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                scrip_response = await client.post(
                    f"{self.base_url}/SearchScrip",
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=self._create_payload(scrip_data, token)
                )
                scrip_response.raise_for_status()
                scrip_info = scrip_response.json()
                
                if scrip_info.get("stat") != "Ok" or not scrip_info.get("values"):
                    logger.error(f"Failed to get scrip info for {symbol}")
                    return None
                
                #print(f"scrip_info: {scrip_info} and symbol_base: {symbol_base}")
                # Find the exact symbol match, trying different variations
                variations = [
                    f"{symbol_base}-EQ",
                    symbol_base,
                    f"{symbol_base}-BL"
                ]
                
                for item in scrip_info["values"]:
                    if item.get("tsym") in variations:
                        return item.get("token")
               
                logger.error(f"[{method_name}]Could not find token number for {symbol},")
                return None
                
        except Exception as e:
            logger.error(f"[{method_name}]Failed to get stock token for {symbol}: {str(e)}")
            return None

    async def get_live_price(self, token: str, symbol: str) -> Optional[float]:
        """Get real-time last traded price (LTP) for a symbol
        
        Args:
            token (str): Session token for authentication
            symbol (str): Stock symbol (with or without -EQ/-BE suffix)
            
        Returns:
            Optional[float]: Last traded price if available, None otherwise
        """
        try:
            token_number = await self.get_stock_token(token, symbol)
            if not token_number:
                return None
                
            market_data = {
                "uid": self.settings.DEFAULT_USER_ID,
                "exch": "NSE",
                "token": token_number
            }
            #print(f"market_data for live price: {market_data}")
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/GetQuotes",
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=self._create_payload(market_data, token)
                )
                response.raise_for_status()
                
                data = response.json()
                print(f"Live price response data: {data} and its type is {type(data)}")
                if data.get("stat") == "Ok":
                    return float(data.get("lp")) if data.get("lp") else data.get("lp")
                
                
        except Exception as e:
            logger.error(f"Failed to get live price for {symbol}: {str(e)}")
            return None
            
    async def get_market_data(self, token: str, symbol: str) -> Optional[Dict[str, Any]]:
        """Get real-time market data for a symbol"""
        try:
            # Get scrip info first to get the token number
            symbol_base = symbol.replace("-EQ", "").replace("-BE", "").upper()
            token_number = await self.get_stock_token(token, symbol)
            if not token_number:
                return None
                
            # Now get the market data using the token number
            market_data = {
                "uid": self.settings.DEFAULT_USER_ID,
                "exch": "NSE",
                "token": token_number
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Get scrip details first
                scrip_response = await client.post(
                    f"{self.base_url}/SearchScrip",
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=self._create_payload(market_data, token)
                )
                scrip_response.raise_for_status()
                scrip_info = scrip_response.json()
                
                if scrip_info.get("stat") != "Ok" or not scrip_info.get("values"):
                    logger.error(f"Failed to get scrip info for {symbol}")
                    return None
                
                # Find the exact symbol match, trying different variations
                token_number = None
                variations = [
                    f"{symbol_base}-EQ",
                    symbol_base,
                    f"{symbol_base}-BE"
                ]
                
                for item in scrip_info["values"]:
                    if item.get("symbol") in variations:
                        token_number = item.get("token")
                        break
                
                if not token_number:
                    method_name = inspect.currentframe().f_code.co_name # type: ignore
                    logger.error(f"[{method_name}]Could not find token number for {symbol},")
                    return None
                
                # Now get the market data using the token number
                market_data = {
                    "uid": self.settings.DEFAULT_USER_ID,
                    "exch": "NSE",
                    "token": token_number
                }
                
                response = await client.post(
                    f"{self.base_url}/GetQuotes",
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=self._create_payload(market_data, token)
                )
                response.raise_for_status()
                response_data = response.json()
                
                if response_data.get("stat") == "Ok":
                    quote = response_data.get("data", {})
                    if quote:
                        return {
                            "symbol": symbol.replace("-EQ", ""),
                            "token": token_number,
                            "ltp": float(quote.get("lp", 0)),
                            "ltq": int(quote.get("ltq", 0)),
                            "ltt": quote.get("ltt"),
                            "open": float(quote.get("o", 0)),
                            "high": float(quote.get("h", 0)),
                            "low": float(quote.get("l", 0)),
                            "close": float(quote.get("c", 0)),
                            "volume": int(quote.get("v", 0)),
                            "average_price": float(quote.get("ap", 0))
                        }
                return None
                
        except Exception as e:
            logger.error(f"Failed to get market data for {symbol}: {str(e)}")
            return None

    async def get_quote(self, token: str, symbol: str) -> Dict[str, Any]:
        """Get real-time market quote for a symbol"""
        try:
            # Get market data using proper token lookup
            market_data = await self.get_market_data(token, symbol)
            
            if market_data and market_data.get("ltp", 0) > 0:
                logger.info(f"Got market data for {symbol}: LTP = {market_data['ltp']}")
                return {
                    "success": True,
                    "data": {
                        "symbol": market_data["symbol"],
                        "last_price": market_data["ltp"],
                        "open": market_data["open"],
                        "high": market_data["high"],
                        "low": market_data["low"],
                        "close": market_data["close"],
                        "volume": market_data["volume"],
                        "ltt": market_data["ltt"]
                    }
                }
            
            return {
                "success": False,
                "error": "Failed to get quote data",
                "data": None
            }
            
        except Exception as e:
            logger.error(f"Failed to get quote for {symbol}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "data": None
            }
            
    async def search_symbols(self, token: str, query: str) -> List[Dict[str, Any]]:
        """Search for tradeable symbols in NSE
        
        Args:
            token (str): Session token for authentication
            query (str): Search query (e.g. company name or symbol)
            
        Returns:
            List[Dict[str, Any]]: List of matching symbols with their details
            
        Raises:
            HTTPException: If API request fails
        """
        try:
            scrip_data = {
                "uid": self.settings.DEFAULT_USER_ID,
                "stext": query.upper(),
                "exch": "NSE"
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/SearchScrip",
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    content=self._create_payload(scrip_data, token)
                )
                response.raise_for_status()
                
                data = response.json()
                
                if data.get("stat") != "Ok":
                    logger.error(f"Symbol search failed: {data.get('emsg', 'Unknown error')}")
                    return []
                    
                # Transform the response to a more friendly format with additional trading parameters
                symbols = []
                symbols_by_base = {}  # Group symbols by their base name for series preference
                
                # First pass: group symbols by their base name
                for item in data.get("values", []):
                    base_symbol = item.get("symname", "")
                    tsym = item.get("tsym", "")
                    series = tsym.split("-")[-1] if "-" in tsym else "EQ"
                    
                    symbol_info = {
                        "symbol": base_symbol,
                        "display_name": tsym,  # Full symbol with series
                        "name": item.get("cname", ""),
                        "token": item.get("token", ""),
                        "exchange": item.get("exch", "NSE"),
                        "series": series,
                        "instrument": item.get("instname", ""),
                        "lot_size": int(item.get("ls", "1")),
                        "tick_size": float(item.get("ti", "0.05")),
                        "price_precision": int(item.get("pp", "2")),
                    }
                    
                    if base_symbol not in symbols_by_base:
                        symbols_by_base[base_symbol] = []
                    symbols_by_base[base_symbol].append(symbol_info)
                
                # Second pass: select preferred series for each symbol
                for base_symbol, variants in symbols_by_base.items():
                    # Sort variants by series preference (EQ > BE > others)
                    def series_priority(symbol):
                        series = symbol["series"]
                        if series == "EQ":
                            return 0
                        elif series == "BE":
                            return 1
                        else:
                            return 2
                    
                    sorted_variants = sorted(variants, key=series_priority)
                    # Take the preferred variant (first after sorting)
                    if sorted_variants:
                        symbols.append(sorted_variants[0])
                
                # Sort final list by symbol name
                symbols.sort(key=lambda x: x["symbol"])
                return symbols
                
        except httpx.RequestError as e:
            logger.error(f"HTTP request failed during symbol search: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to search endpoint: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Symbol search failed: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to search symbols: {str(e)}"
            )

# Global client instance
flattrade_client = FlattradeClient()