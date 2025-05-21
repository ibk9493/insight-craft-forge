from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, Response, Body, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Union
import json
import os
from typing import List, Dict, Any  # Import Any with uppercase A
import models
import schemas
from database import engine, get_db, check_and_create_tables
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service, batch_service, jwt_auth_service

from fastapi import APIRouter, Depends, HTTPException
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



models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"], # Specific origin for credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup default admin user on startup
# Setup default admin user on startup
@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    # Check database schema
    schema_ok = check_and_create_tables()
    if not schema_ok:
        print("\n\n======================================================")
        print("WARNING: Database schema is outdated or missing tables!")
        print("Please run 'python reset_db.py' to update the schema.")
        print("This is required for the application to work correctly.")
        print("======================================================\n\n")
    
    # Add Ibrahim as admin user if not exists
    try:
        # Check if the user already exists
        existing_user = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.email == "admin1@turing.com"
        ).first()
        
        if not existing_user:
            # Create a new user with hashed password
            
            default_password = "Test1234!"  # You should change this to a secure password
            hashed_password = jwt_auth_service.get_password_hash(default_password)
            
            admin_user = models.AuthorizedUser(
                email="admin1@turing.com",
                role="admin",
                password_hash=hashed_password
            )
            
            db.add(admin_user)
            db.commit()
            print(f"Created default admin user: admin1@turing.com")
            print(f"Default password: {default_password} - CHANGE THIS IN PRODUCTION!")
        else:
            # If user exists but doesn't have a password hash, update it
            if not existing_user.password_hash:
               
                
                default_password = "Test1234!"  # You should change this to a secure password
                hashed_password = jwt_auth_service.get_password_hash(default_password)
                
                existing_user.password_hash = hashed_password
                db.commit()
                print(f"Updated default admin user with password hash")
                print(f"Default password: {default_password} - CHANGE THIS IN PRODUCTION!")

    except Exception as e:
        print(f"Error adding default admin user: {str(e)}")
        
# Root endpoint
@app.get("/")
async def root():
    # Check if we need to show the schema warning
    schema_warning = ""
    if os.path.exists("db_schema_info.txt"):
        try:
            with open("db_schema_info.txt", "r") as f:
                schema_warning = f.read()
        except:
            pass
    
    return {
        "message": "SWE-QA Annotation API", 
        "schema_warning": schema_warning if schema_warning else None
    }

