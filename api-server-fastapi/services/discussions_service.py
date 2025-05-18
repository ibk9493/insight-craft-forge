
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
import re
import requests
from datetime import datetime
import logging
from typing import List, Optional, Tuple, Dict, Any
from contextlib import contextmanager

# Configure logging
logger = logging.getLogger(__name__)

class DiscussionNotFoundError(Exception):
    """Raised when a discussion cannot be found."""
    pass

class DatabaseError(Exception):
    """Raised when a database operation fails."""
    pass

class ValidationError(Exception):
    """Raised when input validation fails."""
    pass

@contextmanager
def transaction_scope(db: Session):
    """Provide a transactional scope around a series of operations."""
    try:
        yield
        db.commit()
    except exc.SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise DatabaseError(f"Database operation failed: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Transaction error: {str(e)}")
        raise

def validate_discussion_data(discussion: schemas.GitHubDiscussion) -> None:
    """Validate discussion data."""
    if not discussion.url:
        raise ValidationError("Discussion URL cannot be empty")
    
    if not discussion.url.startswith("https://"):
        raise ValidationError("Discussion URL must start with https://")
    
    # Add more validation rules as needed

def get_discussions(db: Session, status: Optional[str] = None) -> List[schemas.Discussion]:
    """
    Retrieve discussions from the database, optionally filtered by task status.
    
    Parameters:
    - db: Database session
    - status: Optional filter for task status ('locked', 'unlocked', 'completed')
    
    Returns:
    - List of Discussion objects
    """
    try:
        logger.info(f"Fetching discussions with status: {status}")
        query = db.query(models.Discussion)
        
        if status:
            valid_statuses = ['completed', 'unlocked', 'locked']
            if status not in valid_statuses:
                logger.warning(f"Invalid status filter: {status}")
                return []
                
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
                
                logger.info(f"Found {len(completed_discussions)} completed discussions")
                discussions_with_tasks = []
                for disc in completed_discussions:
                    discussion = get_discussion_by_id(db, disc.id)
                    if discussion:
                        discussions_with_tasks.append(discussion)
                return discussions_with_tasks
                
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
                
                logger.info(f"Found {len(unlocked_discussions)} unlocked discussions")
                discussions_with_tasks = []
                for disc in unlocked_discussions:
                    discussion = get_discussion_by_id(db, disc.id)
                    if discussion:
                        discussions_with_tasks.append(discussion)
                return discussions_with_tasks
                
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
                
                logger.info(f"Found {len(locked_discussions)} locked discussions")
                discussions_with_tasks = []
                for disc in locked_discussions:
                    discussion = get_discussion_by_id(db, disc.id)
                    if discussion:
                        discussions_with_tasks.append(discussion)
                return discussions_with_tasks
        
        # If no status filter or unknown status, return all with tasks
        all_discussions = query.all()
        result = []
        logger.info(f"Found {len(all_discussions)} total discussions")
        
        # Add tasks information to each discussion
        for disc in all_discussions:
            discussion_with_tasks = get_discussion_by_id(db, disc.id)
            if discussion_with_tasks:
                result.append(discussion_with_tasks)
        
        return result
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_discussions: {str(e)}")
        raise DatabaseError(f"Failed to retrieve discussions: {str(e)}")
    except Exception as e:
        logger.error(f"Error fetching discussions: {str(e)}")
        # Return empty list when error occurs
        return []

def _get_discussions_with_status(db: Session, status_name: str, filter_func) -> List[schemas.Discussion]:
    """
    Helper function to get discussions filtered by a task status condition.
    
    Parameters:
    - db: Database session
    - status_name: Name of the status for logging
    - filter_func: Function that takes task_assocs and returns True/False for filtering
    
    Returns:
    - List of filtered discussions with task information
    """
    try:
        all_discussions = db.query(models.Discussion).all()
        filtered_discussions = []
        
        for discussion in all_discussions:
            task_assocs = db.query(models.discussion_task_association).filter(
                models.discussion_task_association.c.discussion_id == discussion.id
            ).all()
            
            if filter_func(task_assocs):
                filtered_discussions.append(discussion)
        
        logger.info(f"Found {len(filtered_discussions)} {status_name} discussions")
        
        discussions_with_tasks = []
        for disc in filtered_discussions:
            discussion = get_discussion_by_id(db, disc.id)
            if discussion:
                discussions_with_tasks.append(discussion)
        
        return discussions_with_tasks
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in _get_discussions_with_status: {str(e)}")
        raise DatabaseError(f"Failed to retrieve discussions with status {status_name}: {str(e)}")

