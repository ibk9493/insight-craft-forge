
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Union
import json

import models
import schemas
from database import engine, get_db
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service

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

# Root endpoint
@app.get("/")
async def root():
    return {"message": "SWE-QA Annotation API"}

# Discussions endpoints
@app.get("/api/discussions", response_model=List[schemas.Discussion])
def get_all_discussions(db: Session = Depends(get_db)):
    discussions = discussions_service.get_all_discussions(db)
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