# Discussions endpoints
@app.get("/api/discussions", response_model=List[schemas.Discussion])
def get_all_discussions(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    discussions = discussions_service.get_discussions(db, status)
    return discussions

@app.get("/api/discussions/{discussion_id}", response_model=schemas.Discussion)
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    return discussions_service.get_discussion_by_id(db, discussion_id)

# Annotations endpoints
@app.post("/api/annotations", response_model=schemas.Annotation)
def create_annotation(annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    return annotations_service.create_annotation(db, annotation)

@app.get("/api/annotations", response_model=List[schemas.Annotation])
def get_annotations(
    discussion_id: Optional[str] = None,
    user_id: Optional[str] = None,
    task_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return annotations_service.get_annotations(db, discussion_id, user_id, task_id)

# Admin task status update
@app.put("/api/admin/tasks/status", response_model=schemas.TaskManagementResult)
def update_task_status_route(task_data: schemas.TaskStatusUpdate, db: Session = Depends(get_db)):
    result = discussions_service.update_task_status(db, task_data.discussion_id, task_data.task_id, task_data.status)
    
    # Manual fix: Convert to dict and back to ensure proper serialization
    if result.discussion:
        # Create a clean dictionary with all the required fields
        discussion_dict = {
            "id": result.discussion.id,
            "title": result.discussion.title,
            "url": result.discussion.url,
            "repository": result.discussion.repository,
            "created_at": result.discussion.created_at,
            "repository_language": result.discussion.repository_language,
            "release_tag": result.discussion.release_tag,
            "release_url": result.discussion.release_url,
            "release_date": result.discussion.release_date,
            "batch_id": result.discussion.batch_id,
            "task1_status": result.discussion.task1_status,
            "task1_annotators": result.discussion.task1_annotators,
            "task2_status": result.discussion.task2_status,
            "task2_annotators": result.discussion.task2_annotators,
            "task3_status": result.discussion.task3_status,
            "task3_annotators": result.discussion.task3_annotators,
            "tasks": result.discussion.tasks
        }
        # Create a fresh Discussion model from the dict
        discussion = schemas.Discussion(**discussion_dict)
        # Replace in the result
        result.discussion = discussion
        
    return result


@app.put("/api/admin/tasks/bulk-status", response_model=schemas.BulkTaskManagementResult)
def update_bulk_task_status_route(bulk_data: schemas.BulkTaskStatusUpdate, db: Session = Depends(get_db)):
    results = []
    for discussion_id in bulk_data.discussion_ids:
        result = discussions_service.update_task_status(db, discussion_id, bulk_data.task_id, bulk_data.status)
        
        # Manual fix: Convert to dict and back to ensure proper serialization
        if result.discussion:
            # Create a clean dictionary with all the required fields
            discussion_dict = {
                "id": result.discussion.id,
                "title": result.discussion.title,
                "url": result.discussion.url,
                "repository": result.discussion.repository,
                "created_at": result.discussion.created_at,
                "repository_language": result.discussion.repository_language,
                "release_tag": result.discussion.release_tag,
                "release_url": result.discussion.release_url,
                "release_date": result.discussion.release_date,
                "batch_id": result.discussion.batch_id,
                "task1_status": result.discussion.task1_status,
                "task1_annotators": result.discussion.task1_annotators,
                "task2_status": result.discussion.task2_status,
                "task2_annotators": result.discussion.task2_annotators,
                "task3_status": result.discussion.task3_status,
                "task3_annotators": result.discussion.task3_annotators,
                "tasks": result.discussion.tasks
            }
            # Create a fresh Discussion model from the dict
            discussion = schemas.Discussion(**discussion_dict)
            # Replace in the result
            result.discussion = discussion
        
        results.append(result)
    
    return schemas.BulkTaskManagementResult(results=results)
# Upload discussions endpoint
@app.post("/api/admin/discussions/upload", response_model=schemas.UploadResult)
def upload_discussions(upload_data: schemas.DiscussionUpload, db: Session = Depends(get_db)):
    return discussions_service.upload_discussions(db, upload_data)

# Summary statistics endpoints
@app.get("/api/summary/stats")
def get_system_summary(db: Session = Depends(get_db)):
    return summary_service.get_system_summary(db)

@app.get("/api/summary/user/{user_id}")
def get_user_summary(user_id: str, db: Session = Depends(get_db)):
    return summary_service.get_user_summary(db, user_id)

# Batch management endpoints
@app.get("/api/batches", response_model=List[schemas.BatchUpload])
def get_all_batches(db: Session = Depends(get_db)):
    """Get all batch uploads"""
    return batch_service.get_all_batches(db)

@app.get("/api/batches/{batch_id}", response_model=schemas.BatchUpload)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    """Get a specific batch by ID"""
    batch = batch_service.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@app.post("/api/batches", response_model=schemas.BatchManagementResult)
def create_batch(batch: schemas.BatchUploadCreate, db: Session = Depends(get_db)):
    """Create a new batch"""
    try:
        new_batch = batch_service.create_batch(db, batch)
        return {
            "success": True,
            "message": "Batch created successfully",
            "batch_id": new_batch.id
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to create batch: {str(e)}"
        }

@app.delete("/api/batches/{batch_id}", response_model=schemas.BatchManagementResult)
def delete_batch(batch_id: int, db: Session = Depends(get_db)):
    """Delete a batch and its associated discussions"""
    success = batch_service.delete_batch(db, batch_id)
    if success:
        return {
            "success": True,
            "message": "Batch and associated discussions deleted successfully"
        }
    else:
        return {
            "success": False,
            "message": "Failed to delete batch"
        }

@app.get("/api/batches/{batch_id}/discussions", response_model=List[schemas.Discussion])
def get_batch_discussions(batch_id: int, db: Session = Depends(get_db)):
    """Get all discussions associated with a specific batch"""
    batch = batch_service.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    return batch_service.get_batch_discussions(db, batch_id)

@app.put("/api/batches/{batch_id}", response_model=schemas.BatchManagementResult)
def update_batch(batch_id: int, batch_data: schemas.BatchUploadCreate, db: Session = Depends(get_db)):
    """Update a batch's details"""
    updated_batch = batch_service.update_batch(db, batch_id, batch_data)
    if updated_batch:
        return {
            "success": True,
            "message": "Batch updated successfully",
            "batch_id": updated_batch.id
        }
    else:
        return {
            "success": False,
            "message": "Batch not found or update failed"
        }

@app.get("/api/summary/report", response_model=List[Dict[str, Any]])
async def get_summary_report(
    format: str = Query("json", description="Output format (json or csv)"),
    db: Session = Depends(get_db)
):
    """
    Generate a summary report of all discussions with their annotations.
    
    Parameters:
    - format: Output format (json or csv)
    
    Returns:
    - List of discussion summaries with annotations
    """
    if format.lower() not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
    
    # Get all discussions
    discussions = discussions_service.get_discussions(db)
    
    result = []
    for discussion in discussions:
        # Get annotations for task 1 & 2
        task1_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=1)
        task2_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=2)
        
        # Get consensus for task 1 & 2
        task1_consensus = consensus_service.get_consensus(db, discussion_id=discussion.id, task_id=1)
        task2_consensus = consensus_service.get_consensus(db, discussion_id=discussion.id, task_id=2)
        
        # Combine task 1 & 2 consensus
        combined_consensus_data = {}
        if task1_consensus and task1_consensus.data:
            combined_consensus_data.update(task1_consensus.data)
        if task2_consensus and task2_consensus.data:
            combined_consensus_data.update(task2_consensus.data)
        
        # Only get task 3 data if all three criteria are met
        task3_annotations = []
        task3_consensus = None
        task3_consensus_data = {}
        
        # Check if relevance, learning_value, and clarity are all True
        meets_criteria = (
            combined_consensus_data.get("relevance", False) and
            combined_consensus_data.get("learning_value", False) and
            combined_consensus_data.get("clarity", False)
        )
        
        if meets_criteria:
            # Get annotations for task 3
            task3_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=3)
            task3_consensus = consensus_service.get_consensus(db, discussion_id=discussion.id, task_id=3)
            if task3_consensus and task3_consensus.data:
                task3_consensus_data = task3_consensus.data
        
        # Extract code and other properties from the discussion
        code = ""
        lang = "python"  # Default language
        question = ""
        answer = ""
        category = ""
        knowledge = ""
        
        # Try to extract code and other information from discussion data or annotations
        try:
            # Attempt to extract code from annotations
            for annotation in task1_annotations + task2_annotations:
                if annotation.data.get("code"):
                    code = annotation.data.get("code", "")
                    break
            
            # Extract language from repository_language or fallback
            lang = discussion.repository_language or "python"
            
            # Extract question from title or other fields
            question = discussion.title
            
            # Other fields might need to be derived from various sources
            # These are placeholders - adjust based on your actual data structure
            answer = task3_consensus_data.get("long_answer", "") if meets_criteria else ""
            category = task3_consensus_data.get("question_type", "") if meets_criteria else ""
            knowledge = "post-cutoff" if discussion.created_at and discussion.created_at > "2023-01-01" else "pre-cutoff"
        except Exception as e:
            # Log error but continue with default values
            print(f"Error extracting data for discussion {discussion.id}: {str(e)}")
        
        # Build the entry according to the schema
        entry = {
            "url": discussion.url,
            "code": code,
            "lang": lang,
            "answer": answer,
            "category": category,
            "question": question,
            "createdAt": discussion.created_at,
            "knowledge": knowledge,
            
            # Include all annotations for tasks 1 & 2
            "annotations_tasks_1_and_2": [
                {
                    "user_id": annotation.user_id,
                    "timestamp": annotation.timestamp.isoformat() if hasattr(annotation, 'timestamp') else datetime.now(timezone.utc).isoformat(),
                    **annotation.data
                }
                for annotation in task1_annotations + task2_annotations
            ],
            
            # Include agreed consensus for tasks 1 & 2
            "agreed_annotation_tasks_1_and_2": {
                "relevance": combined_consensus_data.get("relevance", False),
                "learning_value": combined_consensus_data.get("learning_value", False),
                "clarity": combined_consensus_data.get("clarity", False),
                "image_grounded": combined_consensus_data.get("image_grounded", False),
                "address_all_aspects": combined_consensus_data.get("address_all_aspects", False),
                "justification_for_addressing_all_aspects": combined_consensus_data.get("justification_for_addressing_all_aspects", ""),
                "with_explanation": combined_consensus_data.get("with_explanation", False),
                "code_executable": combined_consensus_data.get("code_executable", False),
                "code_download_link": combined_consensus_data.get("code_download_link", "")
            },
            
            # Include task 3 annotations if meets criteria, otherwise empty array
            "annotations_task_3": [
                {
                    "user_id": annotation.user_id,
                    "timestamp": annotation.timestamp.isoformat() if hasattr(annotation, 'timestamp') else datetime.now(timezone.utc).isoformat(),
                    **annotation.data
                }
                for annotation in task3_annotations
            ] if meets_criteria else [],
            
            # Include task 3 consensus if meets criteria, otherwise empty object
            "agreed_annotation_task_3": task3_consensus_data if meets_criteria else {}
        }
        
        # If criteria are met, ensure required fields are present in task3 consensus
        if meets_criteria:
            # Ensure all required fields exist with default values if not present
            task3_required_fields = {
                "rewritten_question": [""],
                "question_type": "Reasoning",
                "short_answer_list": [""],
                "long_answer": "",
                "supporting_docs": [{"link": ""}]
            }
            
            for field, default_value in task3_required_fields.items():
                if field not in entry["agreed_annotation_task_3"]:
                    entry["agreed_annotation_task_3"][field] = default_value
        
        result.append(entry)
    
    # If CSV format is requested, convert result to CSV
    if format.lower() == "csv":
        # Implement CSV conversion logic here if needed
        # For this example, we'll just return JSON regardless
        pass
    
    return result

