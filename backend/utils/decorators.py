import functools
import time
from typing import Callable
from core.logging import get_logger

logger = get_logger(__name__)

def retry(max_attempts: int = 3, delay: float = 1.0):
    """
    Retry decorator for functions that may fail temporarily
    
    Args:
        max_attempts: Maximum number of retry attempts
        delay: Delay between attempts in seconds
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"Attempt {attempt + 1} failed for {func.__name__}: {str(e)}"
                            f". Retrying in {delay} seconds..."
                        )
                        time.sleep(delay)
                    
            logger.error(
                f"All {max_attempts} attempts failed for {func.__name__}"
            )
            raise last_error
            
        return wrapper
    return decorator

def log_execution_time(func: Callable):
    """Decorator to log function execution time"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        result = await func(*args, **kwargs)
        execution_time = time.time() - start_time
        
        logger.info(
            f"{func.__name__} executed in {execution_time:.2f} seconds"
        )
        return result
    
    return wrapper
