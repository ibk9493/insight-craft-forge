
import os
import shutil
import datetime
import logging
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
                print(f"\nDatabase backup created: {backup_file}")
            except Exception as e:
                logger.error(f"Failed to create database backup: {str(e)}")
                print(f"\nWARNING: Failed to create backup: {str(e)}")
    
    # Create engine and drop all tables
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    )
    
    logger.info("Dropping all tables...")
    try:
        Base.metadata.drop_all(bind=engine)
        logger.info("All tables dropped successfully")
    except Exception as e:
        logger.error(f"Error dropping tables: {str(e)}")
        print(f"Error dropping tables: {str(e)}")
        return False
    
    logger.info("Creating new tables with updated schema...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("All tables created successfully")
    except Exception as e:
        logger.error(f"Error creating tables: {str(e)}")
        print(f"Error creating tables: {str(e)}")
        return False
    
    logger.info("Database reset complete with new schema!")
    
    # Clear the db_schema_info.txt file since schema is now updated
    if os.path.exists("db_schema_info.txt"):
        try:
            os.remove("db_schema_info.txt")
        except:
            pass
    
    return True

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("DATABASE RESET UTILITY")
    print("=" * 60)
    print("WARNING: This will reset the database and all data will be lost!")
    print("A backup of the existing database will be created if possible.")
    print("\nThis action is needed because:")
    print("  - Schema changes have been made to support new features")
    print("  - You are seeing errors like 'no such column' or 'module has no attribute'")
    print("  - The database structure needs to be updated to the latest version")
    print("-" * 60)
    
    confirm = input("\nAre you sure you want to continue? (yes/no): ")
    
    if confirm.lower() in ["yes", "y"]:
        success = reset_database()
        if success:
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
        print("1. Run this script again and confirm with 'yes'")
        print("2. Restart your FastAPI server after reset")
