import logging
from datetime import datetime, timezone, timedelta
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
    batch_service, jwt_auth_service

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


# Discussions endpoints
@app.get("/api/discussions", response_model=schemas.PaginatedDiscussionResponse)
def get_all_discussions(
        status: Optional[str] = None,
        page: int = Query(1, ge=1, description="Page number, starting from 1"),
        per_page: int = Query(10, ge=1, le=100, description="Items per page (1-100)"),
        db: Session = Depends(get_db)
):
    # Calculate offset
    offset = (page - 1) * per_page
    
    # Get total count and paginated results
    total_count = discussions_service.get_discussions_count(db, status)
    discussions = discussions_service.get_discussions(
        db, 
        status=status, 
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


@app.get("/api/discussions/{discussion_id}", response_model=schemas.Discussion)
def get_discussion(discussion_id: str, db: Session = Depends(get_db)):
    return discussions_service.get_discussion_by_id(db, discussion_id)

@app.get("/api/discussions", response_model=List[schemas.Discussion])
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
                            flattened.append(f"{item['claim']} (weight: {item.get('weight', 1)})")
                        else:
                            flattened.append(str(item))
                processed_data["short_answer_list"] = flattened
            
            # If it's single form with claim/weight objects
            elif isinstance(short_answers, list) and len(short_answers) > 0 and isinstance(short_answers[0], dict):
                flattened = []
                for item in short_answers:
                    if isinstance(item, dict) and 'claim' in item:
                        flattened.append(f"{item['claim']} (weight: {item.get('weight', 1)})")
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
                    # Collect short answers
                    if "short_answer_list" in form and isinstance(form["short_answer_list"], list):
                        form_short_answers = []
                        for item in form["short_answer_list"]:
                            if isinstance(item, dict) and 'claim' in item:
                                form_short_answers.append({"claim": item['claim'], "weight": str(item.get('weight', 1))})
                            else:
                                form_short_answers.append({"claim": str(item), "weight": "1"})
                        all_short_answers.append(form_short_answers)
                    
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
                
                # Set merged data
                processed_data["short_answer_list"] = all_short_answers  # Array of arrays
                processed_data["long_answer"] = all_long_answers  # Array of strings
                processed_data["rewritten_question"] = list(set(all_rewritten_questions)) if all_rewritten_questions else []  # Unique questions
                processed_data["supporting_docs"] = all_supporting_docs  # Combined docs
                processed_data["question_type"] = question_types[0] if question_types else "Reasoning"  # Use first type
                
                # Add metadata
                processed_data["form_type"] = "A"
                processed_data["total_forms"] = len(data["forms"])
                
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
                    
                    # Handle short_answer_list from forms
                    if "short_answer_list" in form:
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
                    
                    # Add form metadata
                    processed_data["form_index"] = form_index
                    processed_data["form_id"] = form.get("formId", f"form-{form_index}")
                    processed_data["form_name"] = form.get("formName", f"Form {form_index + 1}")
                    processed_data["form_type"] = form_types[form_index]
                    
                    results.append(processed_data)
                
                return results
        
        # Handle single form or legacy format
        processed_data = data.copy()
        
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
        
        # Handle short_answer_list format conversion
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
        
        return [processed_data]  # Return array with single object

    # GET ALL DISCUSSIONS
    discussions = discussions_service.get_discussions(db, status=None, limit=100000, offset=0)
    
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
                
                # Task 1 annotations (same for all forms)
                "annotations_task_1": [
                    {
                        "annotator": int(annotation.user_id),
                        "relevance": annotation.data.get("relevance", False),
                        "learning_value": annotation.data.get("learning", False),
                        "clarity": annotation.data.get("clarity", False),
                        **({"image_grounded": annotation.data.get("grounded", False)} if annotation.data.get("grounded", "") != "N/A" else {}),
                    }
                    for annotation in task1_annotations
                ],
                
                # Task 2 annotations (same for all forms)
                "annotations_task_2": [
                    {
                        "annotator": int(annotation.user_id),
                        "address_all_aspects": annotation.data.get("aspects", False),
                        "justification_for_addressing_all_aspects": annotation.data.get("execution_text", ""),
                        "with_explanation": annotation.data.get("explanation", False),
                        "code_executable": annotation.data.get("execution") in ["Executable", "N/A"],
                        "code_download_link": annotation.data.get("codeDownloadUrl", "")
                    }
                    for annotation in task2_annotations
                ],
                
                # Task 3 annotations (same for all forms)
                "annotations_task_3": [
                    {
                        "annotator": int(annotation.user_id),
                        "timestamp": annotation.timestamp.isoformat() if hasattr(annotation, 'timestamp') and annotation.timestamp else datetime.now(timezone.utc).isoformat(),
                        **_process_task3_annotation_data(annotation.data)
                    }
                    for annotation in task3_annotations
                ],
                
                # Task 1 consensus (same for all forms)
                "agreed_annotation_task_1": {
                    "relevance": task1_consensus_data.get("relevance", False),
                    "learning_value": task1_consensus_data.get("learning", False),
                    "clarity": task1_consensus_data.get("clarity", False),
                   **({"image_grounded": task1_consensus_data.get("grounded", False)} if annotation.data.get("grounded", "") != "N/A"else {}),
                },
                
                # Task 2 consensus (same for all forms)
                "agreed_annotation_task_2": {
                    "address_all_aspects": task2_consensus_data.get("aspects", False),
                    "justification_for_addressing_all_aspects": task2_consensus_data.get("aspects_text", ""),
                    "with_explanation": task2_consensus_data.get("explanation", False),
                    "code_executable": task2_consensus_data.get("execution") in ["Executable", "N/A"],
                    "code_download_link": task2_consensus_data.get("codeDownloadUrl", "")
                },
                
                # Task 3 consensus (specific to this form)
                "agreed_annotation_task_3": form_result
            }

            # Add required fields with defaults if missing for Task 3
            task3_required_fields = {
                "question_type": "Reasoning",
                "short_answer_list": [],
                "long_answer": "",
                "rewritten_question": [],
                "supporting_docs": []
            }
            for field, default_value in task3_required_fields.items():
                if field not in entry["agreed_annotation_task_3"]:
                    entry["agreed_annotation_task_3"][field] = default_value

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
@app.get("/api/hello")
async def hello():
    return {"message": "hello"}
# Get a specific consensus annotation for a discussion and task
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
    result = consensus_service.create_or_update_consensus_annotation(db, consensus_data, current_user.email)
    return result

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