def get_discussion_by_id(db: Session, discussion_id: str) -> Optional[schemas.Discussion]:
    """
    Get a specific discussion by ID, including its task status information.
    
    Parameters:
    - db: Database session
    - discussion_id: The unique ID of the discussion to retrieve
    
    Returns:
    - Discussion with task status information, or None if not found
    """
    if not discussion_id:
        logger.warning("Empty discussion_id provided")
        raise ValidationError("Discussion ID cannot be empty")
        
    try:
        logger.info(f"Fetching discussion with ID: {discussion_id}")
        # Query the discussion
        db_discussion = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
        
        if not db_discussion:
            logger.warning(f"Discussion not found: {discussion_id}")
            return None
        
        # Get task associations for this discussion
        task_associations = db.query(models.discussion_task_association).filter(
            models.discussion_task_association.c.discussion_id == discussion_id
        ).all()
        
        # Create task state dictionary
        tasks = {}
        for task_num in range(1, 4):
            task_assoc = next((t for t in task_associations if t.task_number == task_num), None)
            status = "locked"
            annotators = 0
            
            if task_assoc:
                status = task_assoc.status
                annotators = task_assoc.annotators
            
            tasks[f"task{task_num}"] = schemas.TaskState(
                status=status,
                annotators=annotators
            )
        
        # Convert to schema and return
        discussion = schemas.Discussion(
            id=db_discussion.id,
            title=db_discussion.title,
            url=db_discussion.url,
            repository=db_discussion.repository,
            created_at=db_discussion.created_at,
            repository_language=db_discussion.repository_language,
            release_tag=db_discussion.release_tag,
            release_url=db_discussion.release_url,
            release_date=db_discussion.release_date,
            batch_id=db_discussion.batch_id,
            # For backward compatibility with older code
            task1_status=tasks["task1"].status,
            task1_annotators=tasks["task1"].annotators,
            task2_status=tasks["task2"].status,
            task2_annotators=tasks["task2"].annotators,
            task3_status=tasks["task3"].status,
            task3_annotators=tasks["task3"].annotators,
            # New structure for tasks
            tasks=tasks
        )
        
        logger.info(f"Successfully fetched discussion: {discussion_id}")
        return discussion
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_discussion_by_id: {str(e)}")
        raise DatabaseError(f"Failed to retrieve discussion {discussion_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Error fetching discussion {discussion_id}: {str(e)}")
        return None

def generate_discussion_id(repository: str, url: str) -> str:
    """
    Generate a unique discussion ID based on repository and URL.
    
    Parameters:
    - repository: Repository name (e.g., 'owner/repo')
    - url: Discussion URL
    
    Returns:
    - A unique discussion ID
    """
    try:
        # Extract number from the URL (last part after /)
        number = url.rstrip('/').split('/')[-1]
        
        # Clean repository name
        clean_repo = repository.replace('/', '_')
        
        # Create ID in format: repo_discussionNumber
        discussion_id = f"{clean_repo}_{number}"
        
        return discussion_id
    except Exception as e:
        logger.error(f"Error generating discussion ID: {str(e)}")
        # Fallback to a timestamp-based ID if something goes wrong
        return f"discussion_{int(datetime.now().timestamp())}"

def fetch_discussion_title(url: str) -> str:
    """
    Fetch the title of a GitHub discussion from its URL.
    
    Parameters:
    - url: GitHub discussion URL
    
    Returns:
    - Discussion title or a generic title if fetching fails
    """
    try:
        # Extract relevant information for the GitHub API
        # This is a simplified version - in practice you'd use GitHub API
        match = re.search(r'github\.com/([^/]+)/([^/]+)/discussions/(\d+)', url)
        if not match:
            return f"Discussion from {url}"
        
        owner, repo, discussion_number = match.groups()
        
        # In a real implementation, you would use GitHub API with proper authentication
        logger.info(f"Would fetch title for {owner}/{repo} discussion #{discussion_number}")
        
        # For now, just return a placeholder
        return f"Discussion #{discussion_number} from {owner}/{repo}"
    except Exception as e:
        logger.error(f"Error fetching discussion title: {str(e)}")
        return f"Discussion from {url}"

