from sqlalchemy.orm import Session
from sqlalchemy import and_, exc
import models
import schemas
from typing import List, Optional
import logging
from contextlib import contextmanager

# Set up logging
logger = logging.getLogger(__name__)

class UserNotAuthorizedError(Exception):
    """Raised when a user is not authorized."""
    pass

class DatabaseError(Exception):
    """Raised when a database operation fails."""
    pass

@contextmanager
def transaction_scope(db: Session):
    """Provide a transactional scope around a series of operations."""
    try:
        yield
        db.commit()
    except exc.SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise DatabaseError(f"Database operation failed: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Transaction error: {str(e)}")
        raise

def validate_user_data(email: str, role: str) -> None:
    """Validate user data."""
    if not email or '@' not in email:
        raise ValueError("Invalid email format")
    
    valid_roles = ["admin", "annotator", "viewer", "pod_lead"]  # Define your valid roles here
    if role not in valid_roles:
        raise ValueError(f"Invalid role. Must be one of: {', '.join(valid_roles)}")

def get_authorized_users(db: Session) -> List[schemas.AuthorizedUser]:
    """Get all authorized users or initialize with default admin if none exist."""
    try:
        users = db.query(models.AuthorizedUser).all()
        
        # If no users exist, add the default admin user
        if not users:
            logger.info("No authorized users found. Adding default admin user.")
            with transaction_scope(db):
                # Add default admin (will be added when first request comes)
                admin_user = models.AuthorizedUser(
                    email="ibrahim.u@turing.com",
                    role="admin"
                )
                db.add(admin_user)
                db.flush()
                users = [admin_user]
            
            # Refresh outside transaction to avoid holding locks
            db.refresh(admin_user)
        
        logger.info(f"Retrieved {len(users)} authorized users")
        return [
            schemas.AuthorizedUser(
                id=user.id,
                email=user.email,
                role=user.role
            )
            for user in users
        ]
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_authorized_users: {str(e)}")
        raise DatabaseError(f"Failed to retrieve authorized users: {str(e)}")

def check_if_email_authorized(db: Session, email: str) -> Optional[schemas.AuthorizedUser]:
    """
    Check if the email is in the authorized users list.
    Returns the user if authorized, None otherwise.
    """
    if not email:
        logger.warning("Empty email provided for authorization check")
        return None
    
    try:
        user = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.email == email
        ).first()
        
        if not user:
            logger.info(f"Email {email} not found in authorized users")
            return None
        
        logger.info(f"Email {email} authorized with role {user.role}")
        return schemas.AuthorizedUser(
            id=user.id,
            email=user.email,
            role=user.role
        )
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in check_if_email_authorized: {str(e)}")
        raise DatabaseError(f"Failed to check email authorization: {str(e)}")

def add_or_update_authorized_user(db: Session, user_data: schemas.AuthorizedUserCreate) -> schemas.AuthorizedUser:
    """Add a new authorized user or update an existing one."""
    try:
        # Validate input data
        validate_user_data(user_data.email, user_data.role)
        
        with transaction_scope(db):
            # Check if user already exists
            existing = db.query(models.AuthorizedUser).filter(
                models.AuthorizedUser.email == user_data.email
            ).first()
            
            if existing:
                # Update existing user
                existing.role = user_data.role
                logger.info(f"Updated existing user {user_data.email} with role {user_data.role}")
            else:
                # Create new user
                existing = models.AuthorizedUser(
                    email=user_data.email,
                    role=user_data.role
                )
                db.add(existing)
                logger.info(f"Added new authorized user {user_data.email} with role {user_data.role}")
            
            db.flush()
        
        # Refresh outside transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.AuthorizedUser(
            id=existing.id,
            email=existing.email,
            role=existing.role
        )
    except ValueError as e:
        # Re-raise validation errors
        logger.warning(f"Validation error in add_or_update_authorized_user: {str(e)}")
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in add_or_update_authorized_user: {str(e)}")
        raise

def remove_authorized_user(db: Session, email: str) -> bool:
    """
    Remove a user from the authorized users list.
    Returns True if user was removed, False if user wasn't found.
    """
    if not email:
        logger.warning("Empty email provided for user removal")
        raise ValueError("Email cannot be empty")
    
    try:
        with transaction_scope(db):
            # Ensure we're not removing the last admin
            admin_count = db.query(models.AuthorizedUser).filter(
                models.AuthorizedUser.role == "admin"
            ).count()
            
            user_to_remove = db.query(models.AuthorizedUser).filter(
                models.AuthorizedUser.email == email
            ).first()
            
            if not user_to_remove:
                logger.warning(f"Attempted to remove non-existent user: {email}")
                return False
            
            # Prevent removing the last admin
            if user_to_remove.role == "admin" and admin_count <= 1:
                logger.warning(f"Attempted to remove the last admin user: {email}")
                raise ValueError("Cannot remove the last admin user")
            
            # Perform the delete operation
            result = db.query(models.AuthorizedUser).filter(
                models.AuthorizedUser.email == email
            ).delete()
            
            if result > 0:
                logger.info(f"Removed authorized user: {email}")
                return True
            else:
                logger.warning(f"No user found with email: {email}")
                return False
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in remove_authorized_user: {str(e)}")
        raise

def verify_user_authorization(db: Session, email: str) -> schemas.AuthorizedUser:
    """
    Verify if a user is authorized.
    Raises UserNotAuthorizedError if not authorized.
    """
    if not email:
        logger.warning("Empty email provided for authorization verification")
        raise ValueError("Email cannot be empty")
    
    try:
        user = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.email == email
        ).first()
        
        if not user:
            logger.warning(f"Authorization verification failed for email: {email}")
            raise UserNotAuthorizedError(f"User with email {email} is not authorized")
        
        logger.info(f"User authorization verified for {email} with role {user.role}")
        return schemas.AuthorizedUser(
            id=user.id,
            email=user.email,
            role=user.role
        )
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in verify_user_authorization: {str(e)}")
        raise DatabaseError(f"Failed to verify user authorization: {str(e)}")

def get_user_by_email(db: Session, email: str) -> Optional[schemas.AuthorizedUser]:
    """Get a user by email."""
    if not email:
        logger.warning("Empty email provided for user lookup")
        return None
    
    try:
        user = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.email == email
        ).first()
        
        if not user:
            logger.info(f"No user found with email: {email}")
            return None
        
        return schemas.AuthorizedUser(
            id=user.id,
            email=user.email,
            role=user.role
        )
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_user_by_email: {str(e)}")
        raise DatabaseError(f"Failed to retrieve user by email: {str(e)}")

def is_admin(db: Session, email: str) -> bool:
    """Check if a user has admin role."""
    try:
        user = get_user_by_email(db, email)
        return user is not None and user.role == "admin"
    except DatabaseError:
        return False