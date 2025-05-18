from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Union
import json
import os
from typing import List, Dict, Any  # Import Any with uppercase A
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
