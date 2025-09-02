import hashlib
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv
import json
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import secrets
import httpx

# Load environment variables
load_dotenv()

app = FastAPI(title="Trading API", version="1.1.0")

# CORS middleware
app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Models
class FlattradeAuth(BaseModel):
	api_key: str
	api_secret: str
	user_id: str
	password: str

class AccessTokenRequest(BaseModel):
	session_token: str

class OrderRequest(BaseModel):
	symbol: str
	quantity: int
	side: str  # BUY or SELL
	order_type: str  # MARKET or LIMIT
	price: Optional[float] = None

class Position(BaseModel):
	symbol: str
	quantity: int
	side: str
	entry_price: float
	current_price: float
	pnl: float

# Configuration
FLATTRADE_BASE_URL = os.getenv("FLATTRADE_BASE_URL", "https://auth.flattrade.in")
FLATTRADE_API_KEY = os.getenv("FLATTRADE_API_KEY")
FLATTRADE_API_SECRET = os.getenv("FLATTRADE_API_SECRET")
# Frontend callback route - this should match your React app's callback route
FLATTRADE_REDIRECT_URI = os.getenv("FLATTRADE_REDIRECT_URI", "http://localhost:3000/callback")
# IMPORTANT: Configure the token exchange endpoint provided by Flattrade
# Example (update with the official endpoint): https://authapi.flattrade.in/ftauth/token
FLATTRADE_TOKEN_URL = os.getenv("FLATTRADE_TOKEN_URL")
# Flattrade API endpoints for portfolio and market data
FLATTRADE_API_BASE_URL = os.getenv("FLATTRADE_API_BASE_URL", "https://api.flattrade.in")

FLATTRADE_BASE_URL_TRADE = os.getenv("FLATTRADE_BASE_URL_TRADE", "https://piconnect.flattrade.in/PiConnectTP")

SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Global session storage (in production, use Redis or database)
trading_sessions: Dict[str, Dict[str, Any]] = {}
# Map transient OAuth state -> created_at
oauth_states: Dict[str, float] = {}


async def make_flattrade_api_call(endpoint: str, access_token: str, method: str = "GET", payload: Optional[dict] = None, session_data: Optional[dict] = None) -> dict:
	"""Make a call to Flattrade API with proper error handling and auto token refresh"""
	async def make_request(token: str):
		async with httpx.AsyncClient(timeout=15.0) as client:
			headers = {"Authorization": f"Bearer {token}"}
			url = f"{FLATTRADE_API_BASE_URL}{endpoint}"
			
			if method.upper() == "GET":
				return await client.get(url, headers=headers)
			elif method.upper() == "POST":
				return await client.post(url, json=payload, headers=headers)
			else:
				raise ValueError(f"Unsupported HTTP method: {method}")

	try:
		resp = await make_request(access_token)
		
		# If we get a 401 and have session data, try to refresh the token
		if resp.status_code == 401 and session_data:
			try:
				new_token = await get_flattrade_access_token(session_data)
				resp = await make_request(new_token)
			except Exception as refresh_error:
				print(f"Token refresh failed: {str(refresh_error)}")
				raise HTTPException(status_code=401, detail="Session expired and token refresh failed")
		
		if resp.status_code >= 400:
			raise HTTPException(status_code=resp.status_code, detail=f"Flattrade API error: {resp.text}")
		
		return resp.json()
	except Exception as e:
		print(f"Flattrade API call failed for {endpoint}: {str(e)}")
		# Pass through HTTPExceptions
		if isinstance(e, HTTPException):
			raise
		raise HTTPException(status_code=500, detail=str(e))
