import os
import uuid
import json
import logging
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from dotenv import load_dotenv

from database import engine, SessionLocal, check_and_create_tables
import models
import schemas
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api_server.log")
    ]
)
logger = logging.getLogger("api_server")

# Load environment variables
load_dotenv()

# Check database tables and recreate if necessary
try:
    logger.info("Checking database tables")
    schema_recreated = check_and_create_tables()
    if schema_recreated:
        logger.info("Database schema has been created or updated")
    else:
        logger.info("Database schema is up-to-date")
except Exception as e:
    logger.error(f"Error checking database tables: {str(e)}")
    logger.error(traceback.format_exc())

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

# Middleware for logging requests and responses
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    logger.info(f"Request {request_id} - {request.method} {request.url.path}")
    
    try:
        # Process the request and get the response
        response = await call_next(request)
        logger.info(f"Response {request_id} - Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request {request_id} failed: {str(e)}")
        logger.error(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(e)},
        )

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
        logger.warning("Invalid API key used in request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid API key"
        )
    return x_api_key

# Error handler for database operations
def handle_db_errors(func):
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except OperationalError as e:
            logger.error(f"Database operational error: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        except SQLAlchemyError as e:
            logger.error(f"SQLAlchemy error: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    return wrapper

# Discussion endpoints
@app.get("/api/discussions", response_model=List[schemas.Discussion], dependencies=[Depends(verify_api_key)])
def get_discussions(status: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        logger.info(f"Fetching discussions with status: {status}")
        discussions = discussions_service.get_discussions(db, status)
        logger.info(f"Found {len(discussions)} discussions")
        return discussions
    except Exception as e:
        logger.error(f"Error fetching discussions: {str(e)}")
        logger.error(traceback.format_exc())
        # Return empty list instead of propagating the error
        return []

@app.get("/api/discussions/{discussion_id}", response_model=schemas.Discussion, dependencies=[Depends(verify_api_key)])
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    logger.info(f"Fetching discussion with ID: {discussion_id}")
    discussion = discussions_service.get_discussion_by_id(db, discussion_id)
    if discussion is None:
        logger.warning(f"Discussion not found: {discussion_id}")
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
    try:
        logger.info(f"Fetching annotations - discussion_id: {discussion_id}, user_id: {user_id}, task_id: {task_id}")
        annotations = annotations_service.get_annotations(db, discussion_id, user_id, task_id)
        
        # If specific user, task, and discussion, return a single annotation
        if discussion_id and user_id and task_id and len(annotations) == 1:
            logger.info(f"Found specific annotation for discussion: {discussion_id}, user: {user_id}, task: {task_id}")
            return annotations[0]
        
        logger.info(f"Found {len(annotations)} annotations")
        return annotations
    except Exception as e:
        logger.error(f"Error fetching annotations: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error fetching annotations: {str(e)}")

@app.post("/api/annotations", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def create_annotation(annotation: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Creating annotation for discussion: {annotation.discussionId}, user: {annotation.userId}, task: {annotation.taskId}")
        result = annotations_service.create_or_update_annotation(db, annotation)
        logger.info(f"Annotation created successfully")
        return result
    except Exception as e:
        logger.error(f"Error creating annotation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating annotation: {str(e)}")

@app.put("/api/annotations/{discussion_id}/{user_id}/{task_id}", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def update_annotation(
    discussion_id: str, 
    user_id: str, 
    task_id: int, 
    annotation_update: schemas.AnnotationUpdate, 
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Updating annotation for discussion: {discussion_id}, user: {user_id}, task: {task_id}")
        result = annotations_service.update_annotation(db, discussion_id, user_id, task_id, annotation_update)
        logger.info(f"Annotation updated successfully")
        return result
    except Exception as e:
        logger.error(f"Error updating annotation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error updating annotation: {str(e)}")

# New endpoint for pod leads to override annotations
@app.post("/api/pod-lead/annotations/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def pod_lead_override_annotation(
    override_data: schemas.PodLeadAnnotationOverride, 
    pod_lead_id: str,
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Pod lead {pod_lead_id} overriding annotation for discussion: {override_data.discussion_id}")
        result = annotations_service.pod_lead_override_annotation(db, pod_lead_id, override_data)
        logger.info(f"Pod lead annotation override successful")
        return result
    except Exception as e:
        logger.error(f"Error in pod lead annotation override: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error in pod lead annotation override: {str(e)}")

# Consensus endpoints
@app.get("/api/consensus", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def get_consensus(discussion_id: str, task_id: int, db: Session = Depends(get_db)):
    try:
        logger.info(f"Fetching consensus for discussion: {discussion_id}, task: {task_id}")
        consensus = consensus_service.get_consensus(db, discussion_id, task_id)
        if not consensus:
            logger.warning(f"Consensus not found for discussion: {discussion_id}, task: {task_id}")
            raise HTTPException(status_code=404, detail="Consensus not found")
        return consensus
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching consensus: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error fetching consensus: {str(e)}")

@app.post("/api/consensus", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def create_consensus(consensus: schemas.AnnotationCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Creating consensus for discussion: {consensus.discussionId}, task: {consensus.taskId}")
        result = consensus_service.create_or_update_consensus(db, consensus)
        logger.info(f"Consensus created successfully")
        return result
    except Exception as e:
        logger.error(f"Error creating consensus: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error creating consensus: {str(e)}")

@app.post("/api/consensus/calculate", dependencies=[Depends(verify_api_key)])
def calculate_consensus(discussion_id: str, task_id: int, db: Session = Depends(get_db)):
    try:
        logger.info(f"Calculating consensus for discussion: {discussion_id}, task: {task_id}")
        result = consensus_service.calculate_consensus(db, discussion_id, task_id)
        logger.info(f"Consensus calculation completed: {result}")
        return result
    except Exception as e:
        logger.error(f"Error calculating consensus: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error calculating consensus: {str(e)}")

@app.post("/api/consensus/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def override_consensus(override_data: schemas.ConsensusOverride, db: Session = Depends(get_db)):
    try:
        logger.info(f"Overriding consensus for discussion: {override_data.discussionId}, task: {override_data.taskId}")
        result = consensus_service.override_consensus(db, override_data)
        logger.info(f"Consensus override successful")
        return result
    except Exception as e:
        logger.error(f"Error overriding consensus: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error overriding consensus: {str(e)}")

# File upload endpoint
@app.post("/api/files/upload", dependencies=[Depends(verify_api_key)])
async def upload_file(
    file: UploadFile = File(...), 
    discussion_id: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Uploading file for discussion: {discussion_id} - {file.filename}, size: {file.size}")
        # Generate unique filename
        file_ext = file.filename.split('.')[-1]
        filename = f"{discussion_id}_{uuid.uuid4()}.{file_ext}"
        file_path = UPLOADS_DIR / filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        file_url = f"/uploads/{filename}"
        logger.info(f"File uploaded successfully: {file_url}")
        return {"fileUrl": file_url}
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# Code download endpoint
@app.get("/api/code/download", dependencies=[Depends(verify_api_key)])
def get_code_download_url(discussion_id: str, repo: str):
    try:
        logger.info(f"Generating code download URL for discussion: {discussion_id}, repo: {repo}")
        # In a real app, this would generate/fetch the actual download URL
        download_url = f"https://github.com/{repo}/archive/refs/heads/master.zip"
        logger.info(f"Generated download URL: {download_url}")
        return {"downloadUrl": download_url}
    except Exception as e:
        logger.error(f"Error generating code download URL: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating code download URL: {str(e)}")

# Admin endpoints
@app.post("/api/admin/discussions/upload", dependencies=[Depends(verify_api_key)])
def upload_discussions(discussions_data: schemas.DiscussionUpload, db: Session = Depends(get_db)):
    try:
        discussions = discussions_data.discussions
        logger.info(f"Uploading {len(discussions)} discussions")
        
        # Log first discussion for debugging
        if discussions and len(discussions) > 0:
            logger.info(f"Sample discussion: {json.dumps(discussions[0].dict(), default=str)}")
            
        result = discussions_service.upload_discussions(db, discussions_data)
        logger.info(f"Discussions upload complete: {result}")
        return result
    except Exception as e:
        logger.error(f"Error uploading discussions: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error uploading discussions: {str(e)}")

@app.put("/api/admin/tasks/status", dependencies=[Depends(verify_api_key)])
def update_task_status(task_update: schemas.TaskStatusUpdate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Updating task status for discussion: {task_update.discussionId}, task: {task_update.taskId}, status: {task_update.status}")
        result = discussions_service.update_task_status(db, task_update)
        logger.info(f"Task status updated successfully")
        return result
    except Exception as e:
        logger.error(f"Error updating task status: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error updating task status: {str(e)}")

@app.put("/api/admin/annotations/override", response_model=schemas.Annotation, dependencies=[Depends(verify_api_key)])
def override_annotation(annotation: schemas.AnnotationOverride, db: Session = Depends(get_db)):
    try:
        logger.info(f"Admin overriding annotation for discussion: {annotation.discussionId}, task: {annotation.taskId}")
        result = annotations_service.override_annotation(db, annotation)
        logger.info(f"Annotation override successful")
        return result
    except Exception as e:
        logger.error(f"Error overriding annotation: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error overriding annotation: {str(e)}")

# Auth endpoints
@app.post("/api/auth/google")
def verify_google_token(token_data: schemas.GoogleToken, db: Session = Depends(get_db)):
    try:
        logger.info("Verifying Google token")
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
    except Exception as e:
        logger.error(f"Error verifying Google token: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error verifying Google token: {str(e)}")

@app.get("/api/auth/authorized-users", dependencies=[Depends(verify_api_key)])
def get_authorized_users(db: Session = Depends(get_db)):
    try:
        logger.info("Fetching authorized users")
        result = auth_service.get_authorized_users(db)
        logger.info(f"Found {len(result)} authorized users")
        return result
    except Exception as e:
        logger.error(f"Error fetching authorized users: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error fetching authorized users: {str(e)}")

@app.post("/api/auth/authorized-users", dependencies=[Depends(verify_api_key)])
def add_authorized_user(user_data: schemas.AuthorizedUserCreate, db: Session = Depends(get_db)):
    try:
        logger.info(f"Adding authorized user: {user_data.email}, role: {user_data.role}")
        auth_service.add_or_update_authorized_user(db, user_data)
        logger.info(f"Authorized user added successfully")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error adding authorized user: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error adding authorized user: {str(e)}")

@app.delete("/api/auth/authorized-users/{email}", dependencies=[Depends(verify_api_key)])
def remove_authorized_user(email: str, db: Session = Depends(get_db)):
    try:
        logger.info(f"Removing authorized user: {email}")
        auth_service.remove_authorized_user(db, email)
        logger.info(f"Authorized user removed successfully")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error removing authorized user: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error removing authorized user: {str(e)}")

# Summary endpoints
@app.get("/api/summary/stats", dependencies=[Depends(verify_api_key)])
def get_summary_stats(db: Session = Depends(get_db)):
    try:
        logger.info("Fetching summary statistics")
        result = summary_service.get_summary_stats(db)
        logger.info("Summary statistics fetched successfully")
        return result
    except Exception as e:
        logger.error(f"Error fetching summary statistics: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error fetching summary statistics: {str(e)}")

# Health check endpoint
@app.get("/api/health")
def health_check():
    logger.info("Health check request received")
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Run the app
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting API server")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