# Authentication endpoints for authorized users
@app.get("/api/auth/authorized-users", response_model=List[schemas.AuthorizedUser])
def get_authorized_users(db: Session = Depends(get_db)):
    """Get all authorized users"""
    return auth_service.get_authorized_users(db)

@app.post("/api/auth/authorized-users", response_model=schemas.AuthorizedUser)
def add_authorized_user(user: schemas.AuthorizedUserCreate, db: Session = Depends(get_db)):
    """Add or update an authorized user"""
    return auth_service.add_or_update_authorized_user(db, user)

@app.delete("/api/auth/authorized-users/{email}")
def remove_authorized_user(email: str, db: Session = Depends(get_db)):
    """Remove an authorized user"""
    auth_service.remove_authorized_user(db, email)
    return {"message": f"User {email} removed from authorized users"}



# Regular login endpoint matching React front-end's expected response
@app.post("/api/auth/login", response_model=schemas.LoginResponse)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        # Parse form data or JSON body
        data = await request.json()
        email = data.get("email", "")
        password = data.get("password", "")
        
        # Try to authenticate user
        user = await jwt_auth_service.authenticate_user(db, email, password)
        if not user:
            return schemas.LoginResponse(
                success=False,
                message="Invalid email or password"
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        # Format user response
        user_response = {
            "id": str(user.id),
            "username": user.email,
            "role": user.role,
            "provider": "local"
        }
        
        return schemas.LoginResponse(
            success=True,
            message="Login successful",
            user=user_response,
            token=access_token
        )
    except Exception as e:
        return schemas.LoginResponse(
            success=False,
            message=f"Login failed: {str(e)}"
        )

# OAuth2 compatible token endpoint (for tools that use OAuth2)
@app.post("/api/auth/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = await jwt_auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = jwt_auth_service.create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.email,
            "role": user.role
        }
    }