async def get_flattrade_access_token(session_data: dict) -> str:
	"""Get or refresh Flattrade access token"""
	try:
		# Check if we have a valid cached access token
		if (
			session_data.get("access_token") 
			and session_data.get("access_token_expires_at", 0) > datetime.now(timezone.utc).timestamp()
		):
			return session_data["access_token"]

		if not FLATTRADE_TOKEN_URL:
			raise ValueError("FLATTRADE_TOKEN_URL is not configured")

		
		# Combine API key, request code, and API secret in correct order
		combined_str = str(FLATTRADE_API_KEY) + str(session_data.get("request_code")) + str(FLATTRADE_API_SECRET)
		print(f"Combined string for hashing: {combined_str}")

		# Encode and create SHA-256 hash
		hash_value = hashlib.sha256(combined_str.encode()).hexdigest()
		print(f"SHA-256 hash value: {hash_value}")
		api_secret = hash_value		# Exchange code for access token
		async with httpx.AsyncClient() as client:
			token_response = await client.post(
				str(FLATTRADE_TOKEN_URL),
				data={
					"api_key": FLATTRADE_API_KEY,
					"api_secret": api_secret,
					"request_code": session_data.get("request_code"),
				},
			)

			if token_response.status_code != 200:
				raise HTTPException(
					status_code=status.HTTP_401_UNAUTHORIZED,
					detail="Failed to obtain access token from Flattrade"
				)

			token_data = token_response.json()
			
			session_data["access_token"] = token_data["access_token"]
			
			# Store expiration time (usually 1 hour from now)
			session_data["access_token_expires_at"] = (
				datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))
			).timestamp()

			return session_data["access_token"]

	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Error getting access token: {str(e)}"
		)

@app.post("/api/auth/get-access-token")
async def get_access_token(request: AccessTokenRequest):
	"""Exchange a valid session token for a Flattrade access token"""
	try:
		# Decode and validate session token
		try:
			payload = jwt.decode(request.session_token, SECRET_KEY, algorithms=[ALGORITHM])
			session_id = payload.get("sub")
		except JWTError as e:
			print(f"JWT decode error: {str(e)}")
			raise HTTPException(
				status_code=status.HTTP_401_UNAUTHORIZED,
				detail="Invalid session token"
			)
		
		if not session_id or session_id not in trading_sessions:
			raise HTTPException(
				status_code=status.HTTP_401_UNAUTHORIZED,
				detail="Invalid session"
			)

		session_data = trading_sessions[session_id]
		#
		# Get or refresh the access token
		access_token = await get_flattrade_access_token(session_data)
		
		return {"access_token": access_token}

	except JWTError:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid session token"
		)
	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=str(e)
		)

async def refresh_market_data_for_positions(positions: list, access_token: str) -> list:
	"""Refresh current market prices for portfolio positions"""
	try:
		# Batch fetch market data for all symbols
		symbols = [pos.symbol for pos in positions if pos.symbol]
		if not symbols:
			return positions
		
		# Try to get batch market data
		try:
			market_data = await make_flattrade_api_call(f"/market-data/batch?symbols={','.join(symbols)}", access_token)
		except:
			# Fallback to individual calls
			market_data = {}
		
		# Update positions with fresh market data
		updated_positions = []
		for pos in positions:
			try:
				# Try to get current price from batch data or individual call
				current_price = None
				if market_data and "data" in market_data:
					for item in market_data["data"]:
						if item.get("symbol") == pos.symbol:
							current_price = item.get("last_price") or item.get("ltp")
							break
				
				if current_price is None:
					# Individual call as fallback
					try:
						symbol_data = await make_flattrade_api_call(f"/market-data/{pos.symbol}", access_token)
						current_price = symbol_data.get("last_price") or symbol_data.get("ltp")
					except:
						current_price = pos.current_price  # Keep existing price
				
				# Calculate updated P&L
				updated_pnl = (current_price - pos.entry_price) * pos.quantity
				
				updated_positions.append(Position(
					symbol=pos.symbol,
					quantity=pos.quantity,
					side=pos.side,
					entry_price=pos.entry_price,
					current_price=float(current_price if current_price is not None else 0.0),
					pnl=float(updated_pnl)
				))
			except Exception as e:
				print(f"Failed to update market data for {pos.symbol}: {str(e)}")
				updated_positions.append(pos)  # Keep original position
		
		return updated_positions
	except Exception as e:
		print(f"Failed to refresh market data: {str(e)}")
		return positions  # Return original positions if refresh fails


