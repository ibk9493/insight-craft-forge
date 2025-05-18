
from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("database.log")
    ]
)
logger = logging.getLogger("database")

# Get database URL from environment or use SQLite default
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./swe_qa.db")
logger.info(f"Using database URL: {DATABASE_URL}")

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for declarative models
Base = declarative_base()

def check_and_create_tables():
    """
    Check if all tables exist with correct columns and create or recreate them if needed
    """
    from models import Discussion, Annotation, ConsensusAnnotation, AuthorizedUser, BatchUpload, discussion_task_association
    
    try:
        logger.info("Checking database schema...")
        inspector = inspect(engine)
        
        # Required tables and columns
        required_tables = {
            'discussions': [
                'id', 'title', 'url', 'repository', 'created_at', 
                'repository_language', 'release_tag', 'release_url', 'release_date', 'batch_id'
            ],
            'batch_uploads': [
                'id', 'name', 'description', 'created_at', 'created_by', 'discussion_count'
            ],
            'discussion_task_association': [
                'discussion_id', 'task_number', 'status', 'annotators'
            ],
            'annotations': [
                'id', 'discussion_id', 'user_id', 'task_id', 'data', 'timestamp'
            ],
            'consensus_annotations': [
                'id', 'discussion_id', 'task_id', 'data', 'timestamp'
            ],
            'authorized_users': [
                'id', 'email', 'role'
            ]
        }
        
        needs_update = False
        
        # Check if all required tables exist with their columns
        existing_tables = inspector.get_table_names()
        for table_name, columns in required_tables.items():
            if table_name not in existing_tables:
                logger.warning(f"Missing table: {table_name}")
                needs_update = True
                break
                
            existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
            missing_columns = [col for col in columns if col not in existing_columns]
                
            if missing_columns:
                logger.warning(f"Missing columns in {table_name} table: {missing_columns}")
                needs_update = True
                break
        
        if needs_update:
            logger.warning("Database schema needs to be updated")
            logger.warning("Please run reset_db.py to recreate the schema")
            logger.warning("Command: python reset_db.py")
            
            # Write warning to a file that will be shown in UI
            with open("db_schema_info.txt", "w") as f:
                f.write("""
⚠️ DATABASE SCHEMA UPDATE REQUIRED ⚠️

The application has detected that your database schema is out of date.
This happens when new features have been added to the application that require database changes.

To update your database schema, please run the following command:

    python reset_db.py

This will:
1. Back up your current database
2. Drop all existing tables
3. Create new tables with the updated schema

IMPORTANT: This will reset all data in your database. If you have important data,
make sure to export it first or save the backup file created during the process.

After running the reset script, restart the API server to continue.

Common issues if you don't reset the database:
- "no such column: discussions.batch_id" errors
- "module 'schemas' has no attribute 'TaskState'" errors 
- Other schema-related errors

""")
            
            # Don't auto-recreate tables to prevent data loss
            return False
        else:
            logger.info("Database schema is up to date")
            return True
            
    except Exception as e:
        logger.error(f"Error checking database schema: {str(e)}")
        return False

def get_db():
    """
    Get a database session
    
    Used as a dependency in FastAPI endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
