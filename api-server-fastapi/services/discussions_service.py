from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
import re
import requests
from datetime import datetime
import logging
from typing import List, Optional, Tuple, Dict, Any

# Configure logging
logger = logging.getLogger(__name__)

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
                    discussions_with_tasks.append(get_discussion_by_id(db, disc.id))
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
                    discussions_with_tasks.append(get_discussion_by_id(db, disc.id))
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
                    discussions_with_tasks.append(get_discussion_by_id(db, disc.id))
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
    except Exception as e:
        logger.error(f"Error fetching discussions: {str(e)}")
        # Return empty list when error occurs
        return []

def get_discussion_by_id(db: Session, discussion_id: str) -> Optional[schemas.Discussion]:
    """
    Get a specific discussion by ID, including its task status information.
    
    Parameters:
    - db: Database session
    - discussion_id: The unique ID of the discussion to retrieve
    
    Returns:
    - Discussion with task status information, or None if not found
    """
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
            tasks=tasks
        )
        
        logger.info(f"Successfully fetched discussion: {discussion_id}")
        return discussion
    except Exception as e:
        logger.error(f"Error fetching discussion {discussion_id}: {str(e)}")
        return None

def generate_discussion_id(repository: str, discussion_url: str) -> str:
    """
    Generate a unique ID for a discussion based on repository and discussion URL
    
    Parameters:
    - repository: Repository name
    - discussion_url: URL of the discussion
    
    Returns:
    - Generated ID string
    """
    try:
        # Extract discussion number from the URL
        discussion_number_match = re.search(r'/discussions/(\d+)', discussion_url)
        if discussion_number_match:
            discussion_number = discussion_number_match.group(1)
        else:
            # Fallback to URL hash if no number found
            from hashlib import md5
            discussion_number = md5(discussion_url.encode()).hexdigest()[:8]
            
        # Clean repository name for ID
        repo_part = repository.split('/')[1] if '/' in repository else repository
        repo_part = re.sub(r'[^a-zA-Z0-9]', '', repo_part)  # Remove non-alphanumeric chars
        
        return f"{repo_part}_{discussion_number}"
    except Exception as e:
        logger.error(f"Error generating discussion ID: {str(e)}")
        # Fallback to hash of URL
        from hashlib import md5
        return f"discussion_{md5(discussion_url.encode()).hexdigest()[:10]}"

def fetch_discussion_title(url: str) -> str:
    """
    Attempt to fetch a discussion title from GitHub
    
    Parameters:
    - url: GitHub discussion URL
    
    Returns:
    - Discussion title or repository name as fallback
    """
    try:
        # This is a placeholder - in a real implementation, you would use GitHub API
        # to fetch the actual title of the discussion
        logger.info(f"Attempting to fetch discussion title from {url}")
        
        # Extract repository for fallback title
        repository, _, _ = extract_repository_info_from_url(url)
        
        # Try to extract page title from GitHub
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        # Add GitHub token if available
        github_token = requests.get('https://github.com')
        if github_token:
            headers["Authorization"] = f"token {github_token}"
            
        logger.info(f"Making request to GitHub for discussion title: {url}")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            # Simple title extraction using regex (basic approach)
            title_match = re.search(r'<title>(.*?)</title>', response.text)
            if title_match:
                raw_title = title_match.group(1)
                # Clean up title, typically GitHub titles are "Title · Discussion #123 · owner/repo"
                cleaned_title = re.sub(r'·.*$', '', raw_title).strip()
                if cleaned_title:
                    logger.info(f"Successfully extracted title: {cleaned_title}")
                    return cleaned_title
        
        logger.warning(f"Could not extract title, using repository as fallback: {repository}")
        return repository  # Fallback to repository name
    except Exception as e:
        logger.error(f"Error fetching discussion title: {str(e)}")
        repository, _, _ = extract_repository_info_from_url(url)
        return repository  # Fallback to repository name

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
    
    try:
        logger.info(f"Processing upload of {len(upload_data.discussions)} discussions")
        
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
                language = disc.repositoryLanguage
                
                # Create new discussion with enhanced metadata
                new_discussion = models.Discussion(
                    id=discussion_id,
                    title=title,
                    url=disc.url,
                    repository=repository,
                    created_at=disc.createdAt,
                    repository_language=language,
                    release_tag=disc.releaseTag,
                    release_url=disc.releaseUrl,
                    release_date=disc.releaseDate
                )
                db.add(new_discussion)
                db.flush()  # Flush to get the ID
                
                # Add task associations
                tasks = disc.tasks or schemas.GitHubDiscussionTasks()
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=1,
                        status=tasks.task1.status if tasks.task1 else "locked",
                        annotators=tasks.task1.annotators if tasks.task1 else 0
                    )
                )
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=2,
                        status=tasks.task2.status if tasks.task2 else "locked",
                        annotators=tasks.task2.annotators if tasks.task2 else 0
                    )
                )
                
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=new_discussion.id,
                        task_number=3,
                        status=tasks.task3.status if tasks.task3 else "locked",
                        annotators=tasks.task3.annotators if tasks.task3 else 0
                    )
                )
                
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
            errors=[error_msg] + errors
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
        logger.info(f"Updating task {task_update.task_id} status to {task_update.status} for discussion {task_update.discussion_id}")
        
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(models.Discussion.id == task_update.discussion_id).first()
        if not discussion:
            logger.warning(f"Discussion with ID {task_update.discussion_id} not found")
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
            logger.info(f"Creating new task association for discussion {task_update.discussion_id}, task {task_update.task_id}")
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
        
        logger.info(f"Successfully updated task {task_update.task_id} status to {task_update.status}")
        return schemas.TaskManagementResult(
            success=True,
            message=f"Task {task_update.task_id} status updated to {task_update.status}",
            discussion=updated_discussion
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task status: {str(e)}")
        return schemas.TaskManagementResult(
            success=False,
            message=f"Error updating task status: {str(e)}"
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