# Google login endpoint
@app.post("/api/auth/google/login", response_model=schemas.LoginResponse)
async def google_login(
    token_data: schemas.GoogleToken,
    db: Session = Depends(get_db)
):
    try:
        # Get Google OAuth client ID from environment variable
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        if not GOOGLE_CLIENT_ID:
            return schemas.LoginResponse(
                success=False,
                message="Google authentication is not configured"
            )
        
        # Verify the Google token
        request = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(
            token_data.credential, request, GOOGLE_CLIENT_ID
        )
        
        # Get email from token
        email = id_info.get("email")
        if not email:
            return schemas.LoginResponse(
                success=False,
                message="Email not found in Google token"
            )
        
        # Check if email is authorized
        user = auth_service.check_if_email_authorized(db, email)
        if not user:
            return schemas.LoginResponse(
                success=False,
                message="Email not authorized for login"
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        
        # Create user response object
        user_response = {
            "id": str(user.id),
            "username": user.email,
            "role": user.role,
            "provider": "google"
        }
        
        return schemas.LoginResponse(
            success=True,
            message="Google login successful",
            user=user_response,
            token=access_token
        )
    except Exception as e:
        return schemas.LoginResponse(
            success=False,
            message=f"Google login failed: {str(e)}"
        )

# Verify Google token
@app.post("/api/auth/google/verify", response_model=Dict[str, Any])
async def verify_google_token(
    token_data: schemas.GoogleToken,
    db: Session = Depends(get_db)
):
    try:
        # Get Google OAuth client ID from environment variable
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        if not GOOGLE_CLIENT_ID:
            return {"success": False, "message": "Google authentication is not configured"}
        
        # Verify the Google token
        request = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(
            token_data.credential, request, GOOGLE_CLIENT_ID
        )
        
        # Get email from token
        email = id_info.get("email")
        if not email:
            return {"success": False, "message": "Email not found in Google token"}
        
        # Check if email is authorized
        user = auth_service.check_if_email_authorized(db, email)
        if not user:
            return {"success": False, "message": "Email not authorized"}
        
        # Return successful response
        return {
            "success": True,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "role": user.role
            }
        }
    except Exception as e:
        return {"success": False, "message": f"Google token verification failed: {str(e)}"}