def calculate_portfolio_stats(positions: list) -> dict:
	"""Calculate portfolio statistics and metrics"""
	if not positions:
		return {
			"total_pnl": 0.0,
			"total_investment": 0.0,
			"current_value": 0.0,
			"total_quantity": 0,
			"winning_positions": 0,
			"losing_positions": 0,
			"best_performer": None,
			"worst_performer": None
		}

	# Calculate totals
	total_pnl = sum(pos.pnl for pos in positions)
	total_investment = sum(pos.entry_price * pos.quantity for pos in positions)
	current_value = sum(pos.current_price * pos.quantity for pos in positions)
	total_quantity = sum(pos.quantity for pos in positions)

	# Count winning and losing positions
	winning_positions = len([pos for pos in positions if pos.pnl > 0])
	losing_positions = len([pos for pos in positions if pos.pnl < 0])

	# Find best and worst performers
	best_performer = max(positions, key=lambda x: x.pnl) if positions else None
	worst_performer = min(positions, key=lambda x: x.pnl) if positions else None

	return {
		"total_pnl": total_pnl,
		"total_investment": total_investment,
		"current_value": current_value,
		"total_quantity": total_quantity,
		"winning_positions": winning_positions,
		"losing_positions": losing_positions,
		"best_performer": best_performer,
		"worst_performer": worst_performer
	}



def create_session_jwt(session_id: str, subject: str) -> str:
	expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
	to_encode = {"sid": session_id, "sub": subject, "exp": expire}
	return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_session_jwt(token: str) -> Optional[Dict[str, Any]]:
	try:
		payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
		return payload
	except JWTError:
		return None


@app.get("/")
async def root():
	return {"message": "Trading API is running"}


@app.get("/api/health")
async def health_check():
	"""Health check endpoint"""
	return {
		"status": "healthy",
		"timestamp": datetime.now(timezone.utc).isoformat(),
		"version": "1.1.0"
	}


@app.get("/api/health/flattrade")
async def flattrade_health_check():
	"""Check Flattrade API connectivity"""
	try:
		if not FLATTRADE_API_KEY or not FLATTRADE_API_SECRET:
			return {
				"status": "unconfigured",
				"message": "Flattrade API credentials not configured",
				"missing": [
					"FLATTRADE_API_KEY" if not FLATTRADE_API_KEY else None,
					"FLATTRADE_API_SECRET" if not FLATTRADE_API_SECRET else None
				]
			}
		
		if not FLATTRADE_TOKEN_URL:
			return {
				"status": "unconfigured",
				"message": "Flattrade token URL not configured",
				"missing": ["FLATTRADE_TOKEN_URL"]
			}
		
		# Try to make a simple API call to check connectivity
		async with httpx.AsyncClient(timeout=5.0) as client:
			resp = await client.get(f"{FLATTRADE_BASE_URL}/health")
			return {
				"status": "connected" if resp.status_code == 200 else "error",
				"flattrade_status": resp.status_code,
				"message": "Flattrade API is accessible" if resp.status_code == 200 else f"Flattrade API returned {resp.status_code}",
				"config": {
					"base_url": FLATTRADE_BASE_URL,
					"api_base_url": FLATTRADE_API_BASE_URL,
					"token_url": FLATTRADE_TOKEN_URL,
					"redirect_uri": FLATTRADE_REDIRECT_URI
				}
			}
	except Exception as e:
		return {
			"status": "error",
			"message": f"Failed to connect to Flattrade API: {str(e)}",
			"config": {
				"base_url": FLATTRADE_BASE_URL,
				"api_base_url": FLATTRADE_API_BASE_URL,
				"token_url": FLATTRADE_TOKEN_URL,
				"redirect_uri": FLATTRADE_REDIRECT_URI
			}
		}