def upload_discussions(db: Session, upload_data: schemas.DiscussionUpload) -> schemas.UploadResult:
    """
    Upload multiple GitHub discussions to the database.
    
    Parameters:
    - db: Database session
    - upload_data: DiscussionUpload object containing a list of GitHubDiscussion objects
    
    Returns:
    - UploadResult with success/failure information
    """
    discussions_added = 0
    errors = []
    batch_id = None
    
    if not upload_data.discussions:
        logger.warning("No discussions provided for upload")
        return schemas.UploadResult(
            success=False,
            message="No discussions provided for upload",
            discussions_added=0,
            batch_id=None,
            errors=["No discussions provided"]
        )
    
    try:
        logger.info(f"Processing upload of {len(upload_data.discussions)} discussions")
        
        # Create a batch if batch name is provided
        if upload_data.batch_name:
            from services import batch_service
            batch_data = schemas.BatchUploadCreate(
                name=upload_data.batch_name,
                description=upload_data.batch_description
            )
            batch = batch_service.create_batch(db, batch_data)
            batch_id = batch.id
            logger.info(f"Created batch with ID {batch_id}: {upload_data.batch_name}")
        
        for disc in upload_data.discussions:
            try:
                # Extract repository information from URL if not provided
                repository = disc.repository
                if not repository and disc.url:
                    repository, owner, repo = extract_repository_info_from_url(disc.url)
                    logger.info(f"Extracted repository: {repository} from URL: {disc.url}")
                
                # Generate ID if not provided
                discussion_id = disc.id
                if not discussion_id:
                    discussion_id = generate_discussion_id(repository, disc.url)
                    logger.info(f"Generated discussion ID: {discussion_id}")
                
                # Check if discussion already exists
                existing = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
                if existing:
                    errors.append(f"Discussion with ID {discussion_id} already exists")
                    logger.warning(f"Discussion with ID {discussion_id} already exists")
                    continue
                
                # Get title if not provided
                title = disc.title
                if not title:
                    title = fetch_discussion_title(disc.url)
                    logger.info(f"Generated discussion title: {title}")
                
                # Get repository language if possible
                language = disc.repository_language
                
                # Use batch_id from request or from the batch we created
                discussion_batch_id = disc.batch_id or batch_id
                
                # Create new discussion with enhanced metadata
                new_discussion = models.Discussion(
                    id=discussion_id,
                    title=title,
                    url=disc.url,
                    repository=repository,
                    created_at=disc.created_at,
                    repository_language=language,
                    release_tag=disc.release_tag,
                    release_url=disc.release_url,
                    release_date=disc.release_date,
                    batch_id=discussion_batch_id
                )
                db.add(new_discussion)
                db.flush()  # Flush to get the ID
                
                # Add task associations
                tasks = disc.tasks or {}
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=1,
                        status=tasks.get("task1", {}).get("status", "locked"),
                        annotators=tasks.get("task1", {}).get("annotators", 0)
                    )
                )
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=2,
                        status=tasks.get("task2", {}).get("status", "locked"),
                        annotators=tasks.get("task2", {}).get("annotators", 0)
                    )
                )
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=3,
                        status=tasks.get("task3", {}).get("status", "locked"),
                        annotators=tasks.get("task3", {}).get("annotators", 0)
                    )
                )
                
                # Update batch discussion count if we have a batch
                if discussion_batch_id:
                    from services import batch_service
                    batch_service.increment_discussion_count(db, discussion_batch_id)
                
                discussions_added += 1
                logger.info(f"Added discussion: {discussion_id}")
            except Exception as e:
                error_msg = f"Error processing discussion {getattr(disc, 'id', 'unknown')}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        db.commit()
        logger.info(f"Successfully uploaded {discussions_added} discussions")
        return schemas.UploadResult(
            success=True,
            message=f"Successfully uploaded {discussions_added} discussions",
            discussions_added=discussions_added,
            batch_id=batch_id,
            errors=errors if errors else None
        )
        
    except Exception as e:
        db.rollback()
        error_msg = f"Error processing discussions: {str(e)}"
        logger.error(error_msg)
        return schemas.UploadResult(
            success=False,
            message="Error processing discussions",
            discussions_added=discussions_added,
            batch_id=batch_id,
            errors=[error_msg] + errors
        )