# User registration schema
class UserSignup(BaseModel):
    email: str
    password: str

# User signup endpoint
@app.post("/api/auth/signup", response_model=schemas.LoginResponse)
async def signup(
    user_data: UserSignup,
    db: Session = Depends(get_db)
):
    try:
        # Check if email is already registered
        existing_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == user_data.email).first()
        
        # Check if email is in authorized users list
        authorized = auth_service.check_if_email_authorized(db, user_data.email)
        if not authorized:
            return schemas.LoginResponse(
                success=False,
                message="Email not authorized for signup"
            )
        
        # If user exists but doesn't have a password set, update it
        if existing_user:
            # Only update if password is not set
            if not existing_user.password_hash:
                existing_user.password_hash = jwt_auth_service.get_password_hash(user_data.password)
                db.commit()
                db.refresh(existing_user)
                
                # Create access token
                access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
                access_token = jwt_auth_service.create_access_token(
                    data={"sub": existing_user.email, "role": existing_user.role},
                    expires_delta=access_token_expires
                )
                
                # Format user response
                user_response = {
                    "id": str(existing_user.id),
                    "username": existing_user.email,
                    "role": existing_user.role,
                    "provider": "local"
                }
                
                return schemas.LoginResponse(
                    success=True,
                    message="Account created successfully",
                    user=user_response,
                    token=access_token
                )
            else:
                return schemas.LoginResponse(
                    success=False,
                    message="Email already registered"
                )
        
        # Create new user with hashed password
        hashed_password = jwt_auth_service.get_password_hash(user_data.password)
        
        new_user = models.AuthorizedUser(
            email=user_data.email,
            role=authorized.role,
            password_hash=hashed_password
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create access token
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": new_user.email, "role": new_user.role},
            expires_delta=access_token_expires
        )
        
        # Format user response
        user_response = {
            "id": str(new_user.id),
            "username": new_user.email,
            "role": new_user.role,
            "provider": "local"
        }
        
        return schemas.LoginResponse(
            success=True,
            message="Account created successfully",
            user=user_response,
            token=access_token
        )
    except Exception as e:
        return schemas.LoginResponse(
            success=False,
            message=f"Signup failed: {str(e)}"
        )