@app.get("/api/auth/flattrade")
async def flattrade_oauth(request: Request, request_token: Optional[str] = None, code: Optional[str] = None, state: Optional[str] = None):
	"""OAuth-like flow for Flattrade.
	- If no request_token/code is provided: returns the broker login URL and a state.
	- If request_token/code is provided (callback): exchanges it for broker access token, mints app session JWT.
	"""
	if not FLATTRADE_API_KEY:
		raise HTTPException(status_code=500, detail="FLATTRADE_API_KEY not configured")

	# Start flow: return login URL with state
	if request_token is None and code is None:
		generated_state = secrets.token_urlsafe(16)
		oauth_states[generated_state] = datetime.now(timezone.utc).timestamp()
		# Use the frontend callback URL, not the backend API endpoint
		redirect_uri = FLATTRADE_REDIRECT_URI
		login_url = f"{FLATTRADE_BASE_URL}/?app_key={FLATTRADE_API_KEY}&redirect_url={redirect_uri}&state={generated_state}"
		print(f"Flattrade login URL: {login_url}")
		return {"success": True, "login_url": login_url, "state": generated_state}

	



@app.post("/api/auth/flattrade/callback")
async def flattrade_callback(request: Request):
	"""Handle OAuth callback from frontend with code and state"""
	try:
		body = await request.json()
		code = body.get("code") or body.get("request_code") or body.get("token") or body.get("oauth_code")
		state = body.get("state") or body.get("oauth_state")
		print(f"Flattrade callback received: code={code}, state={state}")
		broker_tokens = {}
		if not code:
			raise HTTPException(status_code=400, detail="Missing authorization code or request_token")
		
		if not FLATTRADE_API_SECRET:
			raise HTTPException(status_code=500, detail="FLATTRADE_API_SECRET not configured")
		if not FLATTRADE_TOKEN_URL:
			raise HTTPException(status_code=500, detail="FLATTRADE_TOKEN_URL not configured")
		
		# Validate state if provided
		if state and state not in oauth_states:
			raise HTTPException(status_code=400, detail="Invalid or expired state")
		
		# Clean up expired states
		cutoff = datetime.now(timezone.utc).timestamp() - 600
		for s, ts in list(oauth_states.items()):
			if ts < cutoff:
				del oauth_states[s]
		
		if state in oauth_states:
			del oauth_states[state]
		
		# Exchange code for broker access token
		authtoken= None
		session_id = secrets.token_urlsafe(32)
		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				# Adjust payload/headers to match the official Flattrade spec
				# https://pi.flattrade.in/docs
				#new Secret Key ->Api_key|request_code|Api_secret
				# Concatenate strings
				combined_str = str(FLATTRADE_API_KEY)  + str(code) +  str(FLATTRADE_API_SECRET)
				
			
				# Encode and create SHA-256 hash
				api_secret_hash = hashlib.sha256(combined_str.encode()).hexdigest()
				print(f"SHA-256 hash value: {api_secret_hash}")
				
				payload = {
					"api_key": FLATTRADE_API_KEY,
					"request_code": code,
					"api_secret": api_secret_hash,
				}
				print(f"Payload: {payload}")
				resp = await client.post(FLATTRADE_TOKEN_URL, json=payload)
				if resp.status_code >= 400:
					raise HTTPException(status_code=resp.status_code, detail=f"Token exchange failed: {resp.text}")
				broker_tokens = resp.json()
				print(f"Broker tokens received: {broker_tokens}")
				
		
		except HTTPException:
			raise
		except Exception as e:
			raise HTTPException(status_code=502, detail=f"Token exchange error: {str(e)}")
		# Create a new session
		session_id = secrets.token_urlsafe(32)
		# session_data = {
		# 	"auth_code": code,
		# 	"created_at": datetime.now(timezone.utc).timestamp()
		# }
		# trading_sessions[session_id] = session_data

		# # Create a session token
		# expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
		# expire = datetime.now(timezone.utc) + expires_delta
		
		# to_encode = {
		# 	"sub": session_id,
		# 	"exp": expire
		# }
		# session_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

		return {
			"session_token": broker_tokens.get("token"),
			"user": {"id": f"ft_{session_id[:8]}"}  # Create a simple user identifier
		}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Callback processing failed: {str(e)}")


