import logging
from datetime import datetime, timezone, timedelta
from operator import and_
from fastapi import FastAPI, Depends, HTTPException, Query, Response, Body, status, Request, APIRouter, Path
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Union, Any
import json
import os
# from typing import List, Dict, Any # Already imported with more specifics
import models
import schemas
from database import engine, get_db, check_and_create_tables
from services import discussions_service, annotations_service, consensus_service, auth_service, summary_service, \
    batch_service, jwt_auth_service, user_agreement_service,    general_report_service, pod_lead_service

# from fastapi import APIRouter, Depends, HTTPException # Already imported
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
# from sqlalchemy.orm import Session # Already imported
# from typing import Dict, Any, Optional, List # Already imported
# from datetime import datetime, timedelta # Already imported
from jose import JWTError, jwt
from passlib.context import CryptContext
# import os # Already imported
import secrets
import google.oauth2.id_token
import google.auth.transport.requests
from pydantic import BaseModel

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Annotation Tool API",
    version="1.0.0",
    description="API for managing discussions, annotations, and user authentication for an annotation tool."
)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info(f"Server started")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8081", "http://34.9.91.120:8080",
                   "http://34.9.91.120:8081", "http://localhost:8082"],  # Specific origin for credentials
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
        # Check if the user already exists
        existing_user = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.email == "admin1@turing.com"
        ).first()

        if not existing_user:
            # Create a new user with hashed password

            default_password = "Test1234!"
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
                default_password = "Test1234!"
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

@app.get("/api/tasks/{discussion_id}/{task_id}/completion-status")
def get_task_completion_status(discussion_id: str, task_id: int, db: Session = Depends(get_db)):
    consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(db, discussion_id, task_id)
    if consensus:
        return consensus_service._get_task_completion_status(consensus.data, task_id)
    else:
        return {"can_complete": False, "message": "No consensus exists yet"}
# Discussions endpoints
@app.get("/api/discussions", response_model=schemas.PaginatedDiscussionResponse)
def get_all_discussions(
        status: Optional[str] = None,
        search: Optional[str] = None,
        repository_language: Optional[str] = None,  # Comma-separated
        release_tag: Optional[str] = None,          # Comma-separated
        from_date: Optional[str] = None,            # ISO date string
        to_date: Optional[str] = None,              # ISO date string
        batch_id: Optional[int] = None,
        user_id: Optional[str] = None,
        task1_status: Optional[str] = None,         # ADD THIS
        task2_status: Optional[str] = None,         # ADD THIS
        task3_status: Optional[str] = None,         # ADD THIS
        page: int = Query(1, ge=1, description="Page number, starting from 1"),
        per_page: int = Query(10, ge=1, le=100, description="Items per page (1-100)"),
        db: Session = Depends(get_db)
):
    try:
        # Build filter parameters
 
        logger.info(f"ENDPOINT DEBUG - Received parameters:")
        logger.info(f"  task1_status: {task1_status}")
        logger.info(f"  task2_status: {task2_status}")
        logger.info(f"  task3_status: {task3_status}")
        
        # Build filter parameters
        filters = {
            'status': status,
            'search': search,
            'repository_language': repository_language.split(',') if repository_language else None,
            'release_tag': release_tag.split(',') if release_tag else None,
            'from_date': from_date,
            'to_date': to_date,
            'batch_id': batch_id,
            'user_id': user_id,
            'task1_status': task1_status,
            'task2_status': task2_status,
            'task3_status': task3_status
        }
        
        # ADD THIS DEBUG LOGGING:
        logger.info(f"ENDPOINT DEBUG - Built filters dict:")
        logger.info(f"  {filters}")
        # Calculate offset
        offset = (page - 1) * per_page
        
        # Get total count and paginated results
        total_count = discussions_service.get_discussions_count(db, filters)
        discussions = discussions_service.get_discussions(
            db,
            filters=filters,
            limit=per_page,
            offset=offset
        )
        
        # Calculate total pages
        total_pages = (total_count + per_page - 1) // per_page
        
        return schemas.PaginatedDiscussionResponse(
            items=discussions,
            total=total_count,
            page=page,
            per_page=per_page,
            pages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Error in get_all_discussions: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/discussions/{discussion_id}", response_model=schemas.Discussion)
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    return discussions_service.get_discussion_by_id(db, discussion_id)



@app.get("/api/filter-options", response_model=schemas.FilterOptionsResponse)
def get_filter_options_endpoint(db: Session = Depends(get_db)):
    """
    Get available filter options from the database.
    """
    logger.info("=== ENDPOINT: Filter options called ===")
    
    try:
        options = discussions_service.get_filter_options(db)
        logger.info(f"ENDPOINT: Service returned: {options}")
        logger.info(f"ENDPOINT: Options type: {type(options)}")
        
        if options is None:
            logger.error("ENDPOINT: Service returned None!")
            raise HTTPException(status_code=500, detail="Service returned None")
        
        # Validate the structure
        required_keys = ['repository_languages', 'release_tags', 'batches', 'date_range']
        for key in required_keys:
            if key not in options:
                logger.error(f"ENDPOINT: Missing key {key} in options")
                options[key] = [] if key != 'date_range' else {'min_date': None, 'max_date': None}
        
        logger.info("ENDPOINT: Creating response model...")
        response = schemas.FilterOptionsResponse(**options)
        logger.info(f"ENDPOINT: Response created successfully: {response}")
        
        return response
        
    except Exception as e:
        logger.error(f"ENDPOINT ERROR: {str(e)}")
        import traceback
        logger.error(f"ENDPOINT TRACEBACK: {traceback.format_exc()}")
        
        # Return a valid empty response
        return schemas.FilterOptionsResponse(
            repository_languages=[],
            release_tags=[],
            batches=[],
            date_range={'min_date': None, 'max_date': None}
        )

@app.get("/api/get/all/discussions", response_model=List[schemas.Discussion])
def get_all_discussions_outdated(
        status: Optional[str] = None,
        db: Session = Depends(get_db)
):
    discussions = discussions_service.get_discussions(db, status)
    return discussions
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

    if result.discussion:
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
            "tasks": result.discussion.tasks,
            "question": result.discussion.question,
            "answer": result.discussion.answer,
            "category": result.discussion.category,
            "knowledge": result.discussion.knowledge,
            "code": result.discussion.code
        }
        discussion = schemas.Discussion(**discussion_dict)
        result.discussion = discussion

    return result


@app.put("/api/admin/tasks/bulk-status", response_model=schemas.BulkTaskManagementResult)
def update_bulk_task_status_route(bulk_data: schemas.BulkTaskStatusUpdate, db: Session = Depends(get_db)):
    results = []
    for discussion_id in bulk_data.discussion_ids:
        result = discussions_service.update_task_status(db, discussion_id, bulk_data.task_id, bulk_data.status)

        if result.discussion:
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
                "tasks": result.discussion.tasks,
                "question": result.discussion.question,
                "answer": result.discussion.answer,
                "category": result.discussion.category,
                "knowledge": result.discussion.knowledge,
                "code": result.discussion.code
            }
            discussion = schemas.Discussion(**discussion_dict)
            result.discussion = discussion

        results.append(result)

    return schemas.BulkTaskManagementResult(results=results)


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
    return batch_service.get_all_batches(db)


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchUpload)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = batch_service.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@app.post("/api/batches", response_model=schemas.BatchManagementResult)
def create_batch(batch: schemas.BatchUploadCreate, db: Session = Depends(get_db)):
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
    batch = batch_service.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return batch_service.get_batch_discussions(db, batch_id)


