from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Union
import json
import os

import models
import schemas
from database import engine, get_db, check_and_create_tables
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service, batch_service

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        admin_user = schemas.AuthorizedUserCreate(
            email="ibrahim.u@turing.com",
            role="admin"
        )
        auth_service.add_or_update_authorized_user(db, admin_user)
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
    try:
        return annotations_service.create_annotation(db, annotation)
    except Exception as e:
        # Log the error for debugging
        print(f"Error creating annotation: {str(e)}")
        # Return a proper HTTP error
        raise HTTPException(status_code=500, detail=f"Failed to create annotation: {str(e)}")
@app.get("/api/annotations", response_model=List[schemas.Annotation])
def get_annotations(
    discussionId: Optional[str] = None,  # Changed to match URL parameter
    userId: Optional[str] = None,        # Changed to be consistent
    taskId: Optional[int] = None,        # Changed to be consistent
    db: Session = Depends(get_db)
):
    try:
        # Convert camelCase to snake_case for internal use
        return annotations_service.get_annotations(
            db, 
            discussion_id=discussionId, 
            user_id=userId, 
            task_id=taskId
        )
    except Exception as e:
        # Log the error for debugging
        print(f"Error getting annotations: {str(e)}")
        # Return a proper HTTP error
        raise HTTPException(status_code=500, detail=f"Failed to get annotations: {str(e)}")

# Admin task status update
@app.put("/api/admin/tasks/status", response_model=schemas.TaskManagementResult)
def update_task_status(status_update: schemas.TaskStatusUpdate, db: Session = Depends(get_db)):
    try:
        updated_discussion = discussions_service.update_task_status(
            db, status_update.discussion_id, status_update.task_id, status_update.status
        )
        return {
            "success": True,
            "message": f"Task {status_update.task_id} status updated to {status_update.status}",
            "discussion": updated_discussion
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }

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
