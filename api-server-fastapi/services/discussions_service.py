
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
    """
    Retrieve discussions from the database, optionally filtered by task status.
    
    Parameters:
    - db: Database session
    - status: Optional filter for task status ('locked', 'unlocked', 'completed')
    
    Returns:
    - List of Discussion objects
    """
    query = db.query(models.Discussion)
    
    if status:
        # Get discussions based on task status
        if status == 'completed':
            # All tasks should be completed
            completed_discussions = []
            all_discussions = query.all()
            
            for discussion in all_discussions:
                task_assocs = db.query(models.discussion_task_association).filter(
                    models.discussion_task_association.c.discussion_id == discussion.id
                ).all()
                
                all_completed = all(task.status == 'completed' for task in task_assocs)
                if all_completed:
                    completed_discussions.append(discussion)
            
            return completed_discussions
            
        elif status == 'unlocked':
            # At least one task should be unlocked
            unlocked_discussions = []
            all_discussions = query.all()
            
            for discussion in all_discussions:
                task_assocs = db.query(models.discussion_task_association).filter(
                    models.discussion_task_association.c.discussion_id == discussion.id
                ).all()
                
                has_unlocked = any(task.status == 'unlocked' for task in task_assocs)
                if has_unlocked:
                    unlocked_discussions.append(discussion)
            
            return unlocked_discussions
            
        elif status == 'locked':
            # All tasks should be locked
            locked_discussions = []
            all_discussions = query.all()
            
            for discussion in all_discussions:
                task_assocs = db.query(models.discussion_task_association).filter(
                    models.discussion_task_association.c.discussion_id == discussion.id
                ).all()
                
                all_locked = all(task.status == 'locked' for task in task_assocs)
                if all_locked:
                    locked_discussions.append(discussion)
            
            return locked_discussions
    
    # If no status filter or unknown status, return all
    return query.all()

def get_discussion_by_id(db: Session, discussion_id: str) -> Optional[schemas.Discussion]:
    """
    Get a specific discussion by ID, including its task status information.
    
    Parameters:
    - db: Database session
    - discussion_id: The unique ID of the discussion to retrieve
    
    Returns:
    - Discussion with task status information, or None if not found
    """
    # Query the discussion
    db_discussion = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
    
    if not db_discussion:
        return None
    
    # Get task associations for this discussion
    task_associations = db.query(models.discussion_task_association).filter(
        models.discussion_task_association.c.discussion_id == discussion_id
    ).all()
    
    # Create task state dictionary
    tasks = {}
    for task_num in range(1, 4):
        task_assoc = next((t for t in task_associations if t.task_number == task_num), None)
        if task_assoc:
            tasks[f"task{task_num}"] = schemas.TaskState(
                status=task_assoc.status,
                annotators=task_assoc.annotators
            )
        else:
            # Default task state if no association exists
            tasks[f"task{task_num}"] = schemas.TaskState(
                status="locked",
                annotators=0
            )
    
    # Convert to schema and return
    return schemas.Discussion(
        id=db_discussion.id,
        title=db_discussion.title,
        url=db_discussion.url,
        repository=db_discussion.repository,
        created_at=db_discussion.created_at,
        repository_language=db_discussion.repository_language,
        release_tag=db_discussion.release_tag,
        release_url=db_discussion.release_url,
        release_date=db_discussion.release_date,
        tasks=tasks
    )

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
    """
    Update the status of a specific task for a discussion.
    
    Parameters:
    - db: Database session
    - task_update: TaskStatusUpdate object containing discussion_id, task_id, and status
    
    Returns:
    - TaskManagementResult with success/failure information
    """
    try:
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(models.Discussion.id == task_update.discussion_id).first()
        if not discussion:
            return schemas.TaskManagementResult(
                success=False,
                message=f"Discussion with ID {task_update.discussion_id} not found"
            )
        
        # Update the task status
        result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == task_update.discussion_id,
                    models.discussion_task_association.c.task_number == task_update.task_id
                )
            ).values(
                status=task_update.status
            )
        )
        
        if result.rowcount == 0:
            # Create task association if it doesn't exist
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=task_update.discussion_id,
                    task_number=task_update.task_id,
                    status=task_update.status,
                    annotators=0
                )
            )
        
        db.commit()
        
        # Get updated discussion with tasks for response
        updated_discussion = get_discussion_by_id(db, task_update.discussion_id)
        
        return schemas.TaskManagementResult(
            success=True,
            message=f"Task {task_update.task_id} status updated to {task_update.status}",
            discussion=updated_discussion
        )
        
    except Exception as e:
        db.rollback()
        return schemas.TaskManagementResult(
            success=False,
            message=f"Error updating task status: {str(e)}"
        )

def extract_repository_from_url(url: str) -> str:
    """Legacy repository extraction (keep for compatibility)"""
    repository, _, _ = extract_repository_info_from_url(url)
    return repository