@app.put("/api/batches/{batch_id}", response_model=schemas.BatchManagementResult)
def update_batch(batch_id: int, batch_data: schemas.BatchUploadCreate, db: Session = Depends(get_db)):
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
    if format.lower() not in ["json", "csv"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")

    def _process_task3_annotation_data(data):
        """Process Task 3 annotation data to handle new forms structure"""
        processed_data = data.copy()
        
        # Remove ALL form metadata from annotations
        metadata_fields = ["forms", "form_index", "form_id", "form_name", "form_type", "total_forms"]
        for field in metadata_fields:
            processed_data.pop(field, None)
            
        # Rename fields to match expected output format
        if "classify" in processed_data:
            processed_data["question_type"] = processed_data.pop("classify")
        if "rewrite_text" in processed_data:
            processed_data["rewritten_question"] = processed_data.pop("rewrite_text")
        if "supporting_docs_data" in processed_data:
            processed_data["supporting_docs"] = processed_data.pop("supporting_docs_data")
        
        # Handle short_answer_list conversion from new format to old format for API compatibility
        if data.get("short_answer_list"):
            short_answers = data["short_answer_list"]
            
            # If it's the new nested array format (multiple forms)
            if isinstance(short_answers, list) and len(short_answers) > 0 and isinstance(short_answers[0], list):
                # Flatten for API - convert claim/weight objects to strings
                flattened = []
                for form_answers in short_answers:
                    for item in form_answers:
                        if isinstance(item, dict) and 'claim' in item:
                            flattened.append({"claim": item['claim'], "weight": str(item.get('weight', 1))})
                        else:
                            flattened.append(str(item))
                processed_data["short_answer_list"] = flattened
            
            # If it's single form with claim/weight objects
            elif isinstance(short_answers, list) and len(short_answers) > 0 and isinstance(short_answers[0], dict):
                flattened = []
                for item in short_answers:
                    if isinstance(item, dict) and 'claim' in item:
                        flattened.append({"claim": item['claim'], "weight": str(item.get('weight', 1))})
                    else:
                        flattened.append(str(item))
                processed_data["short_answer_list"] = flattened
        
        return processed_data

    def _process_task3_consensus_data(data):
        """Process Task 3 consensus data to handle new forms structure"""
        if not data:
            return [{}]  # Return array with empty object
        
        # Handle the new forms structure in consensus
        if data.get("forms") and isinstance(data["forms"], list):
            # Determine if this is Type Q (Questions) or Type A (Answers)
            # First form is default (no type), subsequent forms have type indicators
            form_types = []
            has_answer_type = False
            
            for i, form in enumerate(data["forms"]):
                form_name = form.get("formName", "")
                if i == 0:
                    # First form is default, we'll determine its type based on other forms
                    form_types.append("default")
                elif "A" in form_name:
                    form_types.append("A")
                    has_answer_type = True
                elif "Q" in form_name:
                    form_types.append("Q")
                else:
                    # Fallback for subsequent forms
                    form_types.append("Q")
            
            # If any subsequent form has type A, then this is an Answer scenario
            # and the first form should also be treated as type A
            if has_answer_type:
                form_types[0] = "A"  # Set first form to A as well
            else:
                form_types[0] = "Q"  # Set first form to Q (different questions)
            
            # If all forms are Type A (Answers), merge them
            if all(t == "A" for t in form_types):
                processed_data = data.copy()  # Start with base data
                
                # Collect all answers from different forms
                all_short_answers = []
                all_long_answers = []
                all_rewritten_questions = []
                all_supporting_docs = []
                question_types = []
                
                for form in data["forms"]:
                    # FIX: Collect short answers from each form
                    if "short_answer_list_items" in form:
                        items = form["short_answer_list_items"]
                        if isinstance(items, list):
                            converted_items = []
                            for item in items:
                                # Convert string items to claim/weight format
                                converted_items.append({"claim": str(item), "weight": "1"})
                            # ADD TO all_short_answers - THIS WAS MISSING!
                            all_short_answers.append(converted_items)
                    
                    # Handle the status field - if it's just "Completed", add empty array
                    elif form.get("short_answer_list") == "Completed":
                        all_short_answers.append([])
                    
                    # Collect long answers
                    if "longAnswer_text" in form:
                        all_long_answers.append(form["longAnswer_text"])
                    
                    # Collect rewritten questions (should be same for Type A, but collect anyway)
                    if "rewrite_text" in form:
                        all_rewritten_questions.append(form["rewrite_text"])
                    
                    # Collect supporting docs
                    if "supporting_docs" in form:
                        form_supporting_docs = []
                        for doc in form["supporting_docs"]:
                            form_supporting_docs.append({
                                "link": doc.get("link", ""),
                                "supporting_paragraph": doc.get("paragraph", "")
                            })
                        all_supporting_docs.extend(form_supporting_docs)
                    
                    # Collect question types
                    if "classify" in form:
                        question_types.append(form["classify"])
                
                # Set merged data - KEEP AS ARRAYS for Type A (multiple answers to same question)
                processed_data["short_answer_list"] = all_short_answers  # Array of arrays - CORRECT
                processed_data["long_answer"] = all_long_answers  # Array of strings - CORRECT
                processed_data["rewritten_question"] = [all_rewritten_questions[0]] if all_rewritten_questions else []  # Unique questions
                processed_data["supporting_docs"] = all_supporting_docs  # Combined docs
                processed_data["question_type"] = question_types[0] if question_types else "Reasoning"  # Use first type
                
                # REMOVE form metadata from consensus data
                metadata_fields = ["forms", "form_type", "total_forms", "form_index", "form_id", "form_name","stars","comment","_last_updated"]
                for field in metadata_fields:
                    processed_data.pop(field, None)
                
                return [processed_data]  # Return single merged entry
            
            # If Type Q (Questions) or mixed, create separate entries
            else:
                results = []
                
                for form_index, form in enumerate(data["forms"]):
                    processed_data = data.copy()  # Start with base data
                    
                    # Map form fields to top-level fields
                    if "rewrite_text" in form:
                        processed_data["rewritten_question"] = [form["rewrite_text"]]  # Convert to array
                    if "longAnswer_text" in form:
                        processed_data["long_answer"] = form["longAnswer_text"]
                    if "classify" in form:
                        processed_data["question_type"] = form["classify"]
                    
                    # Handle short_answer_list_items from forms (Type Q processing)
                    if "short_answer_list_items" in form:
                        items = form["short_answer_list_items"]
                        if isinstance(items, list):
                            converted_items = []
                            for item in items:
                                converted_items.append({"claim": str(item), "weight": "1"})
                            processed_data["short_answer_list"] = converted_items
                    
                    # Handle short_answer_list from forms (if already processed)
                    elif "short_answer_list" in form:
                        form_answers = form["short_answer_list"]
                        if isinstance(form_answers, list):
                            flattened = []
                            for item in form_answers:
                                if isinstance(item, dict) and 'claim' in item:
                                    flattened.append({"claim": item['claim'], "weight": str(item.get('weight', 1))})
                                else:
                                    flattened.append({"claim": str(item), "weight": "1"})
                            processed_data["short_answer_list"] = flattened
                    
                    # Handle supporting docs from forms
                    if "supporting_docs" in form:
                        # Map paragraph to supporting_paragraph
                        supporting_docs = []
                        for doc in form["supporting_docs"]:
                            supporting_docs.append({
                                "link": doc.get("link", ""),
                                "supporting_paragraph": doc.get("paragraph", "")
                            })
                        processed_data["supporting_docs"] = supporting_docs
                    
                    # REMOVE form metadata from consensus data (don't add them)
                    metadata_fields = ["forms", "form_index", "form_id", "form_name", "form_type", "total_forms"]
                    for field in metadata_fields:
                        processed_data.pop(field, None)
                    
                    results.append(processed_data)
                
                return results
        
        # Handle single form or legacy format
        processed_data = data.copy()

        # Handle consensus format with short_answer_list_items
        if "short_answer_list_items" in processed_data:
            items = processed_data["short_answer_list_items"]
            if isinstance(items, list):
                converted_items = []
                for item in items:
                    converted_items.append({"claim": str(item), "weight": "1"})
                processed_data["short_answer_list"] = converted_items
            processed_data.pop("short_answer_list_items", None)

        # Convert rewritten_question from string to array if needed
        if "rewritten_question" in processed_data and isinstance(processed_data["rewritten_question"], str):
            processed_data["rewritten_question"] = [processed_data["rewritten_question"]]

        # Handle supporting_docs field name mapping if needed
        if "supporting_docs" in processed_data:
            supporting_docs = []
            for doc in processed_data["supporting_docs"]:
                if isinstance(doc, dict):
                    supporting_docs.append({
                        "link": doc.get("link", ""),
                        "supporting_paragraph": doc.get("paragraph", doc.get("supporting_paragraph", ""))
                    })
                else:
                    supporting_docs.append(doc)
            processed_data["supporting_docs"] = supporting_docs

        # Handle short_answer_list format conversion (existing logic)
        if "short_answer_list" in processed_data and isinstance(processed_data["short_answer_list"], list):
            short_answers = processed_data["short_answer_list"]
            if len(short_answers) > 0 and isinstance(short_answers[0], str):
                # Convert string format to dict format
                converted = []
                for item in short_answers:
                    if "(weight:" in str(item):
                        parts = str(item).rsplit(" (weight:", 1)
                        claim = parts[0].strip()
                        weight = parts[1].rstrip(")").strip() if len(parts) > 1 else "1"
                    else:
                        claim = str(item).strip()
                        weight = "1"
                    converted.append({"claim": claim, "weight": weight})
                processed_data["short_answer_list"] = converted

        # REMOVE form metadata from consensus data
        metadata_fields = ["forms", "form_index", "form_id", "form_name", "form_type", "total_forms", "stars", "comment", "_last_updated"]
        for field in metadata_fields:
            processed_data.pop(field, None)

        return [processed_data]  
    
    
    # Return array with single object  # Return array with single object  # Return array with single object
    def has_annotation_data(annotation, task_id):
        """
        Check if an annotation has actual data for the given task
        Returns True if annotation contains meaningful data, False otherwise
        """
        if not annotation or not hasattr(annotation, 'data') or not annotation.data:
            return False
        
        data = annotation.data
        
        if task_id == 1:
            # Task 1 required fields
            task1_fields = ['relevance', 'learning', 'clarity']
            # Check if at least one required field exists and is not None/empty
            return any(field in data and data[field] is not None for field in task1_fields)
        
        elif task_id == 2:
            # Task 2 required fields
            task2_fields = ['aspects', 'explanation', 'execution']
            # Check if at least one required field exists and is not None/empty
            return any(field in data and data[field] is not None for field in task2_fields)
        
        elif task_id == 3:
            # Task 3 required fields
            task3_fields = ['short_answer_list', 'longAnswer_text', 'rewrite_text', 'classify']
            # Check if at least one required field exists and is not None/empty
            return any(field in data and data[field] is not None and data[field] != "" for field in task3_fields)
        
        return False
    # GET ALL DISCUSSIONS
    discussions = discussions_service.get_discussions(db, filters=None, limit=100000, offset=0)

    
    result = []
    for discussion in discussions:
        # Get annotations for each task
        task1_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=1)
        task2_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=2)
        task3_annotations = annotations_service.get_annotations(db, discussion_id=discussion.id, task_id=3)

        # Get consensus for each task
        task1_consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(db, discussion.id, 1)
        task2_consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(db, discussion.id, 2)
        task3_consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(db, discussion.id, 3)

        # Extract consensus data separately for each task
        task1_consensus_data = task1_consensus.data if task1_consensus else {}
        task2_consensus_data = task2_consensus.data if task2_consensus else {}
        task3_consensus_data = task3_consensus.data if task3_consensus else {}

        # Extract basic discussion info
        code = ""
        lang = discussion.repository_language or "python"
        question = discussion.question or ""
        answer = discussion.answer or ""
        category = discussion.category or ""
        knowledge = discussion.knowledge or ""

        # Try to extract code from annotations if not in discussion
        try:
            for annotation in task1_annotations + task2_annotations + task3_annotations:
                if annotation.data.get("code"):
                    code = annotation.data.get("code", "")
                    break
        except Exception as e:
            print(f"Error extracting code for discussion {discussion.id}: {str(e)}")

        # Task 3 consensus - now returns array of processed data
        task3_consensus_results = _process_task3_consensus_data(task3_consensus_data)

        # Create entries - duplicate entire discussion for Type Q, single entry for Type A
        for form_index, form_result in enumerate(task3_consensus_results):
        # Create a unique ID based on form type
            base_id = discussion.id
            if form_result.get("form_type") == "Q" and len(task3_consensus_results) > 1:
                # Type Q: Different questions - create unique IDs for each form
                unique_id = f"{base_id}_{form_index}"
            else:
                # Type A: Same question, multiple answers - keep same ID
                # Or single form - keep original ID
                unique_id = str(base_id)

            # Filter annotations that have actual data
            filtered_task1_annotations = [ann for ann in task1_annotations if has_annotation_data(ann, 1)]
            filtered_task2_annotations = [ann for ann in task2_annotations if has_annotation_data(ann, 2)]
            filtered_task3_annotations = [ann for ann in task3_annotations if has_annotation_data(ann, 3)]

            # Build the main entry (complete discussion duplication for Type Q)
            entry = {
                "id": unique_id,
                "url": discussion.url,
                "code": code,
                "lang": lang,
                "answer": answer,
                "category": category,
                "question": question,
                "createdAt": discussion.created_at,
                "knowledge": knowledge,
                
                # Task 1 annotations (only with data)
                "annotations_task_1": [
                    {
                        "annotator": int(annotation.user_id),
                        "relevance": annotation.data.get("relevance", False),
                        "learning_value": annotation.data.get("learning", False),
                        "clarity": annotation.data.get("clarity", False),
                        **({"image_grounded": annotation.data.get("grounded", False)} if annotation.data.get("grounded", "") != "N/A" else {}),
                    }
                    for annotation in filtered_task1_annotations
                ],
                
                # Task 2 annotations (only with data)
                "annotations_task_2": [
                    {
                        "annotator": int(annotation.user_id),
                        "address_all_aspects": annotation.data.get("aspects", False),
                        "justification_for_addressing_all_aspects": annotation.data.get("explanation_text", ""),
                        "with_explanation": annotation.data.get("explanation", False),
                        "code_executable": annotation.data.get("execution") in ["Executable", "N/A"],
                        "code_download_link": annotation.data.get("codeDownloadUrl", ""),
                        "code_execution_screenshot": annotation.data.get("screenshot", "N/A"),
                    }
                    for annotation in filtered_task2_annotations
                ],
                
                # Task 3 annotations (only with data)
                "annotations_task_3": [
                    {
                        "annotator": int(annotation.user_id),
                        **_process_task3_annotation_data(annotation.data)
                    }
                    for annotation in filtered_task3_annotations
                ],
            }

            # Only add Task 1 consensus if data exists
            if task1_consensus_data:
                entry["agreed_annotation_task_1"] = {
                    "relevance": task1_consensus_data.get("relevance", False),
                    "learning_value": task1_consensus_data.get("learning", False),
                    "clarity": task1_consensus_data.get("clarity", False),
                    **({"image_grounded": task1_consensus_data.get("grounded", False)} if task1_consensus_data.get("grounded", "") != "N/A" else {}),
                }
            else:
                entry["agreed_annotation_task_1"] = {}

            # Only add Task 2 consensus if data exists
            if task2_consensus_data:
                entry["agreed_annotation_task_2"] = {
                    "address_all_aspects": task2_consensus_data.get("aspects", False),
                    "justification_for_addressing_all_aspects": task2_consensus_data.get("explanation_text", ""),
                    "with_explanation": task2_consensus_data.get("explanation", False),
                    "code_executable": task2_consensus_data.get("execution") in ["Executable", "N/A"],
                    "code_download_link": task2_consensus_data.get("codeDownloadUrl", ""),
                    "code_execution_screenshot": task2_consensus_data.get("screenshot", "N/A"),
                }
            else:
                entry["agreed_annotation_task_2"] = {}
            # Only add Task 3 consensus if data exists
            if task3_consensus_data and form_result:
                entry["agreed_annotation_task_3"] = form_result
                
                # Add required fields with defaults if missing for Task 3
                task3_required_fields = {
                    "question_type": "",
                    "short_answer_list": [],
                    "long_answer": [""],
                    "rewritten_question": [],
                    "supporting_docs": []
                }
                for field, default_value in task3_required_fields.items():
                    if field not in entry["agreed_annotation_task_3"]:
                        entry["agreed_annotation_task_3"][field] = default_value
            else:
                entry["agreed_annotation_task_3"] ={}
            # Add form metadata to the entry if multiple forms exist
            if len(task3_consensus_results) > 1:
                entry["form_metadata"] = {
                    "form_index": form_result.get("form_index", 0),
                    "form_id": form_result.get("form_id", ""),
                    "form_name": form_result.get("form_name", ""),
                    "total_forms": len(task3_consensus_results),
                    "form_type": form_result.get("form_type", "Q")
                }

            result.append(entry)
        if format.lower() == "csv":
            pass
        
    return result
