# jwt_auth_router.py

from fastapi import APIRouter, Depends, HTTPException, Body, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import secrets
import google.oauth2.id_token
import google.auth.transport.requests
from pydantic import BaseModel

import models
import schemas
from database import get_db
from services import annotations_service, consensus_service, auth_service



# ================= Password Handling and JWT Setup =================
# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# JWT Security Configuration
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for better user experience

# OAuth2 scheme for token validation
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

# Create access token
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Authenticate user with password
async def authenticate_user(db: Session, email: str, password: str):
    # First check if user is authorized
    user = auth_service.check_if_email_authorized(db, email)
    if not user:
        return False
    
    # Get the user from the database to check password
    db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == email).first()
    
    if not db_user or not db_user.password_hash:
        return False
    
    if not verify_password(password, db_user.password_hash):
        return False
    
    return user

# Get current user from token
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if token is None:
        return None
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None
    
    # Verify user is still authorized
    user = auth_service.check_if_email_authorized(db, email)
    if user is None:
        return None
    
    return user

# Require authentication
async def require_authentication(current_user: schemas.AuthorizedUser = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

# Role-based authorization
def role_required(required_roles: List[str]):
    async def role_checker(current_user: schemas.AuthorizedUser = Depends(require_authentication)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {required_roles}"
            )
        return current_user
    return role_checker

# Get pod lead authorization
async def get_pod_lead(current_user: schemas.AuthorizedUser = Depends(role_required(["pod_lead", "admin"]))):
    return current_user

# Get admin authorization
async def get_admin(current_user: schemas.AuthorizedUser = Depends(role_required(["admin"]))):
    return current_user

# ================= Authentication/Authorization Endpoints =================

# Schema for token response