def _extract_session_id_from_bearer_token(bearer_token: str) -> Optional[str]:
	"""Accept our signed JWT or legacy plain session ID."""
	decoded = decode_session_jwt(bearer_token)
	if decoded and "sid" in decoded:
		return decoded["sid"]
	# Fallback legacy: treat provided token as session_id
	return bearer_token


def _extract_broker_access_token(broker_tokens: Dict[str, Any]) -> Optional[str]:
	"""Best-effort extraction of an access token from various broker payload shapes.

	Supports common key variants and nested containers like data/result/payload/response.
	Removes leading 'Bearer ' prefix if present.
	"""

	def _strip_bearer(value: str) -> str:
		val = value.strip()
		return val.split(" ", 1)[1] if val.lower().startswith("bearer ") else val

	candidate_keys = [
		"access_token",
		"accessToken",
		"token",
		"auth_token",
		"jwt",
		"jwt_token",
		"authorization",
		"Authorization",
	]

	def _search(container: Dict[str, Any]) -> Optional[str]:
		for key in candidate_keys:
			value = container.get(key)
			if isinstance(value, str) and value:
				return _strip_bearer(value)
		# Look into common nested shapes
		for nested_key in ("data", "result", "payload", "response"):
			nested = container.get(nested_key)
			if isinstance(nested, dict):
				found = _search(nested)
				if found:
					return found
		return None

	if isinstance(broker_tokens, dict):
		result = _search(broker_tokens)
		if not result:
			try:
				print(f"No access token found in broker_tokens. Available keys: {list(broker_tokens.keys())}")
			except Exception:
				pass
		return result
	return None


