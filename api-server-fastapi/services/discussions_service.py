
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
import re
from typing import List, Optional

def get_discussions(db: Session, status: Optional[str] = None) -> List[models.Discussion]:
    discussions = db.query(models.Discussion).all()
    
    # Convert to Pydantic models with tasks info
    result = []
    for disc in discussions:
        # Get task states for this discussion
        task_states = {}
        for task_num in range(1, 4):
            task_assoc = db.query(models.discussion_task_association).filter(
                and_(
                    models.discussion_task_association.c.discussion_id == disc.id,
                    models.discussion_task_association.c.task_number == task_num
                )
            ).first()
            
            if task_assoc:
                task_states[f"task{task_num}"] = schemas.TaskState(
                    status=task_assoc.status,
                    annotators=task_assoc.annotators
                )
            else:
                task_states[f"task{task_num}"] = schemas.TaskState(
                    status="locked",
                    annotators=0
                )
        
        # Filter by status if requested
        if status:
            if status == "completed":
                if not all(t.status == "completed" for t in task_states.values()):
                    continue
            elif status == "unlocked":
                if not any(t.status == "unlocked" for t in task_states.values()):
                    continue
            elif status == "locked":
                if not all(t.status == "locked" for t in task_states.values()):
                    continue
        
        disc_dict = {
            "id": disc.id,
            "title": disc.title,
            "url": disc.url,
            "repository": disc.repository,
            "created_at": disc.created_at,
            "tasks": task_states
        }
        result.append(schemas.Discussion(**disc_dict))
    
    return result

def get_discussion_by_id(db: Session, discussion_id: str) -> Optional[schemas.Discussion]:
    db_discussion = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
    
    if not db_discussion:
        return None
    
    # Get task states for this discussion
    task_states = {}
    for task_num in range(1, 4):
        task_assoc = db.query(models.discussion_task_association).filter(
            and_(
                models.discussion_task_association.c.discussion_id == db_discussion.id,
                models.discussion_task_association.c.task_number == task_num
            )
        ).first()
        
        if task_assoc:
            task_states[f"task{task_num}"] = schemas.TaskState(
                status=task_assoc.status,
                annotators=task_assoc.annotators
            )
        else:
            task_states[f"task{task_num}"] = schemas.TaskState(
                status="locked",
                annotators=0
            )
    
    return schemas.Discussion(
        id=db_discussion.id,
        title=db_discussion.title,
        url=db_discussion.url,
        repository=db_discussion.repository,
        created_at=db_discussion.created_at,
        tasks=task_states
    )

def upload_discussions(db: Session, upload_data: schemas.DiscussionUpload) -> schemas.UploadResult:
    discussions_added = 0
    errors = []
    
    try:
        for disc in upload_data.discussions:
            # Extract repository from URL if not provided
            repository = disc.repository or extract_repository_from_url(disc.url)
            
            # Check if discussion already exists
            existing = db.query(models.Discussion).filter(models.Discussion.id == disc.id).first()
            if existing:
                errors.append(f"Discussion with ID {disc.id} already exists")
                continue
            
            # Create new discussion
            new_discussion = models.Discussion(
                id=disc.id,
                title=disc.title,
                url=disc.url,
                repository=repository,
                created_at=disc.created_at
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
    # Find the discussion
    discussion = db.query(models.Discussion).filter(models.Discussion.id == task_update.discussion_id).first()
    if not discussion:
        return schemas.TaskManagementResult(
            success=False,
            message="Discussion not found"
        )
    
    try:
        # Update the task status
        db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == task_update.discussion_id,
                    models.discussion_task_association.c.task_number == task_update.task_id
                )
            ).values(
                status=task_update.status
            )
        )
        
        db.commit()
        
        # Get the updated discussion
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
            message=f"Failed to update task status: {str(e)}"
        )

def extract_repository_from_url(url: str) -> str:
    try:
        github_url_pattern = r"github\.com/([^/]+/[^/]+)"
        match = re.search(github_url_pattern, url, re.IGNORECASE)
        return match.group(1) if match else "unknown/repository"
    except Exception:
        return "unknown/repository"