@app.get("/api/auth/authorized-users", response_model=List[schemas.AuthorizedUser], tags=["Auth"])

def get_authorized_users_list(
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    return auth_service.get_authorized_users(db)


@app.post("/api/auth/authorized-users", response_model=schemas.AuthorizedUser, tags=["Auth"])
def add_authorized_user_to_list(
        user: schemas.AuthorizedUserCreate,
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    return auth_service.add_or_update_authorized_user(db, user)


@app.delete("/api/auth/authorized-users/{email}", tags=["Auth"])
def remove_authorized_user_from_list(
        email: str,
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    auth_service.remove_authorized_user(db, email)
    return {"message": f"User {email} removed from authorized users"}


@app.post("/api/auth/login", response_model=schemas.LoginResponse, tags=["Auth"])
async def login(
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        data = await request.json()
        email = data.get("email", "")
        password = data.get("password", "")
        user = await jwt_auth_service.authenticate_user(db, email, password)
        if not user:
            return schemas.LoginResponse(success=False, message="Invalid email or password")
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        user_response = {"id": str(user.id), "username": user.email, "role": user.role, "provider": "local"}
        return schemas.LoginResponse(success=True, message="Login successful", user=user_response, token=access_token)
    except Exception as e:
        return schemas.LoginResponse(success=False, message=f"Login failed: {str(e)}")


@app.post("/api/auth/token", tags=["Auth"])
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
    return {"access_token": access_token, "token_type": "bearer",
            "user": {"id": str(user.id), "username": user.email, "role": user.role}}


@app.post("/api/auth/google/login", response_model=schemas.LoginResponse, tags=["Auth"])
async def google_login(
        token_data: schemas.GoogleToken,
        db: Session = Depends(get_db)
):
    try:
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        if not GOOGLE_CLIENT_ID:
            return schemas.LoginResponse(success=False, message="Google authentication is not configured")
        request_transport = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(token_data.credential, request_transport, GOOGLE_CLIENT_ID)
        email = id_info.get("email")
        if not email:
            return schemas.LoginResponse(success=False, message="Email not found in Google token")
        user = auth_service.check_if_email_authorized(db, email)
        if not user:
            return schemas.LoginResponse(success=False, message="Email not authorized for login")
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": user.email, "role": user.role},
            expires_delta=access_token_expires
        )
        user_response = {"id": str(user.id), "username": user.email, "role": user.role, "provider": "google"}
        return schemas.LoginResponse(success=True, message="Google login successful", user=user_response,
                                     token=access_token)
    except Exception as e:
        return schemas.LoginResponse(success=False, message=f"Google login failed: {str(e)}")


@app.post("/api/auth/google/verify", response_model=Dict[str, Any], tags=["Auth"])
async def verify_google_token(
        token_data: schemas.GoogleToken,
        db: Session = Depends(get_db)
):
    try:
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        if not GOOGLE_CLIENT_ID:
            return {"success": False, "message": "Google authentication is not configured"}
        request_transport = google.auth.transport.requests.Request()
        id_info = google.oauth2.id_token.verify_oauth2_token(token_data.credential, request_transport, GOOGLE_CLIENT_ID)
        email = id_info.get("email")
        if not email:
            return {"success": False, "message": "Email not found in Google token"}
        user = auth_service.check_if_email_authorized(db, email)
        if not user:
            return {"success": False, "message": "Email not authorized"}
        return {"success": True, "user": {"id": str(user.id), "email": user.email, "role": user.role}}
    except Exception as e:
        return {"success": False, "message": f"Google token verification failed: {str(e)}"}


@app.post("/api/auth/signup", response_model=schemas.LoginResponse, tags=["Auth"])
async def signup(
        user_data: schemas.UserSignup,  # Changed from UserSignup to schemas.UserSignup
        db: Session = Depends(get_db)
):
    try:
        existing_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == user_data.email).first()
        authorized = auth_service.check_if_email_authorized(db, user_data.email)
        if not authorized:
            return schemas.LoginResponse(success=False, message="Email not authorized for signup")
        if existing_user:
            if not existing_user.password_hash:
                existing_user.password_hash = jwt_auth_service.get_password_hash(user_data.password)
                db.commit()
                db.refresh(existing_user)
                access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
                access_token = jwt_auth_service.create_access_token(
                    data={"sub": existing_user.email, "role": existing_user.role}, expires_delta=access_token_expires)
                user_response = {"id": str(existing_user.id), "username": existing_user.email,
                                 "role": existing_user.role, "provider": "local"}
                return schemas.LoginResponse(success=True, message="Account created successfully", user=user_response,
                                             token=access_token)
            else:
                return schemas.LoginResponse(success=False, message="Email already registered")
        hashed_password = jwt_auth_service.get_password_hash(user_data.password)
        new_user = models.AuthorizedUser(email=user_data.email, role=authorized.role, password_hash=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        access_token_expires = timedelta(minutes=jwt_auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = jwt_auth_service.create_access_token(
            data={"sub": new_user.email, "role": new_user.role}, expires_delta=access_token_expires)
        user_response = {"id": str(new_user.id), "username": new_user.email, "role": new_user.role, "provider": "local"}
        return schemas.LoginResponse(success=True, message="Account created successfully", user=user_response,
                                     token=access_token)
    except Exception as e:
        return schemas.LoginResponse(success=False, message=f"Signup failed: {str(e)}")


@app.post("/api/auth/change-password", tags=["Auth"])
async def change_password(
        password_data: schemas.PasswordChange,
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    try:
        db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == current_user.email).first()
        if not jwt_auth_service.verify_password(password_data.current_password, db_user.password_hash):
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST,
                                content={"success": False, "message": "Current password is incorrect"})
        hashed_password = jwt_auth_service.get_password_hash(password_data.new_password)
        db_user.password_hash = hashed_password
        db.commit()
        return {"success": True, "message": "Password changed successfully"}
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            content={"success": False, "message": f"Failed to change password: {str(e)}"})


@app.post("/api/auth/reset-password/{user_email}", tags=["Auth"])
async def reset_password(
        user_email: str,
        reset_data: schemas.PasswordReset,
        admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    try:
        db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.email == user_email).first()
        if not db_user:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                                content={"success": False, "message": "User not found"})
        hashed_password = jwt_auth_service.get_password_hash(reset_data.new_password)
        db_user.password_hash = hashed_password
        db.commit()
        return {"success": True, "message": f"Password reset for {user_email}"}
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            content={"success": False, "message": f"Failed to reset password: {str(e)}"})