# Change password endpoint
@app.post("/api/auth/change-password")
async def change_password(
    password_data: schemas.PasswordChange,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """Change the current user's password."""
    try:
        # Get the user from database
        db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == current_user.email).first()
        
        # Verify current password
        if not jwt_auth_service.verify_password(password_data.current_password, db_user.password_hash):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": "Current password is incorrect"}
            )
        
        # Hash the new password
        hashed_password = jwt_auth_service.get_password_hash(password_data.new_password)
        
        # Update the password
        db_user.password_hash = hashed_password
        db.commit()
        
        return {"success": True, "message": "Password changed successfully"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": f"Failed to change password: {str(e)}"}
        )

# Reset password endpoint (admin only)
@app.post("/api/auth/reset-password/{user_email}")
async def reset_password(
    user_email: str,
    reset_data: schemas.PasswordReset,
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """Reset a user's password (admin only)."""
    try:
        # Get the user from database
        db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == user_email).first()
        if not db_user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": "User not found"}
            )
        
        # Hash the new password
        hashed_password = jwt_auth_service.get_password_hash(reset_data.new_password)
        
        # Update the password
        db_user.password_hash = hashed_password
        db.commit()
        
        return {"success": True, "message": f"Password reset for {user_email}"}
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": f"Failed to reset password: {str(e)}"}
        )

# Endpoint to check current user from token
@app.get("/api/auth/me")
async def get_me(current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_current_user)):
    if not current_user:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"authenticated": False, "message": "Not authenticated"}
        )
    
    return {
        "authenticated": True,
        "user": {
            "id": str(current_user.id),
            "username": current_user.email,
            "role": current_user.role,
            "provider": "local"  # Default provider
        }
    }

# Get all authorized users
@app.get("/api/auth/authorized-users", response_model=List[schemas.AuthorizedUser])
async def get_authorized_users(
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),  # Only admins can get all users
    db: Session = Depends(get_db)
):
    """Get all authorized users."""
    return auth_service.get_authorized_users(db)

# Add or update an authorized user
@app.post("/api/auth/authorized-users", response_model=schemas.AuthorizedUser)
async def add_authorized_user(
    user: schemas.AuthorizedUserCreate,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),  # Only admins can add users
    db: Session = Depends(get_db)
):
    """Add or update an authorized user."""
    return auth_service.add_or_update_authorized_user(db, user)

# Remove an authorized user
@app.delete("/api/auth/authorized-users/{email}")
async def remove_authorized_user(
    email: str,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),  # Only admins can remove users
    db: Session = Depends(get_db)
):
    """Remove an authorized user."""
    auth_service.remove_authorized_user(db, email)
    return {"success": True, "message": f"User {email} removed from authorized users"}

# Check if email is authorized
@app.get("/api/auth/check-email/{email}", response_model=Optional[schemas.AuthorizedUser])
async def check_email_authorization(
    email: str,
    db: Session = Depends(get_db)
):
    """Check if an email is authorized to use the system."""
    user = auth_service.check_if_email_authorized(db, email)
    return user

