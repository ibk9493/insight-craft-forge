
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
    from models import Discussion, Annotation, ConsensusAnnotation, AuthorizedUser, BatchUpload
    
    try:
        logger.info("Checking database schema...")
        inspector = inspect(engine)
        
        # Required columns for the discussions table
        required_columns = {
            'discussions': [
                'id', 'title', 'url', 'repository', 'created_at', 
                'repository_language', 'release_tag', 'release_url', 'release_date', 'batch_id'
            ],
            'batch_uploads': [
                'id', 'name', 'description', 'created_at', 'created_by', 'discussion_count'
            ]
        }
        
        needs_update = False
        
        # Check if tables exist
        for table_name, columns in required_columns.items():
            if table_name in inspector.get_table_names():
                existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
                missing_columns = [col for col in columns if col not in existing_columns]
                
                if missing_columns:
                    logger.warning(f"Missing columns in {table_name} table: {missing_columns}")
                    needs_update = True
                    break
            else:
                logger.warning(f"Missing table: {table_name}")
                needs_update = True
                break
        
        if needs_update:
            logger.warning("Database schema needs to be updated")
            logger.warning("Please run reset_database.py to recreate the schema")
            logger.warning("Command: python reset_database.py")
            
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