@app.get("/api/auth/me", tags=["Auth"])
async def get_me(current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_current_user)):
    if not current_user:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED,
                            content={"authenticated": False, "message": "Not authenticated"})
    return {"authenticated": True,
            "user": {"id": str(current_user.id), "username": current_user.email, "role": current_user.role,
                     "provider": "local"}}


@app.get("/api/auth/check-email/{email}", response_model=Optional[schemas.AuthorizedUser], tags=["Auth"])
async def check_email_authorization(email: str, db: Session = Depends(get_db)):
    user = auth_service.check_if_email_authorized(db, email)
    return user


@app.post("/api/auth/verify-user", response_model=schemas.AuthorizedUser, tags=["Auth"])
async def verify_user_authorization(email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    try:
        user = auth_service.verify_user_authorization(db, email)
        return user
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ================= Annotation APIs =================
@app.put("/api/annotations/{discussion_id}/{user_id}/{task_id}", response_model=schemas.Annotation,
         tags=["Annotations"])
async def update_annotation(
        discussion_id: str,
        user_id: str,
        task_id: int,
        annotation_update: schemas.AnnotationUpdate,
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    if current_user.email != user_id and current_user.role not in ["admin", "pod_lead"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You can only update your own annotations unless you are a pod lead or admin")
    try:
        updated_annotation = annotations_service.update_annotation(db, discussion_id, user_id, task_id,
                                                                   annotation_update)
        return updated_annotation
    except annotations_service.AnnotationNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.put("/api/pod-lead/annotations/override", response_model=schemas.Annotation, tags=["Annotations", "Pod Lead"])
async def pod_lead_override_annotation(
        override_data: schemas.PodLeadAnnotationOverride,
        pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
        db: Session = Depends(get_db)
):
    try:
        pod_lead_id = pod_lead.email
        override_data_dict = override_data.model_dump()  # Pydantic v2
        override_data_dict["pod_lead_id"] = pod_lead_id
        result = annotations_service.pod_lead_override_annotation(db, pod_lead_id, schemas.PodLeadAnnotationOverride(
            **override_data_dict))
        return result
    except annotations_service.PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.put("/api/admin/annotations/override", response_model=schemas.Annotation, tags=["Annotations", "Admin"])
async def admin_override_annotation(
        override_data: schemas.AnnotationOverride,
        admin: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    try:
        result = annotations_service.override_annotation(db, override_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ================= Consensus APIs (Cleaned Up) =================
@app.get("/api/selected/consensus/{discussion_id}/{task_id}",
         response_model=Optional[schemas.ConsensusAnnotationResponse], tags=["Consensus"])
async def get_specific_consensus_annotation(
        discussion_id: str = Path(..., description="Discussion ID"),
        task_id: int = Path(..., description="Task ID"),
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    """Get consensus annotation for a specific discussion and task."""
    logger.info(f"Getting consensus for discussion_id='{discussion_id}', task_id={task_id}")

    try:
        consensus_annotation = consensus_service.get_consensus_annotation_by_discussion_and_task(db, discussion_id, task_id)

        if not consensus_annotation:
            logger.warning(f"No consensus annotation found for discussion='{discussion_id}', task={task_id}")
            return None

        logger.info(f"Found consensus annotation with id={consensus_annotation.id}")
        return consensus_annotation

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error getting consensus annotation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Get all consensus annotations for a discussion and task
@app.get("/api/consensus/all/{discussion_id}/{task_id}",
         response_model=List[schemas.ConsensusAnnotationResponse], tags=["Consensus"])
async def get_all_consensus_annotations_for_task_endpoint(
        discussion_id: str = Path(..., description="Discussion ID"),
        task_id: int = Path(..., description="Task ID"),
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    """Get all consensus annotations for a discussion and task."""
    return consensus_service.get_all_consensus_annotations_for_task(db, discussion_id, task_id)

# Create or update a consensus annotation
@app.post("/api/consensus", response_model=schemas.ConsensusAnnotationResponse, tags=["Consensus"])
async def create_or_update_consensus_annotation_endpoint(
        consensus_data: schemas.ConsensusAnnotationCreate,
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    """Create or update a consensus annotation."""
    try:
        result = consensus_service.create_or_update_consensus_annotation(db, consensus_data, current_user.email)
        return result
    except ValueError as e:
        if "marked for rework" in str(e):
            raise HTTPException(status_code=400, detail=str(e))
        raise

# Calculate consensus (operates on regular annotations)
@app.get("/api/consensus/{discussion_id}/{task_id}/calculate",
         response_model=Dict[str, Any], tags=["Consensus"])
async def calculate_consensus_endpoint(
        discussion_id: str = Path(..., description="Discussion ID"),
        task_id: int = Path(..., description="Task ID"),
        current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
        db: Session = Depends(get_db)
):
    """Calculate consensus from regular annotations."""
    result = consensus_service.calculate_consensus(db, discussion_id, task_id)
    return result

# Override consensus annotation (admin only)
@app.put("/api/consensus/override", response_model=schemas.ConsensusAnnotationResponse, tags=["Consensus", "Admin"])
async def override_consensus_annotation_endpoint(
        override_data: schemas.ConsensusOverride,
        admin: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
        db: Session = Depends(get_db)
):
    """Override a consensus annotation (admin only)."""
    result = consensus_service.override_consensus_annotation(db, override_data, admin.email)
    return result

# Add this new endpoint
@app.get("/api/auth/users/{user_id}", response_model=schemas.UserResponse)
async def get_user_by_id(
    user_id: int = Path(..., title="The ID of the user to retrieve"), 
    db: Session = Depends(get_db)
):
    """Retrieve a specific user by their ID."""
    db_user = db.query(models.AuthorizedUser).filter(models.AuthorizedUser.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Populate username with email as per frontend expectation / previous findings
    return schemas.UserResponse(
        id=str(db_user.id),
        email=db_user.email,
        username=db_user.email, 
        role=db_user.role
    )

@app.get("/api/auth/users/{user_id}/public", response_model=schemas.UserPublicResponse)
async def get_public_user_info(
    user_id: int = Path(..., title="The ID of the user to retrieve"), 
    db: Session = Depends(get_db)
):
    # Implementation of the new endpoint
    # This is a placeholder and should be replaced with the actual implementation
    return {"message": "This endpoint is not implemented yet"}
# Add these endpoints to your main.py file


# ================= User Agreement Analysis APIs =================

@app.get("/api/users/{user_id}/annotations/agreement-analysis", tags=["User Analysis"])
async def get_user_agreement_analysis(
    user_id: str = Path(..., description="User ID to analyze"),
    task_id: Optional[int] = Query(None, description="Filter by specific task (1, 2, or 3)"),
    include_details: bool = Query(False, description="Include detailed breakdown per discussion"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """
    Analyze a user's annotation agreement across all discussions.
    Shows which annotations match consensus vs those that don't.
    
    **Parameters:**
    - **user_id**: ID of the user to analyze
    - **task_id**: Optional filter for specific task (1=Question Quality, 2=Answer Quality, 3=Rewrite)
    - **include_details**: Whether to include detailed breakdown per annotation
    
    **Returns:**
    - Overall agreement statistics
    - Task-by-task breakdown
    - Field-level agreement rates
    - Personalized recommendations
    - Optional detailed annotation comparisons
    """
    try:
        # Authorization check - users can only see their own data unless admin/pod_lead
        if current_user.email != user_id and current_user.role not in ["admin", "pod_lead"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own agreement analysis unless you are an admin or pod lead"
            )
        
        logger.info(f"Getting agreement analysis for user {user_id}, task_filter: {task_id}")
        
        analysis = await user_agreement_service.analyze_user_agreement(
            db, user_id, task_id, include_details
        )
        
        return analysis
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error analyzing user agreement: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Analysis failed: {str(e)}"
        )


@app.get("/api/users/{user_id}/annotations/disagreement-report", tags=["User Analysis"])
async def get_user_disagreement_report(
    user_id: str = Path(..., description="User ID to analyze"),
    task_id: Optional[int] = Query(None, description="Filter by specific task"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """
    Get detailed report of where user's annotations disagree with consensus.
    Useful for training and feedback purposes.
    
    **Parameters:**
    - **user_id**: ID of the user to analyze
    - **task_id**: Optional filter for specific task
    
    **Returns:**
    - Detailed disagreement breakdown
    - Common error patterns  
    - Training recommendations
    - Specific examples of disagreements
    """
    try:
        # Authorization check
        if current_user.email != user_id and current_user.role not in ["admin", "pod_lead"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own disagreement report unless you are an admin or pod lead"
            )
        
        logger.info(f"Generating disagreement report for user {user_id}, task_filter: {task_id}")
        
        report = await user_agreement_service.generate_disagreement_report(
            db, user_id, task_id
        )
        
        return report
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error generating disagreement report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Report generation failed: {str(e)}"
        )


@app.get("/api/users/{user_id}/annotations/summary", tags=["User Analysis"])
async def get_user_agreement_summary(
    user_id: str = Path(..., description="User ID to get summary for"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """
    Get a quick summary of user's agreement statistics.
    Lighter weight version for dashboard/overview purposes.
    
    **Parameters:**
    - **user_id**: ID of the user to analyze
    
    **Returns:**
    - Basic agreement rate
    - Total annotations count
    - Overall performance status (excellent/good/needs_improvement/needs_training)
    """
    try:
        # Authorization check
        if current_user.email != user_id and current_user.role not in ["admin", "pod_lead"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own summary unless you are an admin or pod lead"
            )
        
        logger.info(f"Getting agreement summary for user {user_id}")
        
        summary = user_agreement_service.get_user_agreement_summary(db, user_id)
        
        return summary
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"Error getting user agreement summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Summary generation failed: {str(e)}"
        )


@app.get("/api/admin/users/agreement-overview", tags=["Admin", "User Analysis"])
async def get_all_users_agreement_overview(
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """
    Get agreement overview for all users (Admin only).
    Useful for identifying users who need additional training.
    
    **Returns:**
    - Agreement summary for all users
    - Users ranked by performance
    - Users flagged for additional training
    """
    try:
        logger.info("Getting agreement overview for all users (admin request)")
        
        # Get all users who have made annotations
        users_with_annotations = db.query(models.Annotation.user_id).distinct().all()
        user_ids = [user[0] for user in users_with_annotations]
        
        if not user_ids:
            return {
                "total_users": 0,
                "users": [],
                "summary": {
                    "excellent_users": 0,
                    "good_users": 0,
                    "users_needing_improvement": 0,
                    "users_needing_training": 0
                }
            }
        
        # Get summary for each user
        user_summaries = []
        status_counts = {"excellent": 0, "good": 0, "needs_improvement": 0, "needs_training": 0, "no_data": 0, "error": 0}
        
        for user_id in user_ids:
            try:
                summary = user_agreement_service.get_user_agreement_summary(db, user_id)
                user_summaries.append(summary)
                
                status = summary.get("status", "error")
                if status in status_counts:
                    status_counts[status] += 1
                    
            except Exception as e:
                logger.error(f"Error getting summary for user {user_id}: {str(e)}")
                user_summaries.append({
                    "user_id": user_id,
                    "status": "error",
                    "error": str(e)
                })
                status_counts["error"] += 1
        
        # Sort users by agreement rate (descending)
        user_summaries.sort(key=lambda x: x.get("agreement_rate", 0), reverse=True)
        
        # Identify users needing attention
        users_needing_training = [
            user for user in user_summaries 
            if user.get("status") in ["needs_training", "needs_improvement"]
        ]
        
        return {
            "total_users": len(user_summaries),
            "users": user_summaries,
            "users_needing_training": users_needing_training,
            "summary": {
                "excellent_users": status_counts["excellent"],
                "good_users": status_counts["good"], 
                "users_needing_improvement": status_counts["needs_improvement"],
                "users_needing_training": status_counts["needs_training"],
                "users_with_no_data": status_counts["no_data"],
                "users_with_errors": status_counts["error"]
            },
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting all users agreement overview: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Overview generation failed: {str(e)}"
        )


@app.get("/api/tasks/{discussion_id}/{task_id}/completion-status", tags=["Tasks"])
async def get_task_completion_status(
    discussion_id: str = Path(..., description="Discussion ID"),
    task_id: int = Path(..., description="Task ID (1, 2, or 3)"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """
    Check if a task can be marked as completed based on consensus criteria.
    Shows which completion criteria are met/missing.
    
    **Parameters:**
    - **discussion_id**: ID of the discussion
    - **task_id**: Task ID (1=Question Quality, 2=Answer Quality, 3=Rewrite)
    
    **Returns:**
    - Whether task can be completed
    - Which criteria are met/missing
    - Detailed completion status
    """
    try:
        logger.info(f"Checking completion status for discussion {discussion_id}, task {task_id}")
        
        # Get consensus annotation
        consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
            db, discussion_id, task_id
        )
        
        if not consensus:
            return {
                "discussion_id": discussion_id,
                "task_id": task_id,
                "can_complete": False,
                "message": "No consensus annotation exists yet",
                "criteria": {},
                "missing_criteria": []
            }
        
        # Import here to avoid circular imports
        from services.consensus_service import _get_task_completion_status
        
        # Get detailed completion status
        completion_status = _get_task_completion_status(consensus.data, task_id)
        completion_status["discussion_id"] = discussion_id
        
        return completion_status
        
    except Exception as e:
        logger.error(f"Error checking task completion status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Status check failed: {str(e)}"
        )
    
# Add this endpoint to your main.py file


# ================= General Workflow Report API =================

@app.get("/api/admin/workflow/general-report", tags=["Admin", "Workflow"])
async def get_general_workflow_report(
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """
    Generate a comprehensive workflow report showing:
    
    **Ready for Consensus Creation:**
    - Tasks with 100% (or near-perfect) agreement between annotators
    - Tasks that have enough annotators but no consensus yet
    - Detailed agreement analysis for each ready task
    
    **Ready for Task Unlock:**
    - Tasks with consensus that meets completion criteria
    - Next tasks that should be unlocked in the workflow
    - Automatic workflow progression opportunities
    
    **Overall Workflow Status:**
    - Summary statistics across all discussions
    - Task-by-task breakdown of workflow status
    - Actionable recommendations for workflow management
    
    **Use Cases:**
    - Daily workflow management
    - Identifying bottlenecks in the annotation process
    - Automating consensus creation and task unlocking
    - Monitoring overall project progress
    
    **Returns:**
    - `ready_for_consensus`: List of tasks ready for consensus creation
    - `ready_for_task_unlock`: List of completed tasks that should unlock next tasks
    - `workflow_summary`: High-level statistics and progress metrics
    - `task_breakdown`: Task-specific workflow statistics
    - `recommendations`: Actionable items prioritized by importance
    """
    try:
        logger.info("Generating general workflow report (admin request)")
        
        report = general_report_service.generate_general_report(db)
        
        return report
        
    except Exception as e:
        logger.error(f"Error generating general workflow report: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(e)}"
        )


@app.get("/api/admin/workflow/consensus-candidates", tags=["Admin", "Workflow"])
async def get_consensus_candidates(
    min_agreement_rate: float = Query(80.0, description="Minimum agreement rate to consider ready (0-100)"),
    task_id: Optional[int] = Query(None, description="Filter by specific task (1, 2, or 3)"),
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """
    Get a focused list of tasks that are candidates for consensus creation.
    
    **Parameters:**
    - **min_agreement_rate**: Minimum agreement rate to consider (default: 80%)
    - **task_id**: Optional filter for specific task
    
    **Returns:**
    - Filtered list of discussions/tasks ready for consensus
    - Agreement details for each candidate
    - Recommended consensus values based on majority agreement
    """
    try:
        logger.info(f"Getting consensus candidates with min_agreement_rate: {min_agreement_rate}")
        
        # Generate full report
        full_report = general_report_service.generate_general_report(db)
        
        # Filter consensus candidates based on criteria
        candidates = []
        for item in full_report["ready_for_consensus"]:
            # Apply agreement rate filter
            if item["agreement_rate"] >= min_agreement_rate:
                # Apply task filter if specified
                if task_id is None or item["task_id"] == task_id:
                    candidates.append(item)
        
        return {
            "total_candidates": len(candidates),
            "min_agreement_rate": min_agreement_rate,
            "task_filter": task_id,
            "candidates": candidates,
            "report_timestamp": full_report["report_timestamp"]
        }
        
    except Exception as e:
        logger.error(f"Error getting consensus candidates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get consensus candidates: {str(e)}"
        )


@app.get("/api/admin/workflow/unlock-candidates", tags=["Admin", "Workflow"])
async def get_unlock_candidates(
    task_id: Optional[int] = Query(None, description="Filter by completed task (1, 2, or 3)"),
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """
    Get a focused list of tasks that should have their next task unlocked.
    
    **Parameters:**
    - **task_id**: Optional filter for specific completed task
    
    **Returns:**
    - List of discussions where next task should be unlocked
    - Consensus criteria validation results
    - Current task status information
    """
    try:
        logger.info(f"Getting unlock candidates for task: {task_id}")
        
        # Generate full report
        full_report = general_report_service.generate_general_report(db)
        
        # Filter unlock candidates
        candidates = []
        for item in full_report["ready_for_task_unlock"]:
            # Apply task filter if specified
            if task_id is None or item["completed_task_id"] == task_id:
                candidates.append(item)
        
        return {
            "total_candidates": len(candidates),
            "completed_task_filter": task_id,
            "candidates": candidates,
            "report_timestamp": full_report["report_timestamp"]
        }
        
    except Exception as e:
        logger.error(f"Error getting unlock candidates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get unlock candidates: {str(e)}"
        )


@app.post("/api/admin/workflow/auto-create-consensus", tags=["Admin", "Workflow"])
async def auto_create_consensus_for_candidates(
    min_agreement_rate: float = Query(90.0, description="Minimum agreement rate for auto-creation"),
    task_id: Optional[int] = Query(None, description="Filter by specific task"),
    dry_run: bool = Query(True, description="Preview changes without executing"),
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """
    Automatically create consensus annotations for tasks with perfect agreement.
    
    **Parameters:**
    - **min_agreement_rate**: Minimum agreement rate for auto-creation (default: 90%)
    - **task_id**: Optional filter for specific task
    - **dry_run**: If true, only preview what would be created (default: true)
    
    **Returns:**
    - List of consensus annotations that would be/were created
    - Success/failure status for each creation
    - Summary of actions taken
    
    **Safety Features:**
    - High agreement threshold required (90% default)
    - Dry run mode for previewing changes
    - Admin-only access
    - Detailed logging of all actions
    """
    try:
        logger.info(f"Auto-creating consensus (dry_run: {dry_run}, min_agreement: {min_agreement_rate})")
        
        # Get candidates
        candidates_response = await get_consensus_candidates(
            min_agreement_rate=min_agreement_rate,
            task_id=task_id,
            admin_user=admin_user,
            db=db
        )
        
        candidates = candidates_response["candidates"]
        
        if not candidates:
            return {
                "message": "No candidates found for auto-consensus creation",
                "total_candidates": 0,
                "created": [],
                "dry_run": dry_run
            }
        
        created_consensus = []
        errors = []
        
        for candidate in candidates:
            try:
                discussion_id = candidate["discussion_id"]
                task_id_val = candidate["task_id"]
                
                if dry_run:
                    # Preview mode - don't actually create
                    created_consensus.append({
                        "discussion_id": discussion_id,
                        "task_id": task_id_val,
                        "status": "would_create",
                        "agreement_rate": candidate["agreement_rate"],
                        "message": f"Would create consensus with {candidate['agreement_rate']}% agreement"
                    })
                else:
                    # Actually create consensus based on majority values
                    consensus_data = _build_consensus_from_agreement(
                        candidate["agreement_details"]["field_agreement"]
                    )
                    
                    # Create consensus annotation
                    consensus_input = schemas.ConsensusAnnotationCreate(
                        discussion_id=discussion_id,
                        task_id=task_id_val,
                        annotator_id="auto_consensus",
                        data=consensus_data
                    )
                    
                    result = consensus_service.create_or_update_consensus_annotation(
                        db, consensus_input, admin_user.email
                    )
                    
                    created_consensus.append({
                        "discussion_id": discussion_id,
                        "task_id": task_id_val,
                        "consensus_id": result.id,
                        "status": "created",
                        "agreement_rate": candidate["agreement_rate"],
                        "message": "Successfully created consensus"
                    })
                    
                    logger.info(f"Auto-created consensus for {discussion_id}/task{task_id_val}")
                
            except Exception as e:
                error_msg = f"Failed to create consensus for {candidate['discussion_id']}/task{candidate['task_id']}: {str(e)}"
                logger.error(error_msg)
                errors.append(error_msg)
        
        return {
            "message": f"{'Previewed' if dry_run else 'Created'} consensus for {len(created_consensus)} tasks",
            "total_candidates": len(candidates),
            "successful_creations": len(created_consensus),
            "errors": errors,
            "created_consensus": created_consensus,
            "dry_run": dry_run,
            "min_agreement_rate": min_agreement_rate,
            "admin_user": admin_user.email,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in auto-create consensus: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Auto-consensus creation failed: {str(e)}"
        )


def _build_consensus_from_agreement(field_agreement: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build consensus data based on field agreement analysis.
    Uses the consensus value from each field's agreement analysis.
    """
    consensus_data = {}
    
    for field, stats in field_agreement.items():
        consensus_value = stats.get("consensus_value")
        if consensus_value is not None:
            consensus_data[field] = consensus_value
    
    # Add metadata
    consensus_data["_auto_generated"] = True
    consensus_data["_generation_timestamp"] = datetime.utcnow().isoformat()
    
    return consensus_data

@app.get("/api/pod-lead/summary", tags=["Pod Lead"])
async def get_pod_lead_summary_endpoint(
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """
    Get pod lead dashboard summary including team performance and workflow status.
    
    **Returns:**
    - Team member list with performance metrics
    - Overall team performance summary  
    - Workflow status (discussions needing review)
    - Users needing attention
    """
    try:
        logger.info(f"Pod lead {pod_lead.email} requesting summary")
        summary = pod_lead_service.get_pod_lead_summary(db, pod_lead.email)
        return summary
    except Exception as e:
        logger.error(f"Error getting pod lead summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pod lead summary: {str(e)}"
        )

@app.get("/api/pod-lead/team/performance", tags=["Pod Lead"])
async def get_team_performance_endpoint(
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """
    Get detailed team performance metrics for pod lead.
    
    **Returns:**
    - Individual team member performance
    - Performance categorization (excellent, good, needs improvement, needs training)
    - Top performers and attention needed lists
    """
    try:
        logger.info(f"Pod lead {pod_lead.email} requesting team performance")
        performance = pod_lead_service.get_team_performance(db)
        return performance
    except Exception as e:
        logger.error(f"Error getting team performance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get team performance: {str(e)}"
        )

@app.get("/api/pod-lead/discussions/review", tags=["Pod Lead"])
async def get_discussions_for_review_endpoint(
    priority: Optional[str] = Query(None, description="Filter by priority (high, medium, low)"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """
    Get discussions that need pod lead review.
    
    **Parameters:**
    - **priority**: Filter by priority level (high, medium, low)
    - **page**: Page number for pagination
    - **per_page**: Number of items per page
    
    **Returns:**
    - Discussions with high disagreement rates
    - Discussions missing consensus
    - Issues requiring pod lead attention
    """
    try:
        logger.info(f"Pod lead {pod_lead.email} requesting discussions for review")
        discussions = pod_lead_service.get_discussions_for_review(
            db, priority=priority, page=page, per_page=per_page
        )
        return discussions
    except Exception as e:
        logger.error(f"Error getting discussions for review: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get discussions for review: {str(e)}"
        )
    
    
@app.get("/api/pod-lead/breakdown", tags=["Pod Lead"])
async def get_pod_lead_breakdown_endpoint(
    pod_lead: schemas.AuthorizedUser = Depends(jwt_auth_service.get_pod_lead),
    db: Session = Depends(get_db)
):
    """Get pod lead activity breakdown using existing consensus data."""
    try:
        # Get consensus annotations created by this pod lead
        consensus_created = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.user_id == pod_lead.email
        ).count()
        
        # Get team members from existing service
        team_summary = pod_lead_service.get_pod_lead_summary(db, pod_lead.email)
        team_members_count = team_summary['team_performance']['team_size']
        
        # Get recent activity
        recent_consensus = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.user_id == pod_lead.email
        ).order_by(models.ConsensusAnnotation.timestamp.desc()).first()
        
        recent_activity = recent_consensus.timestamp.isoformat() if recent_consensus else datetime.utcnow().isoformat()
        
        return {
            "pod_lead_email": pod_lead.email,
            "consensus_created": consensus_created,
            "annotations_overridden": 0,  # Can be enhanced later with override tracking
            "team_members_managed": team_members_count,
            "recent_activity": recent_activity
        }
    except Exception as e:
        logger.error(f"Error getting pod lead breakdown: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pod lead breakdown: {str(e)}"
        )

@app.get("/api/pod-lead/all-breakdown", tags=["Admin"])  
async def get_all_pod_leads_breakdown(
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """Get breakdown for all pod leads using existing services."""
    try:
        pod_leads = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.role == "pod_lead"
        ).all()
        
        breakdown_data = []
        
        for pod_lead in pod_leads:
            # Get consensus created by this pod lead
            consensus_created = db.query(models.ConsensusAnnotation).filter(
                models.ConsensusAnnotation.user_id == pod_lead.email
            ).count()
            
            # Get team info from existing service
            try:
                team_summary = pod_lead_service.get_pod_lead_summary(db, pod_lead.email)
                team_members_count = team_summary['team_performance']['team_size']
            except:
                team_members_count = 0
            
            # Get recent activity
            recent_consensus = db.query(models.ConsensusAnnotation).filter(
                models.ConsensusAnnotation.user_id == pod_lead.email
            ).order_by(models.ConsensusAnnotation.timestamp.desc()).first()
            
            recent_activity = recent_consensus.timestamp.isoformat() if recent_consensus else datetime.utcnow().isoformat()
            
            breakdown_data.append({
                "pod_lead_email": pod_lead.email,
                "consensus_created": consensus_created,
                "annotations_overridden": 0,  # Placeholder
                "team_members_managed": team_members_count,
                "recent_activity": recent_activity
            })
        
        return breakdown_data
        
    except Exception as e:
        logger.error(f"Error getting all pod leads breakdown: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pod leads breakdown: {str(e)}"
        )
@app.post("/api/discussions/{discussion_id}/tasks/{task_id}/flag")
async def flag_discussion_task(
    discussion_id: str = Path(..., description="Discussion ID"),
    task_id: int = Path(..., description="Task ID (1, 2, or 3)"),
    flag_data: dict = Body(..., description="Flag reason"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """Flag a task by changing its status to 'rework'."""
    try:
        reason = flag_data.get("reason", "").strip()
        category = flag_data.get("category", "general")
        flagged_from_task = flag_data.get("flagged_from_task", task_id)
        
        if not reason or len(reason) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide a detailed reason (minimum 10 characters)"
            )
        
        if task_id not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="task_id must be 1, 2, or 3"
            )
        
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(
            models.Discussion.id == discussion_id
        ).first()
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )
        # Determine status based on category
        new_status = 'rework' if category == "quality_issue" else 'flagged'
        
        result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_id
                )
            )).values(
            status=json.dumps({
                "status": new_status,
                "reason": reason,
                "category": category,
                "flagged_by": current_user.email,
                "flagged_at": datetime.utcnow().isoformat()
            }) if new_status in ['rework', 'flagged'] else new_status
        )
    
        # If task association doesn't exist, create it
        if result.rowcount == 0:
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=task_id,
                    status=new_status,
                    annotators=0
                )
            )
        
        db.commit()
            
        # Enhanced logging
        log_message = f"Task {task_id} flagged for rework by {current_user.email}"
        if flagged_from_task != task_id:
            log_message += f" (discovered while working on Task {flagged_from_task})"
        log_message += f": [{category}] {reason}"
        logger.info(log_message)
        
        return {
            "success": True,
            "message": f"Task {task_id} flagged for rework. Status updated.",
            "discussion_id": discussion_id,
            "task_id": task_id,
            "new_status": new_status,
            "flagged_by": current_user.email,
            "reason": reason,
            "category": category,
            "upstream_flag": flagged_from_task != task_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error flagging task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to flag task"
        )

@app.put("/api/admin/discussions/{discussion_id}/tasks/{task_id}/status")
async def update_task_status_simple(
    discussion_id: str = Path(..., description="Discussion ID"),
    task_id: int = Path(..., description="Task ID"),
    status_data: dict = Body(..., description="New status"),
    admin_user: schemas.AuthorizedUser = Depends(jwt_auth_service.get_admin),
    db: Session = Depends(get_db)
):
    """Update task status in existing system."""
    try:
        new_status = status_data.get("status")
        
        valid_statuses = ['locked', 'unlocked', 'completed', 'rework', 'blocked', 'ready_for_next', 'flagged','in_progress', 'ready_for_consensus', 'consensus_created']
        
        if not new_status or new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )
        
        if task_id not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="task_id must be 1, 2, or 3"
            )
        
        # Get current status
        current_status_result = db.execute(
            models.discussion_task_association.select().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_id
                )
            )
        ).first()
        
        old_status = current_status_result.status if current_status_result else "none"
        
        # Update status
        result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_id
                )
            ).values(status=new_status)
        )
        
        # Create if doesn't exist
        if result.rowcount == 0:
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=task_id,
                    status=new_status,
                    annotators=0
                )
            )
            old_status = "none"
        
        # Auto-unlock next task if ready_for_next
        auto_unlocked = False
        if new_status == 'ready_for_next' and task_id < 3:
            next_task_id = task_id + 1
            
            # Unlock next task if locked
            db.execute(
                models.discussion_task_association.update().where(
                    and_(
                        models.discussion_task_association.c.discussion_id == discussion_id,
                        models.discussion_task_association.c.task_number == next_task_id,
                        models.discussion_task_association.c.status == 'locked'
                    )
                ).values(status='unlocked')
            )
            
            # Create next task if doesn't exist
            next_task_exists = db.execute(
                models.discussion_task_association.select().where(
                    and_(
                        models.discussion_task_association.c.discussion_id == discussion_id,
                        models.discussion_task_association.c.task_number == next_task_id
                    )
                )
            ).first()
            
            if not next_task_exists:
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=discussion_id,
                        task_number=next_task_id,
                        status='unlocked',
                        annotators=0
                    )
                )
            
            auto_unlocked = True
        
        db.commit()
        
        logger.info(f"Task {task_id} status updated from '{old_status}' to '{new_status}' by {admin_user.email}")
        
        return {
            "success": True,
            "message": f"Task {task_id} status updated to {new_status}",
            "discussion_id": discussion_id,
            "task_id": task_id,
            "old_status": old_status,
            "new_status": new_status,
            "updated_by": admin_user.email,
            "auto_unlocked_next": auto_unlocked
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update task status"
        )

@app.get("/api/github/latest-commit")
async def get_latest_commit_before_discussion(
    repo_url: str = Query(..., description="GitHub repository URL"),
    discussion_date: str = Query(..., description="Discussion creation date in ISO format"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication)
):
    """Find the latest commit just before the discussion was created."""
    try:
        import re
        import requests
        from datetime import datetime
        
        # Parse GitHub URL
        github_pattern = r'github\.com/([^/]+)/([^/]+)'
        match = re.search(github_pattern, repo_url)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid GitHub repository URL"
            )
        
        owner, repo = match.groups()
        repo = repo.replace('.git', '')
        
        # Parse discussion date
        try:
            discussion_dt = datetime.fromisoformat(discussion_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format"
            )
        
        # Get commits until discussion date
        commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
        params = {
            'until': discussion_dt.isoformat(),
            'per_page': 1
        }
        
        response = requests.get(commits_url, params=params, timeout=10)
        
        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found"
            )
        elif response.status_code == 403:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GitHub API rate limit exceeded"
            )
        elif not response.ok:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub API error: {response.status_code}"
            )
        
        commits_data = response.json()
        
        if not commits_data:
            return {
                'success': True,
                'repository': f"{owner}/{repo}",
                'discussion_date': discussion_date,
                'latest_commit': None,
                'message': 'No commits found before discussion date'
            }
        
        # Get the latest commit
        latest_commit = commits_data[0]
        commit_date = datetime.fromisoformat(latest_commit['commit']['author']['date'].replace('Z', '+00:00'))
        hours_diff = (discussion_dt - commit_date).total_seconds() / 3600
        
        commit_info = {
            'sha': latest_commit['sha'],
            'short_sha': latest_commit['sha'][:7],
            'message': latest_commit['commit']['message'].split('\n')[0],
            'author': {
                'name': latest_commit['commit']['author']['name'],
                'date': latest_commit['commit']['author']['date']
            },
            'url': latest_commit['html_url'],
            'hours_before_discussion': round(hours_diff, 1)
        }
        
        return {
            'success': True,
            'repository': f"{owner}/{repo}",
            'discussion_date': discussion_date,
            'latest_commit': commit_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding latest commit: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch latest commit"
        )
@app.get("/api/github/latest-tag")
async def get_latest_tag_before_discussion(
    repo_url: str = Query(..., description="GitHub repository URL"),
    discussion_date: str = Query(..., description="Discussion creation date in ISO format")
):
    """
    Get the latest tag from a GitHub repository before a specific date.
    """
    try:
        import re
        import requests
        from datetime import datetime
        
        # Parse GitHub URL
        github_pattern = r'github\.com/([^/]+)/([^/]+)'
        match = re.search(github_pattern, repo_url)
        if not match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid GitHub repository URL"
            )
        
        owner, repo = match.groups()
        repo = repo.replace('.git', '')
        
        # Parse discussion date
        try:
            target_date = datetime.fromisoformat(discussion_date.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use ISO format"
            )
        
        # Get tags from GitHub API
        tags_url = f"https://api.github.com/repos/{owner}/{repo}/tags"
        
        response = requests.get(tags_url, timeout=10)
        
        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found"
            )
        elif response.status_code == 403:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="GitHub API rate limit exceeded"
            )
        elif not response.ok:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GitHub API error: {response.status_code}"
            )
        
        tags_data = response.json()
        
        if not tags_data:
            return {
                'success': True,
                'repository': f"{owner}/{repo}",
                'discussion_date': discussion_date,
                'latest_tag': None,
                'message': 'No tags found in repository'
            }
        
        # Find the latest tag before the discussion date
        latest_tag = None
        
        for tag in tags_data:
            # Get commit info for the tag
            commit_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{tag['commit']['sha']}"
            commit_response = requests.get(commit_url, timeout=10)
            
            if commit_response.status_code == 200:
                commit_data = commit_response.json()
                commit_date_str = commit_data['commit']['committer']['date']
                
                try:
                    commit_date = datetime.fromisoformat(commit_date_str.replace('Z', '+00:00'))
                    
                    # Check if this tag is before the discussion date
                    if commit_date < target_date:
                        if latest_tag is None or commit_date > latest_tag['date']:
                            latest_tag = {
                                'name': tag['name'],
                                'sha': tag['commit']['sha'],
                                'short_sha': tag['commit']['sha'][:7],
                                'url': f"https://github.com/{owner}/{repo}/releases/tag/{tag['name']}",
                                'date': commit_date,
                                'message': commit_data['commit']['message'].split('\n')[0]
                            }
                except ValueError:
                    continue
        
        if latest_tag is None:
            return {
                'success': True,
                'repository': f"{owner}/{repo}",
                'discussion_date': discussion_date,
                'latest_tag': None,
                'message': f'No tags found before {target_date.strftime("%Y-%m-%d %H:%M:%S")}'
            }
        
        # Calculate hours before discussion
        time_diff = target_date - latest_tag['date']
        hours_before = time_diff.total_seconds() / 3600
        
        # Format the response
        tag_info = {
            'name': latest_tag['name'],
            'sha': latest_tag['sha'],
            'short_sha': latest_tag['short_sha'],
            'url': latest_tag['url'],
            'date': latest_tag['date'].isoformat(),
            'hours_before_discussion': round(hours_before, 1),
            'message': latest_tag['message']
        }
        
        return {
            'success': True,
            'repository': f"{owner}/{repo}",
            'discussion_date': discussion_date,
            'latest_tag': tag_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding latest tag: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch latest tag"
        )


@app.post("/api/discussions/{discussion_id}/tasks/{task_id}/flag-enhanced", tags=["Tasks"])
async def flag_task_enhanced(
    discussion_id: str = Path(..., description="Discussion ID"),
    task_id: int = Path(..., description="Task ID"),
    flag_data: dict = Body(..., description="Enhanced flag data"),
    current_user: schemas.AuthorizedUser = Depends(jwt_auth_service.require_authentication),
    db: Session = Depends(get_db)
):
    """
    Enhanced task flagging with workflow routing support
    """
    try:
        reason = flag_data.get("reason", "").strip()
        category = flag_data.get("category", "general")
        flagged_from_task = flag_data.get("flagged_from_task", task_id)
        workflow_scenario = flag_data.get("workflow_scenario")
        flagged_by_role = flag_data.get("flagged_by_role", "annotator")
        
        # Validation
        if not reason or len(reason) < 15:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide a detailed reason (minimum 15 characters)"
            )
        
        if task_id not in [1, 2, 3]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="task_id must be 1, 2, or 3"
            )
        
        valid_categories = ['workflow_misrouting', 'quality_issue', 'consensus_mismatch', 'data_error', 'general']
        if category not in valid_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
            )
        
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(
            models.Discussion.id == discussion_id
        ).first()
        if not discussion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Discussion not found"
            )
        
        # Handle workflow misrouting
        flagged_task_id = task_id
        if category == 'workflow_misrouting' and workflow_scenario:
            flagged_task_id = _handle_workflow_misrouting(
                db, discussion_id, workflow_scenario, reason, current_user.email
            )
        
        # Determine new status based on category and user role
        if category == 'quality_issue' and flagged_by_role in ['pod_lead', 'admin']:
            new_status = 'rework'
        elif category in ['workflow_misrouting', 'data_error']:
            new_status = 'rework'
        else:
            new_status = 'flagged'
        

        # Create the flag details object
        flag_details = {
            "status": new_status,
            "reason": reason,
            "category": category,
            "flagged_by": current_user.email,
            "flagged_by_role": flagged_by_role,
            "flagged_from_task": flagged_from_task,
            "workflow_scenario": workflow_scenario,
            "flagged_at": datetime.utcnow().isoformat()
        }
        
        # Store as JSON for flagged tasks, simple string for others
        status_to_store = json.dumps(flag_details) if new_status in ['rework', 'flagged'] else new_status
        
 # Update task status directly
        update_result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == flagged_task_id
                )
            ).values(status=status_to_store)
        )
        
        # Create task association if it doesn't exist
        if update_result.rowcount == 0:
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=flagged_task_id,
                    status=status_to_store,
                    annotators=0
                )
            )
        
        db.commit()
        
        # Get updated discussion for response
        updated_discussion = discussions_service.get_discussion_by_id(db, discussion_id)
        
        task_result = schemas.TaskManagementResult(
            success=True,
            message=f"Task {flagged_task_id} flagged successfully",
            discussion=updated_discussion
        )
        
        # Create flag record for logging
        flag_record = {
            "discussion_id": discussion_id,
            "task_id": flagged_task_id,
            "flagged_from_task": flagged_from_task,
            "category": category,
            "reason": reason,
            "workflow_scenario": workflow_scenario,
            "flagged_by": current_user.email,
            "flagged_by_role": flagged_by_role,
            "new_status": new_status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Enhanced logging
        log_message = f"Task {flagged_task_id} flagged by {current_user.email} ({flagged_by_role})"
        if flagged_from_task != flagged_task_id:
            log_message += f" (discovered on Task {flagged_from_task})"
        log_message += f": [{category}] {reason}"
        logger.info(log_message)
        
        return {
            "success": True,
            "message": f"Task {flagged_task_id} flagged successfully",
            "flag_record": flag_record,
            "task_update_result": task_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error flagging task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to flag task"
        )


def _handle_workflow_misrouting(
    db: Session, 
    discussion_id: str, 
    workflow_scenario: str, 
    reason: str,
    flagged_by: str
) -> int:
    """
    Handle workflow misrouting scenarios
    """
    if workflow_scenario == 'stop_at_task1':
        # Mark task 1 for rework, lock tasks 2 and 3
        discussions_service.update_task_status_enhanced(db, discussion_id, 3, 'locked')  
        discussions_service.update_task_status_enhanced(db, discussion_id, 2, 'locked')  
        discussions_service.update_task_status_enhanced(db, discussion_id, 1, 'rework')
        return 1
        
    elif workflow_scenario == 'stop_at_task2':
        # Mark task 2 for rework, lock task 3
        discussions_service.update_task_status_enhanced(db, discussion_id, 3, 'locked')  
        discussions_service.update_task_status_enhanced(db, discussion_id, 2, 'rework')
        return 2
        
    elif workflow_scenario == 'skip_to_task3':
        # Mark tasks 1-2 as completed, unlock task 3
        discussions_service.update_task_status_enhanced(db, discussion_id, 1, 'completed')
        discussions_service.update_task_status_enhanced(db, discussion_id, 2, 'completed')  
        discussions_service.update_task_status_enhanced(db, discussion_id, 3, 'unlocked')
        return 3
    
    return 1  # Default fallback