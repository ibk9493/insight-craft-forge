from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
import re
import requests
from datetime import datetime
from typing import List, Optional, Tuple
from utils.repository_metadata import extract_repository_info_from_url, get_repository_language, find_release_for_discussion

def get_discussions(db: Session, status: Optional[str] = None) -> List[models.Discussion]:
    # ... keep existing code (querying discussions logic)

def get_discussion_by_id(db: Session, discussion_id: str) -> Optional[schemas.Discussion]:
    # ... keep existing code (get discussion by ID logic)

def upload_discussions(db: Session, upload_data: schemas.DiscussionUpload) -> schemas.UploadResult:
    discussions_added = 0
    errors = []
    
    try:
        for disc in upload_data.discussions:
            # Extract repository information
            repository, owner, repo = extract_repository_info_from_url(disc.url)
            
            # Check if discussion already exists
            existing = db.query(models.Discussion).filter(models.Discussion.id == disc.id).first()
            if existing:
                errors.append(f"Discussion with ID {disc.id} already exists")
                continue
            
            # Get repository language if possible
            language = None
            if owner and repo:
                language = get_repository_language(owner, repo)
            
            # Get release information
            release_info = {}
            if owner and repo and disc.created_at:
                release_info = find_release_for_discussion(owner, repo, disc.created_at)
            
            # Create new discussion with enhanced metadata
            new_discussion = models.Discussion(
                id=disc.id,
                title=disc.title,
                url=disc.url,
                repository=repository,
                created_at=disc.created_at,
                repository_language=language,
                release_tag=release_info.get("tag"),
                release_url=release_info.get("url"),
                release_date=release_info.get("date")
            )
            db.add(new_discussion)
            db.flush()  # Flush to get the ID
            
            # Add task associations
            for task_num in range(1, 4):
                task_info = getattr(disc.tasks, f"task{task_num}", None) if disc.tasks else None
                status = task_info.status if task_info else "locked"
                annotators = task_info.annotators if task_info else 0
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=task_num,
                        status=status,
                        annotators=annotators
                    )
                )
            
            discussions_added += 1
        
        db.commit()
        return schemas.UploadResult(
            success=True,
            message=f"Successfully uploaded {discussions_added} discussions",
            discussions_added=discussions_added,
            errors=errors if errors else None
        )
        
    except Exception as e:
        db.rollback()
        return schemas.UploadResult(
            success=False,
            message="Error processing discussions",
            discussions_added=discussions_added,
            errors=[str(e)] + errors
        )

def update_task_status(db: Session, task_update: schemas.TaskStatusUpdate) -> schemas.TaskManagementResult:
    # ... keep existing code (task status update logic)

def extract_repository_from_url(url: str) -> str:
    """Legacy repository extraction (keep for compatibility)"""
    repository, _, _ = extract_repository_info_from_url(url)
    return repository
