
import os
import sys
import logging
from database import engine
from models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("db_reset.log")
    ]
)
logger = logging.getLogger("db_reset")

def reset_database():
    """
    Drop all tables and recreate the database schema
    """
    try:
        logger.info("Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        logger.info("Creating all tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database reset completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error resetting database: {str(e)}")
        return False

if __name__ == "__main__":
    print("WARNING: This will delete all data in the database!")
    confirm = input("Are you sure you want to proceed? (y/n): ")
    
    if confirm.lower() == 'y':
        if reset_database():
            print("Database has been reset successfully.")
            print("You can now restart your application.")
        else:
            print("Failed to reset database. Check the logs for details.")
    else:
        print("Database reset cancelled.")