@app.get("/api/portfolio")
async def get_portfolio(credentials: HTTPAuthorizationCredentials = Depends(security)):
	"""Get current portfolio positions"""
	print(f"Fetching portfolio... {credentials}", credentials.credentials)
	try:
		# Extract session from bearer
		# session_id = _extract_session_id_from_bearer_token(credentials.credentials)
		# if session_id not in trading_sessions:
		# 	raise HTTPException(
		# 		status_code=status.HTTP_401_UNAUTHORIZED,
		# 		detail="Invalid session"
		# 	)

		# Fetch portfolio from Flattrade API
		print(f"Using session_id: {credentials.credentials}")
		broker_tokens = credentials.credentials  # Use the actual session token
		print(f"Broker tokens: {broker_tokens}")
		
		# Request portfolio data from Flattrade API
		uid = "FZ12004"
		#data = {"uid": uid, "stext": "TCS", "exch": "NSE"}
		data = {"uid": uid, "actid": uid, "prd": "H"}

		endpoint = "/Holdings"
		
		# FIXED: Create payload as raw string matching API documentation
		payload = f'jData={json.dumps(data)}&jKey={broker_tokens}'
		
		url = f'{FLATTRADE_BASE_URL_TRADE}{endpoint}'
		headers = {'Content-Type': 'application/json'}

		print(f"Making API call to {url} with payload: {payload}")

		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				resp = await client.post(
					url, 
					content=payload,  # Use content= for raw string body
					headers=headers
				)
				print(f"Response status: {resp.status_code}, body: {resp.text}")
				
				if resp.status_code >= 400:
					raise HTTPException(status_code=resp.status_code, detail=f"Flattrade API error: {resp.text}")
				
				response_data = resp.json()
				
				# Handle "no data" error response
				if isinstance(response_data, dict) and response_data.get("stat") == "Not_Ok" and "no data" in response_data.get("emsg", "").lower():
					return {
						"success": True,
						"portfolio": [],
						"total_pnl": 0.0,
						"total_investment": 0.0,
						"current_value": 0.0,
						"total_quantity": 0,
						"winning_positions": 0,
						"losing_positions": 0,
						"best_performer": None,
						"worst_performer": None
					}
				
				# Handle empty array response
				if isinstance(response_data, list) and len(response_data) == 0:
					return {
						"success": True,
						"portfolio": [],
						"total_pnl": 0.0,
						"total_investment": 0.0,
						"current_value": 0.0,
						"total_quantity": 0,
						"winning_positions": 0,
						"losing_positions": 0,
						"best_performer": None,
						"worst_performer": None
					}
				
				return response_data
		except Exception as e:
			# Log the error for debugging
			print(f"Flattrade API call failed for {endpoint}: {str(e)}")
			raise e
	
		# Process portfolio data - handle different possible response formats
		portfolio = []
			
			# Try different possible response structures
		positions = (
				portfolio_data.get("positions", []) or 
				portfolio_data.get("holdings", []) or 
				portfolio_data.get("data", {}).get("positions", []) or
				portfolio_data.get("data", {}).get("holdings", []) or
				[]
			)
			
		for item in positions:
			# Handle different field names that Flattrade might use
			symbol = item.get("symbol") or item.get("tradingsymbol") or item.get("scrip_code")
			quantity = item.get("quantity") or item.get("netqty") or item.get("buy_qty", 0) - item.get("sell_qty", 0)
			side = "LONG" if quantity > 0 else "SHORT" if quantity < 0 else "FLAT"
			
			# Calculate or extract entry price
			entry_price = (
				item.get("entry_price") or 
				item.get("average_price") or 
				item.get("buy_price") or
				0.0
			)
			
			# Get current price from market data or use last traded price
			current_price = (
				item.get("current_price") or 
				item.get("last_price") or 
				item.get("ltp") or
				entry_price  # Fallback to entry price if current price not available
			)
			
			# Calculate P&L if not provided
			pnl = item.get("pnl")
			if pnl is None and quantity != 0:
				pnl = (current_price - entry_price) * abs(quantity)
			
			if symbol and quantity != 0:  # Only include positions with actual holdings
				portfolio.append(Position(
					symbol=symbol,
					quantity=abs(quantity),
					side=side,
					entry_price=float(entry_price),
					current_price=float(current_price),
					pnl=float(pnl or 0.0)
				))
			
			# Refresh market data for real-time pricing
			if portfolio:
				portfolio = await refresh_market_data_for_positions(portfolio, access_token)
				
	except Exception as e:
			# Fallback to mock data if Flattrade API fails
			print(f"Using fallback portfolio data due to API error: {str(e)}")
			portfolio = [
				Position(
					symbol="RELIANCE",
					quantity=100,
					side="LONG",
					entry_price=2500.0,
					current_price=2550.0,
					pnl=5000.0
				),
				Position(
					symbol="TCS",
					quantity=50,
					side="LONG",
					entry_price=3500.0,
					current_price=3450.0,
					pnl=-2500.0
				)
			]

	stats = calculate_portfolio_stats(portfolio)

	return {
		"success": True,
		"portfolio": [pos.dict() for pos in portfolio],
		"total_pnl": stats["total_pnl"],
		"total_investment": stats["total_investment"],
		"current_value": stats["current_value"],
		"total_quantity": stats["total_quantity"],
		"winning_positions": stats["winning_positions"],
		"losing_positions": stats["losing_positions"],
		"best_performer": stats["best_performer"],
		"worst_performer": stats["worst_performer"]
	}




