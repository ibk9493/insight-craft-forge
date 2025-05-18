
import os
import shutil
import datetime
from sqlalchemy import create_engine
from models import Base
from database import DATABASE_URL, logger

def reset_database():
    """
    Reset the database by dropping all tables and recreating them.
    Backs up the existing database first.
    """
    # Extract database filename from URL for SQLite
    if DATABASE_URL.startswith("sqlite:///"):
        db_file = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_file):
            # Create backup before resetting
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = f"{db_file}.backup_{timestamp}"
            try:
                shutil.copy2(db_file, backup_file)
                logger.info(f"Created database backup at: {backup_file}")
            except Exception as e:
                logger.error(f"Failed to create database backup: {str(e)}")
    
    # Create engine and drop all tables
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    )
    
    logger.info("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    
    logger.info("Creating new tables with updated schema...")
    Base.metadata.create_all(bind=engine)
    
    logger.info("Database reset complete with new schema!")

if __name__ == "__main__":
    print("WARNING: This will reset the database and all data will be lost!")
    print("A backup of the existing database will be created if possible.")
    
    confirm = input("Are you sure you want to continue? (yes/no): ")
    
    if confirm.lower() in ["yes", "y"]:
        reset_database()
        print("Database reset complete. You can now restart the API server.")
    else:
        print("Database reset cancelled.")
