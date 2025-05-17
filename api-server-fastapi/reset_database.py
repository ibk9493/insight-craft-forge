
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
    print("=" * 60)
    print("DATABASE RESET UTILITY")
    print("=" * 60)
    print("WARNING: This will delete all data in the database!")
    print("This action is needed when the database schema has changed.")
    print("You're seeing database errors because new columns were added.")
    print("-" * 60)
    print("Common errors that require database reset:")
    print(" - 'no such column: discussions.repository_language'")
    print(" - Table structure has changed")
    print(" - SqlAlchemy OperationalError")
    print("-" * 60)
    
    confirm = input("Are you sure you want to proceed? (y/n): ")
    
    if confirm.lower() == 'y':
        if reset_database():
            print("\n✅ Database has been reset successfully.")
            print("\nNext steps:")
            print("1. Restart your FastAPI server")
            print("2. Upload your discussions JSON again")
            print("\nYou can now restart your application.")
        else:
            print("\n❌ Failed to reset database. Check the logs for details.")
    else:
        print("\n⚠️ Database reset cancelled.")
        print("\nTo fix database errors, you'll need to:")
        print("1. Delete the swe_qa.db file manually, or")
        print("2. Run this script again and confirm with 'y'")