@app.post("/api/order")
async def place_order(order: OrderRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
	print(f"Fetching order... {credentials}", credentials.credentials)
	try:
		# Extract session from bearer
		# session_id = _extract_session_id_from_bearer_token(credentials.credentials)
		# if session_id not in trading_sessions:
		# 	raise HTTPException(
		# 		status_code=status.HTTP_401_UNAUTHORIZED,
		# 		detail="Invalid session"
		# 	)

		# Fetch portfolio from Flattrade API
		print(f"Using session_id: {credentials.credentials}")
		broker_tokens = credentials.credentials  # Use the actual session token
		print(f"Broker tokens: {broker_tokens}")
		
		# Request portfolio data from Flattrade API
		uid = "FZ12004"
		#data = {"uid": uid, "stext": "TCS", "exch": "NSE"}
		data = {"uid": uid}

		endpoint = "/OrderBook"
		
		# FIXED: Create payload as raw string matching API documentation
		payload = f'jData={json.dumps(data)}&jKey={broker_tokens}'
		
		url = f'{FLATTRADE_BASE_URL_TRADE}{endpoint}'
		headers = {'Content-Type': 'application/json'}

		print(f"Making API call to {url} with payload: {payload}")

		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				resp = await client.post(
					url, 
					content=payload,  # Use content= for raw string body
					headers=headers
				)
				print(f"Response status: {resp.status_code}, body: {resp.text}")
				
				if resp.status_code >= 400:
					raise HTTPException(status_code=resp.status_code, detail=f"Flattrade API error: {resp.text}")
				
				response_data = resp.json()
				
				# Handle "no data" error response
				if isinstance(response_data, dict) and response_data.get("stat") == "Not_Ok" and "no data" in response_data.get("emsg", "").lower():
					return {
						"success": True,
						"orders": []
					}

				# Handle empty array response
				if isinstance(response_data, list) and len(response_data) == 0:
					return {
						"success": True,
						"orders": []
					}

				return {
					"success": True,
					"orders": response_data
				}
		except Exception as e:
			# Log the error for debugging
			print(f"Flattrade API call failed for {endpoint}: {str(e)}")
			raise e
	except HTTPException as he:
		raise he


@app.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
	"""Get real-time market data for a symbol"""
	try:
		session_id = _extract_session_id_from_bearer_token(credentials.credentials)
		if session_id not in trading_sessions:
			raise HTTPException(
				status_code=status.HTTP_401_UNAUTHORIZED,
				detail="Invalid session"
			)

		# Fetch market data from Flattrade API
		broker_tokens = trading_sessions[session_id]["broker_tokens"]
		access_token = _extract_broker_access_token(broker_tokens)
		if not access_token:
			raise HTTPException(status_code=401, detail="No access token available")

		market_data = await make_flattrade_api_call(f"/market-data/{symbol}", access_token)

		return {
			"success": True,
			"market_data": market_data
		}
	except HTTPException as he:
		raise he
	except Exception as e:
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"Failed to fetch market data: {str(e)}"
		)


