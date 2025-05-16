
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
from typing import List

def get_authorized_users(db: Session) -> List[schemas.AuthorizedUser]:
    users = db.query(models.AuthorizedUser).all()
    
    return [
        schemas.AuthorizedUser(
            id=user.id,
            email=user.email,
            role=user.role
        )
        for user in users
    ]

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
