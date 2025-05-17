
from sqlalchemy import create_engine, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from dotenv import load_dotenv

load_dotenv()

# Configure logging
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
    from models import Discussion, Annotation, ConsensusAnnotation, AuthorizedUser
    
    try:
        inspector = inspect(engine)
        
        # Check if discussions table exists
        if 'discussions' in inspector.get_table_names():
            columns = [col['name'] for col in inspector.get_columns('discussions')]
            required_columns = ['repository_language', 'release_tag', 'release_url', 'release_date']
            
            # Check if all required columns exist
            missing_columns = [col for col in required_columns if col not in columns]
            
            if missing_columns:
                logger.warning(f"Missing columns in discussions table: {missing_columns}")
                logger.warning("Will recreate the database schema")
                # Recreate all tables
                Base.metadata.drop_all(bind=engine)
                Base.metadata.create_all(bind=engine)
                logger.info("Database schema recreated successfully")
                return True
        else:
            # If discussions table doesn't exist, create all tables
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully")
            return True
            
        return False
    except Exception as e:
        logger.error(f"Error checking or creating database tables: {str(e)}")
        # In case of error, attempt to recreate tables
        try:
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            logger.info("Database schema recreated after error")
            return True
        except Exception as e2:
            logger.error(f"Failed to recreate database schema: {str(e2)}")
            return False
