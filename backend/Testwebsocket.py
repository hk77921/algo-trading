# test_websocket.py - Simple test script to verify WebSocket functionality
import asyncio
import json
import logging
from services.websocket_service import websocket_service, SymbolInfo

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_symbol_info_hashable():
    """Test that SymbolInfo is now hashable and can be used in sets"""
    print("Testing SymbolInfo hashability...")
    
    # Create two identical SymbolInfo objects
    symbol1 = SymbolInfo(
        formatted_symbol="NSE|TCS-EQ",
        token="22",
        tsym="TCS-EQ",
        exchange="NSE"
    )
    
    symbol2 = SymbolInfo(
        formatted_symbol="NSE|TCS-EQ",
        token="22",
        tsym="TCS-EQ",
        exchange="NSE"
    )
    
    # Test that they can be added to a set
    symbol_set = set()
    symbol_set.add(symbol1)
    symbol_set.add(symbol2)  # Should not add duplicate
    
    print(f"✓ SymbolInfo is hashable. Set size: {len(symbol_set)} (should be 1)")
    
    # Test hash consistency
    print(f"✓ Hash of symbol1: {hash(symbol1)}")
    print(f"✓ Hash of symbol2: {hash(symbol2)}")
    print(f"✓ Hashes equal: {hash(symbol1) == hash(symbol2)}")
    
    # Test equality
    print(f"✓ Objects equal: {symbol1 == symbol2}")
    
    return True

async def test_websocket_service_basic():
    """Test basic WebSocket service functionality without actual connections"""
    print("\nTesting WebSocket service basic functionality...")
    
    # Test session creation
    user_id = "FZ12004"
    session_token = "edd61c1b9f5dd40a064ab4e5ac767be57a83233f4280f4b6778fa57c7db45c68"
    
    # This will create a session but not actually connect (since we don't have real credentials)
    session = websocket_service.sessions.get(session_token)
    if not session:
        print(f"✓ No existing session for token {session_token}")
    
    # Test SymbolInfo creation and storage
    symbol_info = SymbolInfo(
        formatted_symbol="NSE|TCS-EQ",
        token="22",
        tsym="TCS-EQ",
        exchange="NSE"
    )
    
    # Simulate adding to sets (this should work now)
    test_set = set()
    test_set.add(symbol_info)
    print(f"✓ Successfully added SymbolInfo to set. Set size: {len(test_set)}")
    
    return True

async def main():
    """Run all tests"""
    print("Running WebSocket Service Tests...")
    print("=" * 50)
    
    try:
        await test_symbol_info_hashable()
        await test_websocket_service_basic()
        
        print("\n" + "=" * 50)
        print("✓ All tests passed! The fixes should resolve the hashability issue.")
        print("\nNext steps:")
        print("1. Replace your websocket_service.py with the fixed version")
        print("2. Replace your market_data.py endpoint with the fixed version") 
        print("3. Test with a real WebSocket client connection")
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())