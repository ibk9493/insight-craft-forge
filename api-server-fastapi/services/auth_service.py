
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
from typing import List, Optional

def get_authorized_users(db: Session) -> List[schemas.AuthorizedUser]:
    users = db.query(models.AuthorizedUser).all()
    
    # If no users exist, add the default admin user
    if not users:
        # Add Ibrahim as admin (will be added when first request comes)
        admin_user = models.AuthorizedUser(
            email="admin1@turing.com",
            role="admin"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        users = [admin_user]
    
    return [
        schemas.AuthorizedUser(
            id=user.id,
            email=user.email,
            role=user.role
        )
        for user in users
    ]

def check_if_email_authorized(db: Session, email: str) -> Optional[schemas.AuthorizedUser]:
    """
    Check if the email is in the authorized users list
    """
    user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.email == email
    ).first()
    
    if not user:
        return None
    
    return schemas.AuthorizedUser(
        id=user.id,
        email=user.email,
        role=user.role
    )

def add_or_update_authorized_user(db: Session, user_data: schemas.AuthorizedUserCreate) -> schemas.AuthorizedUser:
    # Check if user already exists
    existing = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.email == user_data.email
    ).first()
    
    if existing:
        # Update existing user
        existing.role = user_data.role
    else:
        # Create new user
        existing = models.AuthorizedUser(
            email=user_data.email,
            role=user_data.role
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    
    return schemas.AuthorizedUser(
        id=existing.id,
        email=existing.email,
        role=existing.role
    )

def remove_authorized_user(db: Session, email: str) -> None:
    db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.email == email
    ).delete()
    
    db.commit()

def verify_user_authorization(db: Session, email: str) -> schemas.AuthorizedUser:
    user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.email == email
    ).first()
    
    if not user:
        raise ValueError("User is not authorized")
    
    return schemas.AuthorizedUser(
        id=user.id,
        email=user.email,
        role=user.role
    )


def get_authorized_user_by_id(db: Session, user_id: int) -> Optional[schemas.AuthorizedUser]:
    """
    Get an authorized user by their ID
    """
    user = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.id == user_id
    ).first()

    if not user:
        return None

    return schemas.AuthorizedUser(
        id=user.id,
        email=user.email,
        role=user.role
    )


def get_emails_by_role(db: Session, role: str) -> List[str]:
    """
    Get all email addresses for users with a specific role
    """
    users = db.query(models.AuthorizedUser).filter(
        models.AuthorizedUser.role == role
    ).all()