@app.get("/api/orders")
async def get_orders(credentials: HTTPAuthorizationCredentials = Depends(security)):
	print(f"Fetching orders... {credentials}", credentials.credentials)
	try:
		# Extract session from bearer
		# session_id = _extract_session_id_from_bearer_token(credentials.credentials)
		# if session_id not in trading_sessions:
		# 	raise HTTPException(
		# 		status_code=status.HTTP_401_UNAUTHORIZED,
		# 		detail="Invalid session"
		# 	)

		# Fetch portfolio from Flattrade API
		print(f"Using session_id: {credentials.credentials}")
		broker_tokens = credentials.credentials  # Use the actual session token
		print(f"Broker tokens: {broker_tokens}")
		
		# Request portfolio data from Flattrade API
		uid = "FZ12004"
		data = {"uid": uid, "actid": uid}
		#data = {"uid": uid}

		endpoint = "/TradeBook"
		
		# FIXED: Create payload as raw string matching API documentation
		payload = f'jData={json.dumps(data)}&jKey={broker_tokens}'
		
		url = f'{FLATTRADE_BASE_URL_TRADE}{endpoint}'
		headers = {'Content-Type': 'application/json'}

		print(f"Making API call to {url} with payload: {payload}")

		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				resp = await client.post(
					url, 
					content=payload,  # Use content= for raw string body
					headers=headers
				)
				print(f"Response status: {resp.status_code}, body: {resp.text}")
				
				if resp.status_code >= 400:
					raise HTTPException(status_code=resp.status_code, detail=f"Flattrade API error: {resp.text}")
				
				return resp.json()
		except Exception as e:
			# Log the error for debugging
			print(f"Flattrade API call failed for {endpoint}: {str(e)}")
			raise e
	except HTTPException as he:
		raise he


@app.get("/api/account")
async def get_account_details(credentials: HTTPAuthorizationCredentials = Depends(security)):
	print(f"Fetching account... {credentials}", credentials.credentials)
	try:
		# Extract session from bearer
		# session_id = _extract_session_id_from_bearer_token(credentials.credentials)
		# if session_id not in trading_sessions:
		# 	raise HTTPException(
		# 		status_code=status.HTTP_401_UNAUTHORIZED,
		# 		detail="Invalid session"
		# 	)

		# Fetch portfolio from Flattrade API
		print(f"Using session_id: {credentials.credentials}")
		broker_tokens = credentials.credentials  # Use the actual session token
		print(f"Broker tokens: {broker_tokens}")
		
		# Request portfolio data from Flattrade API
		uid = "FZ12004"
		#data = {"uid": uid, "stext": "TCS", "exch": "NSE"}
		data = {"uid": uid}

		endpoint = "/UserDetails"
		
		# FIXED: Create payload as raw string matching API documentation
		payload = f'jData={json.dumps(data)}&jKey={broker_tokens}'
		
		url = f'{FLATTRADE_BASE_URL_TRADE}{endpoint}'
		headers = {'Content-Type': 'application/json'}

		print(f"Making API call to {url} with payload: {payload}")

		try:
			async with httpx.AsyncClient(timeout=15.0) as client:
				resp = await client.post(
					url, 
					content=payload,  # Use content= for raw string body
					headers=headers
				)
				print(f"Response status: {resp.status_code}, body: {resp.text}")
				
				if resp.status_code >= 400:
					raise HTTPException(status_code=resp.status_code, detail=f"Flattrade API error: {resp.text}")
				
				response_data = resp.json()
				
				# Handle error response
				if isinstance(response_data, dict) and response_data.get("stat") == "Not_Ok":
					raise HTTPException(status_code=400, detail=response_data.get("emsg", "Error fetching account details"))

				# Handle successful response
				if isinstance(response_data, dict) and response_data.get("stat") == "Ok":
					return {
						"success": True,
						"account": {
							"user_id": response_data.get("uid"),
							"name": response_data.get("uname"),
							"email": response_data.get("email"),
							"phone": response_data.get("m_num"),
							"broker": response_data.get("brkname"),
							"exchanges": response_data.get("exarr", []),
							"products": [
								{
									"code": p.get("prd"),
									"name": p.get("s_prdt_ali"),
									"exchanges": p.get("exch", [])
								}
								for p in response_data.get("prarr", [])
							],
							"order_types": response_data.get("orarr", []),
							"type": response_data.get("uprev"),
							"branch": response_data.get("brnchid")
						}
					}

				return response_data
		except Exception as e:
			# Log the error for debugging
			print(f"Flattrade API call failed for {endpoint}: {str(e)}")
			raise e
	except HTTPException as he:
		raise he


if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8000)