def update_task_status(db: Session, discussion_id: str, task_id: int, status: str) -> schemas.TaskManagementResult:
    """
    Update the status of a specific task for a discussion.
    
    Parameters:
    - db: Database session
    - discussion_id: The ID of the discussion
    - task_id: The ID of the task to update
    - status: The new status for the task
    
    Returns:
    - TaskManagementResult with success/failure information
    """
    try:
        logger.info(f"Updating task {task_id} status to {status} for discussion {discussion_id}")
        
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
        if not discussion:
            logger.warning(f"Discussion with ID {discussion_id} not found")
            # Create a dummy Discussion object when not found to satisfy schema requirements
            dummy_discussion = schemas.Discussion(
                id="not_found",
                title="Not Found",
                url="",
                repository="",
                created_at="1970-01-01T00:00:00Z"
                # Other fields will use their default values
            )
            return schemas.TaskManagementResult(
                success=False,
                message=f"Discussion with ID {discussion_id} not found",
                discussion=dummy_discussion
            )
        
        # Update the task status
        result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_id
                )
            ).values(
                status=status
            )
        )
        
        if result.rowcount == 0:
            logger.info(f"Creating new task association for discussion {discussion_id}, task {task_id}")
            # Create task association if it doesn't exist
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=task_id,
                    status=status,
                    annotators=0
                )
            )
        
        db.commit()
        
        # Get updated discussion with tasks for response
        updated_discussion = get_discussion_by_id(db, discussion_id)
        
        # Convert to dict first to ensure Pydantic V2 serialization works correctly
        if updated_discussion:
            discussion_data = {
                "id": updated_discussion.id,
                "title": updated_discussion.title,
                "url": updated_discussion.url,
                "repository": updated_discussion.repository,
                "created_at": updated_discussion.created_at,
                "repository_language": updated_discussion.repository_language,
                "release_tag": updated_discussion.release_tag,
                "release_url": updated_discussion.release_url,
                "release_date": updated_discussion.release_date,
                "batch_id": updated_discussion.batch_id,
                "task1_status": updated_discussion.task1_status,
                "task1_annotators": updated_discussion.task1_annotators,
                "task2_status": updated_discussion.task2_status,
                "task2_annotators": updated_discussion.task2_annotators,
                "task3_status": updated_discussion.task3_status,
                "task3_annotators": updated_discussion.task3_annotators,
                "tasks": updated_discussion.tasks
            }
            discussion_model = schemas.Discussion(**discussion_data)
        else:
            # Fallback dummy discussion if for some reason get_discussion_by_id returns None
            discussion_model = schemas.Discussion(
                id=discussion_id,
                title="Unknown Discussion",
                url="",
                repository="",
                created_at="1970-01-01T00:00:00Z"
            )
        
        logger.info(f"Successfully updated task {task_id} status to {status}")
        return schemas.TaskManagementResult(
            success=True,
            message=f"Task {task_id} status updated to {status}",
            discussion=discussion_model
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task status: {str(e)}")
        # Create a dummy Discussion object for error case
        error_discussion = schemas.Discussion(
            id="error",
            title="Error",
            url="",
            repository="",
            created_at="1970-01-01T00:00:00Z"
        )
        return schemas.TaskManagementResult(
            success=False,
            message=f"Error updating task status: {str(e)}",
            discussion=error_discussion
        )
    
    
def extract_repository_info_from_url(url: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Extract repository name, owner and repo from GitHub URL"""
    try:
        githubUrlPattern = r'github\.com\/([^\/]+)\/([^\/]+)'
        match = re.search(githubUrlPattern, url)
        if match:
            owner = match.group(1)
            repo = match.group(2)
            # Clean up repo name which might contain extra parts
            if '/' in repo:
                repo = repo.split('/')[0]
            repository = f"{owner}/{repo}"
            return repository, owner, repo
        return "unknown/repository", None, None
    except Exception as e:
        logger.error(f"Error extracting repository from URL {url}: {str(e)}")
        return "unknown/repository", None, None

def extract_repository_from_url(url: str) -> str:
    """Legacy repository extraction (keep for compatibility)"""
    repository, _, _ = extract_repository_info_from_url(url)
    return repository
