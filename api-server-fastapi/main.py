
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import engine, SessionLocal
import models
import schemas
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service

# Load environment variables
load_dotenv()

# Create database tables
models.Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="SWE-QA API",
    description="API for the Software Engineering QA Annotation System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if it doesn't exist
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API key authentication middleware
async def verify_api_key(x_api_key: str = Header(...)):
    valid_api_key = os.getenv("API_KEY", "development_api_key")
    if x_api_key != valid_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid API key"
        )
    return x_api_key

# Discussion endpoints
@app.get("/api/discussions", response_model=List[schemas.Discussion], dependencies=[Depends(verify_api_key)])
def get_discussions(status: Optional[str] = None, db: Session = Depends(get_db)):
    return discussions_service.get_discussions(db, status)

@app.get("/api/discussions/{discussion_id}", response_model=schemas.Discussion, dependencies=[Depends(verify_api_key)])
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    discussion = discussions_service.get_discussion_by_id(db, discussion_id)
    if discussion is None:
        raise HTTPException(status_code=404, detail="Discussion not found")
    return discussion

# Annotation endpoints
@app.get("/api/annotations", response_model=Union[List[schemas.Annotation], schemas.Annotation], dependencies=[Depends(verify_api_key)])
def get_annotations(
    discussion_id: Optional[str] = None, 
    user_id: Optional[str] = None, 
    task_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    annotations = annotations_service.get_annotations(db, discussion_id, user_id, task_id)
    
    # If specific user, task, and discussion, return a single annotation
    if discussion_id and user_id and task_id and len(annotations) == 1:
        return annotations[0]
    
    return annotations

@app.post("/api/annotations", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def create_annotation(annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    return annotations_service.create_or_update_annotation(db, annotation)

@app.put("/api/annotations/{discussion_id}/{user_id}/{task_id}", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def update_annotation(
    discussion_id: str, 
    user_id: str, 
    task_id: int, 
    annotation_update: schemas.AnnotationUpdate, 
    db: Session = Depends(get_db)
):
    return annotations_service.update_annotation(db, discussion_id, user_id, task_id, annotation_update)

# New endpoint for pod leads to override annotations
@app.post("/api/pod-lead/annotations/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def pod_lead_override_annotation(
    override_data: schemas.PodLeadAnnotationOverride, 
    pod_lead_id: str,
    db: Session = Depends(get_db)
):
    return annotations_service.pod_lead_override_annotation(db, pod_lead_id, override_data)

# Consensus endpoints
@app.get("/api/consensus", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def get_consensus(discussion_id: str, task_id: int, db: Session = Depends(get_db)):
    consensus = consensus_service.get_consensus(db, discussion_id, task_id)
    if not consensus:
        raise HTTPException(status_code=404, detail="Consensus not found")
    return consensus

@app.post("/api/consensus", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def create_consensus(consensus: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    return consensus_service.create_or_update_consensus(db, consensus)

@app.post("/api/consensus/calculate", dependencies=[Depends(verify_api_key)])
def calculate_consensus(discussion_id: str, task_id: int, db: Session = Depends(get_db)):
    return consensus_service.calculate_consensus(db, discussion_id, task_id)

@app.post("/api/consensus/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def override_consensus(override_data: schemas.ConsensusOverride, db: Session = Depends(get_db)):
    return consensus_service.override_consensus(db, override_data)

# File upload endpoint
@app.post("/api/files/upload", dependencies=[Depends(verify_api_key)])
async def upload_file(
    file: UploadFile = File(...), 
    discussion_id: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        # Generate unique filename
        file_ext = file.filename.split('.')[-1]
        filename = f"{discussion_id}_{uuid.uuid4()}.{file_ext}"
        file_path = UPLOADS_DIR / filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        file_url = f"/uploads/{filename}"
        return {"fileUrl": file_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# Code download endpoint
@app.get("/api/code/download", dependencies=[Depends(verify_api_key)])
def get_code_download_url(discussion_id: str, repo: str):
    # In a real app, this would generate/fetch the actual download URL
    download_url = f"https://github.com/{repo}/archive/refs/heads/master.zip"
    return {"downloadUrl": download_url}

# Admin endpoints
@app.post("/api/admin/discussions/upload", dependencies=[Depends(verify_api_key)])
def upload_discussions(discussions_data: schemas.DiscussionUpload, db: Session = Depends(get_db)):
    return discussions_service.upload_discussions(db, discussions_data)

@app.put("/api/admin/tasks/status", dependencies=[Depends(verify_api_key)])
def update_task_status(task_update: schemas.TaskStatusUpdate, db: Session = Depends(get_db)):
    return discussions_service.update_task_status(db, task_update)

@app.put("/api/admin/annotations/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def override_annotation(annotation: schemas.AnnotationOverride, db: Session = Depends(get_db)):
    return annotations_service.override_annotation(db, annotation)

# Auth endpoints
@app.post("/api/auth/google")
def verify_google_token(token_data: schemas.GoogleToken, db: Session = Depends(get_db)):
    # In a real app, this would verify the Google token with Google's servers
    # For demo purposes, we'll just return success
    return {
        "success": True,
        "user": {
            "id": str(uuid.uuid4()),
            "username": "google.user@example.com",
            "email": "google.user@example.com",
            "role": "annotator",
            "provider": "google"
        }
    }

@app.get("/api/auth/authorized-users", dependencies=[Depends(verify_api_key)])
def get_authorized_users(db: Session = Depends(get_db)):
    return auth_service.get_authorized_users(db)

@app.post("/api/auth/authorized-users", dependencies=[Depends(verify_api_key)])
def add_authorized_user(user_data: schemas.AuthorizedUserCreate, db: Session = Depends(get_db)):
    auth_service.add_or_update_authorized_user(db, user_data)
    return {"success": True}

@app.delete("/api/auth/authorized-users/{email}", dependencies=[Depends(verify_api_key)])
def remove_authorized_user(email: str, db: Session = Depends(get_db)):
    auth_service.remove_authorized_user(db, email)
    return {"success": True}

# Summary endpoints
@app.get("/api/summary/stats", dependencies=[Depends(verify_api_key)])
def get_summary_stats(db: Session = Depends(get_db)):
    return summary_service.get_summary_stats(db)

# Run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
