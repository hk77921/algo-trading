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

# FLATTRADE_API_KEY = os.getenv("FLATTRADE_API_KEY")
# FLATTRADE_API_SECRET = os.getenv("FLATTRADE_API_SECRET")

callback_token = '185dc75e1a8927f8.ca6495e850f23a41820b5cb3c04c6c13c8e6cd1216b355f442b54aa3b57e7292'
#combined_str = (FLATTRADE_API_KEY,callback_token,FLATTRADE_API_SECRET) 
combined_str = "30b47befaf514f32ad0a42d458a34e6a185dc75e1a8927f8.ca6495e850f23a41820b5cb3c04c6c13c8e6cd1216b355f442b54aa3b57e72921d31f688d04827e3b05a4927e55746c7fcd3850bf08cedc40d20d22d76fb7eb3"
local_has=hashlib.sha256(combined_str.encode()).hexdigest()
print("local hash",local_has)


def generate_hash(api_key, callback_token, api_secret, separator=""):
   

    raw_string = f"{api_key.strip()}{callback_token.strip()}{api_secret.strip()}"
    
    # Debugging: show string and its bytes
    print("Raw string repr:", repr(raw_string))
    print("Raw string bytes:", list(raw_string.encode("utf-8")))
    
    hash_object = hashlib.sha256(raw_string.encode("utf-8"))
    return hash_object.hexdigest()

# Example usage
FLATTRADE_API_KEY = "641e96876276489990e43424e6efa017"
callback_token = "185e26c58440b898.0818042203eeb8362f3bb882cdd5057178774df3bbd8eb0c75bd4fba2551f9f3"
FLATTRADE_API_SECRET = "2025.b769e554efe94f169bd55676b2cbf5a403a3386f4b2e9380"
def diff_strings(s1, s2):
    print("String 1 repr:", repr(s1))
    print("String 2 repr:", repr(s2))
    print()

    min_len = min(len(s1), len(s2))
    for i in range(min_len):
        if s1[i] != s2[i]:
            print(f"Difference at position {i}: '{s1[i]}' (ord {ord(s1[i])}) "
                  f"vs '{s2[i]}' (ord {ord(s2[i])})")

    if len(s1) != len(s2):
        print(f"\nStrings have different length: {len(s1)} vs {len(s2)}")

# Example usage:
python_string = f"{FLATTRADE_API_KEY}{callback_token}{FLATTRADE_API_SECRET}"
online_tool_string = "18efcbf33b13434d98928d06106b8516f5673c4018ff20.132d5a6daacaeb11ddcdb95abe68bb8ea646f5d7d7d462022.7af7d7232dcf4bc39c4ddfb22d388813ab1c7"

#diff_strings(python_string, online_tool_string)


hash_value = generate_hash(FLATTRADE_API_KEY, callback_token, FLATTRADE_API_SECRET)
print("SHA-256 Hash:", hash_value)


if __name__ == "__main__":
    print("hash_value")
    