# Verify user authorization
@app.post("/api/auth/verify-user", response_model=schemas.AuthorizedUser)
async def verify_user_authorization(
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Verify that a user is authorized and return their authorization details."""
    try:
        user = auth_service.verify_user_authorization(db, email)
        return user
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

# ================= Annotation APIs =================

# Update an existing annotation
@app.put("/api/annotations/{discussion_id}/{user_id}/{task_id}", response_model=schemas.Annotation)
async def update_annotation(
    discussion_id: str,
    user_id: str,
    task_id: int,
    annotation_update: schemas.AnnotationUpdate,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """Update an existing annotation for a specific discussion, user, and task."""
    # Check if user is updating their own annotation or has pod_lead/admin role
    if current_user.email != user_id and current_user.role not in ["admin", "pod_lead"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You can only update your own annotations unless you are a pod lead or admin"
        )
    
    try:
        updated_annotation = annotations_service.update_annotation(
            db, discussion_id, user_id, task_id, annotation_update
        )
        return updated_annotation
    except annotations_service.AnnotationNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Pod lead override for annotation
@app.put("/api/pod-lead/annotations/override", response_model=schemas.Annotation)
async def pod_lead_override_annotation(
    override_data: schemas.PodLeadAnnotationOverride,
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """Allow a pod lead to override an annotation."""
    try:
        # Use the authenticated pod lead's ID
        pod_lead_id = pod_lead.email
        
        # Update the override data with the pod lead's ID
        override_data_dict = override_data.dict()
        override_data_dict["pod_lead_id"] = pod_lead_id
        
        result = annotations_service.pod_lead_override_annotation(
            db, pod_lead_id, schemas.PodLeadAnnotationOverride(**override_data_dict)
        )
        return result
    except annotations_service.PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# Admin override for annotation
@app.put("/api/admin/annotations/override", response_model=schemas.Annotation)
async def admin_override_annotation(
    override_data: schemas.AnnotationOverride,
    admin: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """Allow an admin to override an annotation with specific timestamp."""
    try:
        result = annotations_service.override_annotation(db, override_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ================= Consensus APIs =================

# Get consensus for a discussion task
@app.get("/api/consensus/{discussion_id}/{task_id}", response_model=Optional[schemas.Annotation])
async def get_consensus(
    discussion_id: str,
    task_id: int,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """Get the consensus annotation for a specific discussion and task."""
    consensus = consensus_service.get_consensus(db, discussion_id, task_id)
    return consensus

# Create or update consensus
@app.post("/api/consensus", response_model=schemas.Annotation)
async def create_or_update_consensus(
    consensus_data: schemas.AnnotationCreate,
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """Create or update a consensus annotation. Only pod leads or admins can do this."""
    result = consensus_service.create_or_update_consensus(db, consensus_data)
    return result

# Calculate consensus
@app.get("/api/consensus/{discussion_id}/{task_id}/calculate", response_model=Dict[str, Any])
async def calculate_consensus(
    discussion_id: str,
    task_id: int,
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """Calculate consensus for a discussion task based on existing annotations."""
    result = consensus_service.calculate_consensus(db, discussion_id, task_id)
    return result

# Override consensus
@app.put("/api/consensus/override", response_model=schemas.Annotation)
async def override_consensus(
    override_data: schemas.ConsensusOverride,
    admin: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """Override the consensus annotation for a discussion task. Only admins can do this."""
    result = consensus_service.override_consensus(db, override_data)
    return result
# Consensus Endpoints
@app.get("/api/consensus", response_model=Optional[schemas.Annotation])
def get_consensus_route(
    discussion_id: str = Query(...),
    task_id: int = Query(...),
    db: Session = Depends(get_db)
):
    consensus = consensus_service.get_consensus(db, discussion_id, task_id)
    if not consensus:
        # Return None or an empty dict/list if that's how your frontend expects a "not found"
        # For now, FastAPI will handle a None response model correctly (e.g., null in JSON)
        return None
    return consensus

@app.post("/api/consensus", response_model=schemas.Annotation)
def create_or_update_consensus_route(
    consensus_data: schemas.AnnotationCreate, 
    db: Session = Depends(get_db)
):
    return consensus_service.create_or_update_consensus(db, consensus_data)

@app.post("/api/consensus/calculate", response_model=Dict[str, Any])
def calculate_consensus_route(
    discussion_id: str = Query(...),
    task_id: int = Query(...),
    db: Session = Depends(get_db)
):
    return consensus_service.calculate_consensus(db, discussion_id, task_id)

@app.post("/api/consensus/override", response_model=schemas.Annotation)
def override_consensus_route(
    override_data: schemas.ConsensusOverride, 
    db: Session = Depends(get_db)
):
    return consensus_service.override_consensus(db, override_data)
