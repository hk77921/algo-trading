import logging
import sys
from typing import Optional

def get_logger(name: Optional[str] = None) -> logging.Logger:
    """
    Get a configured logger instance
    
    Args:
        name: The name for the logger (usually __name__)
        
    Returns:
        logging.Logger: Configured logger instance
    """
    # Configure root logger
    logging.basicConfig(level=logging.INFO)
    
    # Get or create logger
    logger = logging.getLogger(name or "trading-api")
    
    if not logger.handlers:
        # Create console handler with detailed formatting
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s [%(name)s.%(funcName)s:%(lineno)d] %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
        # Set level to DEBUG to see all logs
        logger.setLevel(logging.INFO)
        
        # Prevent log propagation to avoid duplicate logs
        logger.propagate = False
    
    return logger
