# debug_session.py - Script to debug session token issues
import asyncio
import json
import httpx
from datetime import datetime, timedelta

# Replace these with your actual values
FLATTRADE_BASE_URL = "https://piconnect.flattrade.in/PiConnectTP"
USER_ID = "FZ12004"

async def test_session_token(session_token: str):
    """Test session token validity with various API calls"""
    print(f"Testing session token: {session_token[:8]}...{session_token[-6:]}")
    print("=" * 60)
    
    # Test 1: UserDetails (lightweight test)
    print("1. Testing UserDetails API...")
    try:
        data = {"uid": USER_ID}
        payload = f'jData={json.dumps(data)}&jKey={session_token}'
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{FLATTRADE_BASE_URL}/UserDetails",
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                content=payload
            )
            
            print(f"   Status: {response.status_code}")
            result = response.json()
            print(f"   Response: {result}")
            
            if response.status_code == 200 and result.get("stat") == "Ok":
                print("   ✓ UserDetails API - SUCCESS")
                user_name = result.get("uname", "Unknown")
                print(f"   ✓ User: {user_name}")
                return True
            else:
                print("   ✗ UserDetails API - FAILED")
                return False
                
    except Exception as e:
        print(f"   ✗ UserDetails API - ERROR: {e}")
        return False

async def test_symbol_search(session_token: str, symbol: str = "TCS"):
    """Test symbol search API"""
    print(f"\n2. Testing SearchScrip API for {symbol}...")
    try:
        data = {
            "uid": USER_ID,
            "stext": symbol,
            "exch": "NSE"
        }
        payload = f'jData={json.dumps(data)}&jKey={session_token}'
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{FLATTRADE_BASE_URL}/SearchScrip",
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                content=payload
            )
            
            print(f"   Status: {response.status_code}")
            result = response.json()
            
            if response.status_code == 200 and result.get("stat") == "Ok":
                print("   ✓ SearchScrip API - SUCCESS")
                values = result.get("values", [])
                print(f"   ✓ Found {len(values)} results")
                
                if values:
                    for item in values[:3]:  # Show first 3 results
                        print(f"     - {item.get('tsym')} (Token: {item.get('token')})")
                    
                    # Return first token for testing
                    return values[0].get("token")
            else:
                print("   ✗ SearchScrip API - FAILED")
                print(f"   Error: {result}")
                return None
                
    except Exception as e:
        print(f"   ✗ SearchScrip API - ERROR: {e}")
        return None

async def test_historical_data(session_token: str, token: str):
    """Test historical data API with token"""
    print(f"\n3. Testing TPSeries API with token {token}...")
    try:
        # Calculate time range (last 7 days)
        end_time = int(datetime.now().timestamp())
        start_time = int((datetime.now() - timedelta(days=7)).timestamp())
        
        data = {
            "uid": USER_ID,
            "exch": "NSE",
            "token": str(token),  # Use token number, not symbol
            "st": str(start_time),
            "et": str(end_time),
            "intrv": "15"
        }
        payload = f'jData={json.dumps(data)}&jKey={session_token}'
        
        print(f"   Request data: {data}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{FLATTRADE_BASE_URL}/TPSeries",
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                content=payload
            )
            
            print(f"   Status: {response.status_code}")
            result = response.json()
            
            if response.status_code == 200:
                if isinstance(result, list) and len(result) > 0:
                    print("   ✓ TPSeries API - SUCCESS")
                    print(f"   ✓ Got {len(result)} candles")
                    print(f"   Sample data: {result[0] if result else 'No data'}")
                    return True
                elif isinstance(result, dict) and result.get("stat") == "Not_Ok":
                    print("   ✗ TPSeries API - FAILED")
                    print(f"   Error: {result.get('emsg')}")
                    return False
                else:
                    print("   ⚠ TPSeries API - No data")
                    return True
            else:
                print("   ✗ TPSeries API - HTTP ERROR")
                print(f"   Response: {result}")
                return False
                
    except Exception as e:
        print(f"   ✗ TPSeries API - ERROR: {e}")
        return False

async def validate_token_format(session_token: str):
    """Validate token format"""
    print(f"\n0. Validating token format...")
    print(f"   Length: {len(session_token)}")
    print(f"   Is alphanumeric: {session_token.replace('-', '').replace('_', '').isalnum()}")
    print(f"   First 10 chars: {session_token[:10]}")
    print(f"   Last 10 chars: {session_token[-10:]}")
    
    if len(session_token) < 32:
        print("   ⚠ Warning: Token seems short (< 32 chars)")
    if not session_token.replace('-', '').replace('_', '').isalnum():
        print("   ⚠ Warning: Token contains non-alphanumeric chars (excluding - and _)")

async def debug_session_issue():
    """Main debug function"""
    print("FlatTrade Session Token Debug Tool")
    print("=" * 60)
    
    # You can either hardcode the token here or read from environment
    # Replace with your actual session token
    session_token = input("Enter your session token: ").strip()
    
    if not session_token:
        print("No session token provided!")
        return
    
    # Validate format
    await validate_token_format(session_token)
    
    # Test basic API
    is_valid = await test_session_token(session_token)
    if not is_valid:
        print("\n❌ Session token is invalid or expired!")
        print("Please check:")
        print("1. Token is not expired")
        print("2. Token format is correct")
        print("3. User ID matches the token")
        return
    
    # Test symbol search
    token = await test_symbol_search(session_token, "TCS")
    if not token:
        print("\n❌ Symbol search failed!")
        return
    
    # Test historical data
    success = await test_historical_data(session_token, token)
    if success:
        print("\n✅ All tests passed! Your session token is working correctly.")
    else:
        print("\n❌ Historical data test failed!")
    
    print("\n" + "=" * 60)
    print("Debug completed.")

if __name__ == "__main__":
    asyncio.run(debug_session_issue())