
from sqlalchemy.orm import Session
from sqlalchemy import and_ , exc
import models
import schemas
import re
import requests
from datetime import datetime
import logging
from typing import List, Optional, Tuple, Dict, Any
from contextlib import contextmanager
from services.github_metadata_service import schedule_metadata_fetch
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import joinedload

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
    Get a specific discussion by ID, including its task status information and all annotations.
    Uses existing association table to compute task status fields.
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
        
        # Create task state dictionary AND compute individual task status fields
        tasks = {}
        task1_status = "locked"
        task1_annotators = 0
        task2_status = "locked"
        task2_annotators = 0
        task3_status = "locked"
        task3_annotators = 0
        
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
            
            # Set individual task status fields for backward compatibility
            if task_num == 1:
                task1_status = status
                task1_annotators = annotators
            elif task_num == 2:
                task2_status = status
                task2_annotators = annotators
            elif task_num == 3:
                task3_status = status
                task3_annotators = annotators
        
        # Get all annotations for this discussion (keep your existing logic)
        annotations = {}
        for task_num in range(1, 4):
            task_annotations = db.query(models.Annotation).filter(
                models.Annotation.discussion_id == discussion_id,
                models.Annotation.task_id == task_num
            ).all()
            
            annotations[f"task{task_num}_annotations"] = [
                schemas.Annotation(
                    id=annotation.id,
                    discussion_id=annotation.discussion_id,
                    user_id=annotation.user_id,
                    task_id=annotation.task_id,
                    data=annotation.data,
                    timestamp=annotation.timestamp
                ) for annotation in task_annotations
            ]
            
            # Get consensus annotation if available
            consensus = db.query(models.ConsensusAnnotation).filter(
                models.ConsensusAnnotation.discussion_id == discussion_id,
                models.ConsensusAnnotation.task_id == task_num
            ).first()
            
            if consensus:
                annotations[f"task{task_num}_consensus"] = schemas.Annotation(
                    id=0,  # Use a placeholder ID for consensus
                    discussion_id=consensus.discussion_id,
                    pod_lead_email=consensus.user_id, 
                    user_id="consensus",
                    task_id=consensus.task_id,
                    data=consensus.data,
                    timestamp=consensus.timestamp
                )
            else:
                annotations[f"task{task_num}_consensus"] = None
        
        # Convert to schema and return with computed task status fields
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
            # Include the content fields from upload
            question=db_discussion.question,
            answer=db_discussion.answer,
            category=db_discussion.category,
            knowledge=db_discussion.knowledge,
            code=db_discussion.code,
            # Computed task status fields from association table
            task1_status=task1_status,
            task1_annotators=task1_annotators,
            task2_status=task2_status,
            task2_annotators=task2_annotators,
            task3_status=task3_status,
            task3_annotators=task3_annotators,
            # New structure for tasks
            tasks=tasks,
            # Adding annotations data
            annotations=annotations
        )
        
        logger.info(f"Successfully fetched discussion with computed task status: {discussion_id}")
        return discussion
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_discussion_by_id: {str(e)}")
        raise DatabaseError(f"Failed to retrieve discussion {discussion_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Error fetching discussion {discussion_id}: {str(e)}")
        return None

def get_discussions(db: Session, filters: Dict = None, limit: int = 10, offset: int = 0) -> List[schemas.Discussion]:
    """
    Retrieve discussions with enhanced filtering.
    """
    try:
        if not filters:
            filters = {}
            
        logger.info(f"Fetching discussions with filters: {filters}, limit: {limit}, offset: {offset}")
        
        # Start with base query (remove the joinedload for now)
        query = db.query(models.Discussion)
        
        # Apply filters
        query = _apply_filters(query, filters, db)
        
        # Apply pagination
        discussions = query.offset(offset).limit(limit).all()
        
        # Convert to schemas using the existing get_discussion_by_id method
        result = []
        for db_discussion in discussions:
            discussion_schema = get_discussion_by_id(db, db_discussion.id)
            if discussion_schema:
                result.append(discussion_schema)
        
        logger.info(f"Found {len(result)} discussions after filtering and pagination")
        return result
        
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_discussions: {str(e)}")
        raise DatabaseError(f"Failed to retrieve discussions: {str(e)}")

def _build_status_filter_query(db: Session, status: str):
    """
    Helper function to build the status filter subquery.
    Returns a subquery of discussion IDs that match the status criteria.
    """
    if status == 'completed':
        # Discussions where all 3 tasks are completed
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'completed'
        ).group_by(models.discussion_task_association.c.discussion_id).having(
            func.count() >= 3
        )
        
    elif status == 'unlocked':
        # Discussions that have at least one unlocked task
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'unlocked'
        ).distinct()
        
    elif status == 'locked':
        # Discussions where ALL tasks are locked
        discussions_with_non_locked = db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status != 'locked'
        ).distinct()
        
        discussions_with_tasks = db.query(models.discussion_task_association.c.discussion_id).distinct()
        
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.discussion_id.in_(discussions_with_tasks),
            ~models.discussion_task_association.c.discussion_id.in_(discussions_with_non_locked)
        ).distinct()
    
    # NEW STATUS FILTERS
    elif status == 'ready_for_consensus':
        # Discussions that have at least one task ready for consensus
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'ready_for_consensus'
        ).distinct()
        
    elif status == 'consensus_created':
        # Discussions that have at least one task with consensus created
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'consensus_created'
        ).distinct()
        
    elif status == 'rework':
        # Discussions that have at least one task flagged for rework
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'rework'
        ).distinct()
        
    elif status == 'blocked':
        # Discussions that have at least one blocked task
        return db.query(models.discussion_task_association.c.discussion_id).filter(
            models.discussion_task_association.c.status == 'blocked'
        ).distinct()
    
    return None


def get_filter_options(db: Session) -> Dict:
    """
    Get all available filter options from the database.
    """
    try:
        logger.info("Starting to fetch filter options")
        
        # Initialize result with defaults
        result = {
            'repository_languages': [],
            'release_tags': [],
            'batches': [],
            'date_range': {
                'min_date': None,
                'max_date': None
            }
        }
        
        # Get all unique repository languages
        try:
            languages_query = db.query(models.Discussion.repository_language).filter(
                models.Discussion.repository_language.isnot(None),
                models.Discussion.repository_language != ''
            ).distinct()
            
            languages = languages_query.all()
            result['repository_languages'] = sorted([lang[0] for lang in languages if lang[0] and lang[0].strip()])
            logger.info(f"Found {len(result['repository_languages'])} unique languages")
            
        except Exception as e:
            logger.error(f"Error fetching repository languages: {str(e)}")
            result['repository_languages'] = []
        
        # Get all unique release tags
        try:
            tags_query = db.query(models.Discussion.release_tag).filter(
                models.Discussion.release_tag.isnot(None),
                models.Discussion.release_tag != ''
            ).distinct()
            
            tags = tags_query.all()
            result['release_tags'] = sorted([tag[0] for tag in tags if tag[0] and tag[0].strip()])
            logger.info(f"Found {len(result['release_tags'])} unique release tags")
            
        except Exception as e:
            logger.error(f"Error fetching release tags: {str(e)}")
            result['release_tags'] = []
        
        # Get all batches - try multiple approaches
        try:
            # First try to get from Batch model if it exists
            try:
                if hasattr(models, 'BatchUpload'):
                    batches = db.query(models.BatchUpload.id, models.BatchUpload.name).all()
                    result['batches'] = [{'id': batch.id, 'name': batch.name} for batch in batches]
                    logger.info(f"Found {len(result['batches'])} batches from Batch model")
                else:
                    raise AttributeError("Batch model not found")
            except (AttributeError, Exception) as batch_error:
                logger.warning(f"Batch model access failed: {str(batch_error)}, trying fallback")
                
                # Fallback: get unique batch_ids from discussions
                batch_ids_query = db.query(models.Discussion.batch_id).filter(
                    models.Discussion.batch_id.isnot(None)
                ).distinct()
                
                batch_ids = batch_ids_query.all()
                result['batches'] = [
                    {'id': int(batch_id[0]), 'name': f'Batch {batch_id[0]}'} 
                    for batch_id in batch_ids 
                    if batch_id[0] is not None
                ]
                logger.info(f"Found {len(result['batches'])} unique batch IDs from discussions")
                
        except Exception as e:
            logger.error(f"Error fetching batches: {str(e)}")
            result['batches'] = []
        
        # Get date range
        try:
            date_range_query = db.query(
                func.min(models.Discussion.created_at),
                func.max(models.Discussion.created_at)
            )
            
            date_range = date_range_query.first()
            
            if date_range and date_range[0] and date_range[1]:
                # Handle different date formats
                min_date = date_range[0]
                max_date = date_range[1]
                
                # Convert to ISO format strings
                if hasattr(min_date, 'isoformat'):
                    result['date_range']['min_date'] = min_date.isoformat()
                else:
                    result['date_range']['min_date'] = str(min_date)
                    
                if hasattr(max_date, 'isoformat'):
                    result['date_range']['max_date'] = max_date.isoformat()
                else:
                    result['date_range']['max_date'] = str(max_date)
                    
                logger.info(f"Date range: {result['date_range']['min_date']} to {result['date_range']['max_date']}")
            else:
                logger.warning("No date range found in discussions")
                
        except Exception as e:
            logger.error(f"Error fetching date range: {str(e)}")
            result['date_range'] = {'min_date': None, 'max_date': None}
        
        logger.info(f"Filter options result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Critical error in get_filter_options: {str(e)}")
        # Return a valid default structure even on complete failure
        return {
            'repository_languages': [],
            'release_tags': [],
            'batches': [],
            'date_range': {
                'min_date': None,
                'max_date': None
            }
        }
def _apply_filters(query, filters: Dict, db: Session):
    """
    Apply various filters to the discussion query.
    """
    # Status filter (uses the existing logic)
    if filters.get('status') and filters['status'] in ['completed', 'unlocked', 'locked', 'ready_for_consensus', 'consensus_created', 'rework', 'blocked']:
        filtered_ids_query = _build_status_filter_query(db, filters['status'])
        if filtered_ids_query is not None:
            query = query.filter(models.Discussion.id.in_(filtered_ids_query))
    
    # Search filter
    if filters.get('search'):
        search_term = f"%{filters['search']}%"
        query = query.filter(
            or_(
                models.Discussion.title.ilike(search_term),
                models.Discussion.repository.ilike(search_term),
                models.Discussion.question.ilike(search_term),
                models.Discussion.answer.ilike(search_term),
                models.Discussion.id.ilike(search_term),
                models.Discussion.url.ilike(search_term),
                models.Discussion.batch_id.ilike(search_term)
            )
        )
    
    if filters.get('user_id'):
        user_id = filters['user_id']
        
        # Get discussion IDs where this user has annotations
        user_annotated_discussions = db.query(models.Annotation.discussion_id).filter(
            models.Annotation.user_id == user_id
        ).distinct()
        
        query = query.filter(
            models.Discussion.id.in_(user_annotated_discussions)
        )
        
        logger.info(f"Filtered to discussions annotated by user {user_id}")
    
    # Repository language filter
    if filters.get('repository_language'):
        query = query.filter(
            models.Discussion.repository_language.in_(filters['repository_language'])
        )
    
    # Release tag filter
    if filters.get('release_tag'):
        query = query.filter(
            models.Discussion.release_tag.in_(filters['release_tag'])
        )
    
    # Date range filters
    if filters.get('from_date'):
        try:
            from_date = datetime.fromisoformat(filters['from_date'])
            query = query.filter(models.Discussion.created_at >= from_date)
        except ValueError:
            logger.warning(f"Invalid from_date format: {filters['from_date']}")
    
    if filters.get('to_date'):
        try:
            to_date = datetime.fromisoformat(filters['to_date'])
            query = query.filter(models.Discussion.created_at <= to_date)
        except ValueError:
            logger.warning(f"Invalid to_date format: {filters['to_date']}")
    
    # Batch filter
    if filters.get('batch_id'):
        query = query.filter(models.Discussion.batch_id == filters['batch_id'])
    
    # FIXED TASK STATUS FILTERS - Use EXISTS instead of IN:
    
    # Task 1 status filter
    if filters.get('task1_status') and filters['task1_status'] in ['locked', 'unlocked', 'completed', 'ready_for_consensus', 'consensus_created', 'rework', 'blocked']:
        query = query.filter(
            db.query(models.discussion_task_association).filter(
                and_(
                    models.discussion_task_association.c.discussion_id == models.Discussion.id,
                    models.discussion_task_association.c.task_number == 1,
                    models.discussion_task_association.c.status == filters['task1_status']
                )
            ).exists()
        )
    
    # Task 2 status filter
    if filters.get('task2_status') and filters['task2_status'] in ['locked', 'unlocked', 'completed', 'ready_for_consensus', 'consensus_created', 'rework', 'blocked']:
        query = query.filter(
            db.query(models.discussion_task_association).filter(
                and_(
                    models.discussion_task_association.c.discussion_id == models.Discussion.id,
                    models.discussion_task_association.c.task_number == 2,
                    models.discussion_task_association.c.status == filters['task2_status']
                )
            ).exists()
        )
    
    # Task 3 status filter
    if filters.get('task3_status') and filters['task3_status'] in ['locked', 'unlocked', 'completed', 'ready_for_consensus', 'consensus_created', 'rework', 'blocked']:
        query = query.filter(
            db.query(models.discussion_task_association).filter(
                and_(
                    models.discussion_task_association.c.discussion_id == models.Discussion.id,
                    models.discussion_task_association.c.task_number == 3,
                    models.discussion_task_association.c.status == filters['task3_status']
                )
            ).exists()
        )
    if any(filters.get(f'task{i}_status') for i in [1,2,3]):
        logger.info(f"DEBUGGING: Applied task filters: {filters}")
        logger.info(f"DEBUGGING: Final query SQL: {str(query)}")

    return query

def get_discussions_count(db: Session, filters: Dict = None) -> int:
    """
    Get the total count of discussions with enhanced filtering.
    """
    try:
        if not filters:
            filters = {}
            
        logger.info(f"Counting discussions with filters: {filters}")
        
        # Start with base query
        query = db.query(models.Discussion)
        
        # Apply filters
        query = _apply_filters(query, filters, db)
        
        count = query.count()
        logger.info(f"Found {count} discussions matching filters")
        return count
        
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_discussions_count: {str(e)}")
        raise DatabaseError(f"Failed to count discussions: {str(e)}")

# Remove the _build_discussion_schema function since we're using get_discussion_by_id instead

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
                
                # Get title if not provided
                title = disc.title
                if not title:
                    title = fetch_discussion_title(disc.url)
                    logger.info(f"Generated discussion title: {title}")
                
                # Get repository language if possible - handle both field names
                language = getattr(disc, 'repository_language', None) or getattr(disc, 'lang', None)
                
                # Use batch_id from request or from the batch we created
                discussion_batch_id = disc.batch_id or batch_id
                
                # Check if discussion already exists
                existing = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
                
                if existing:
                    # UPDATE EXISTING DISCUSSION
                    updated_fields = []
                    
                    if title and title != existing.title:
                        existing.title = title
                        updated_fields.append('title')
                    if repository and repository != existing.repository:
                        existing.repository = repository
                        updated_fields.append('repository')
                    if language and language != existing.repository_language:
                        existing.repository_language = language
                        updated_fields.append('repository_language')
                    # Also check disc.repository_language if different from lang
                    repo_lang = getattr(disc, 'repository_language', None)
                    if repo_lang and repo_lang != existing.repository_language and repo_lang != language:
                        existing.repository_language = repo_lang
                        updated_fields.append('repository_language')
                    if disc.release_tag and disc.release_tag != existing.release_tag:
                        existing.release_tag = disc.release_tag
                        updated_fields.append('release_tag')
                    if disc.release_url and disc.release_url != existing.release_url:
                        existing.release_url = disc.release_url
                        updated_fields.append('release_url')
                    if disc.release_date and disc.release_date != existing.release_date:
                        existing.release_date = disc.release_date
                        updated_fields.append('release_date')
                    if disc.question and disc.question != existing.question:
                        existing.question = disc.question
                        updated_fields.append('question')
                    if disc.answer and disc.answer != existing.answer:
                        existing.answer = disc.answer
                        updated_fields.append('answer')
                    if disc.category and disc.category != existing.category:
                        existing.category = disc.category
                        updated_fields.append('category')
                    if disc.knowledge and disc.knowledge != existing.knowledge:
                        existing.knowledge = disc.knowledge
                        updated_fields.append('knowledge')
                    if disc.code and disc.code != existing.code:
                        existing.code = disc.code
                        updated_fields.append('code')
                    if discussion_batch_id and discussion_batch_id != existing.batch_id:
                        # Moving discussion to a different batch
                        old_batch_id = existing.batch_id
                        existing.batch_id = discussion_batch_id
                        updated_fields.append('batch_id')
                        
                        # Update batch counts
                        if old_batch_id:
                            batch_service.decrement_discussion_count(db, old_batch_id)
                        if discussion_batch_id:
                            batch_service.increment_discussion_count(db, discussion_batch_id)

                    if updated_fields:
                        db.add(existing)
                        discussions_added += 1
                        logger.info(f"Updated discussion {discussion_id}, fields: {updated_fields}")
                    else:
                        logger.info(f"No changes detected for discussion {discussion_id}")
                
                else:
                    # CREATE NEW DISCUSSION
                    new_discussion = models.Discussion(
                        id=discussion_id,
                        title=title,
                        url=disc.url,
                        repository=repository,
                        created_at=getattr(disc, 'created_at', None) or getattr(disc, 'createdAt', None),
                        repository_language=language,
                        release_tag=disc.release_tag,
                        release_url=disc.release_url,
                        release_date=disc.release_date,
                        batch_id=discussion_batch_id,
                        question=getattr(disc, 'question', None),
                        answer=getattr(disc, 'answer', None),
                        category=getattr(disc, 'category', None),
                        knowledge=getattr(disc, 'knowledge', None),
                        code=getattr(disc, 'code', None)
                    )
                    db.add(new_discussion)
                    db.flush()  # Flush to get the ID
                    
                    # Add task associations for new discussion
                    tasks = disc.tasks or {}
                    
                    for task_num in [1, 2, 3]:
                        task_key = f"task{task_num}"
                        db.execute(
                            models.discussion_task_association.insert().values(
                                discussion_id=new_discussion.id,
                                task_number=task_num,
                                status=tasks.get(task_key, {}).get("status", "locked"),
                                annotators=tasks.get(task_key, {}).get("annotators", 0)
                            )
                        )
                    
                    # Update batch discussion count if we have a batch
                    if discussion_batch_id:
                        from services import batch_service
                        batch_service.increment_discussion_count(db, discussion_batch_id)
                    
                    discussions_added += 1
                    logger.info(f"Added new discussion: {discussion_id}")
                
            except Exception as e:
                error_msg = f"Error processing discussion {getattr(disc, 'id', 'unknown')}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        db.commit()
        logger.info(f"Successfully processed {discussions_added} discussions")
        
        # Schedule background metadata fetching for discussions that need it
        try:
            discussions_for_metadata = []
            for disc in upload_data.discussions:
                discussion_id = disc.id
                if not discussion_id:
                    repository, _, _ = extract_repository_info_from_url(disc.url)
                    discussion_id = generate_discussion_id(repository, disc.url)
                
                # Check if discussion needs metadata fetching
                missing_fields = {}
                if not getattr(disc, 'repository_language', None) and not getattr(disc, 'lang', None):
                    missing_fields['repository_language'] = None
                if not getattr(disc, 'release_tag', None):
                    missing_fields['release_tag'] = None
                if not getattr(disc, 'release_url', None):
                    missing_fields['release_url'] = None
                if not getattr(disc, 'release_date', None):
                    missing_fields['release_date'] = None
                
                if missing_fields:
                    metadata_entry = {
                        'id': discussion_id,
                        'url': disc.url,
                        'created_at': getattr(disc, 'created_at', None) or getattr(disc, 'createdAt', None),
                        'missing_fields': missing_fields
                    }
                    discussions_for_metadata.append(metadata_entry)
            
            if discussions_for_metadata:
                logger.info(f"Scheduling background metadata fetch for {len(discussions_for_metadata)} discussions")
                schedule_metadata_fetch(discussions_for_metadata)
            else:
                logger.info("No discussions require metadata fetching")
                
        except Exception as meta_error:
            logger.error(f"Error scheduling metadata fetch: {str(meta_error)}")
            # Don't fail the upload if metadata scheduling fails
        
        return schemas.UploadResult(
            success=True,
            message=f"Successfully processed {discussions_added} discussions",
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
                # Include content fields
                "question": updated_discussion.question,
                "answer": updated_discussion.answer,
                "category": updated_discussion.category,
                "knowledge": updated_discussion.knowledge,
                "code": updated_discussion.code,
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


def update_task_status_enhanced(
    db: Session, 
    discussion_id: str, 
    task_id: int, 
    status: str,
    updated_by: str = "system"
) -> schemas.TaskManagementResult:
    """
    Enhanced task status update that supports the full annotation workflow
    """
    try:
        # Enhanced status definitions
        valid_statuses = [
            'locked',
            'unlocked', 
            'ready_for_consensus',
            'consensus_created',
            'completed',
            'rework',        # Single rework status
            'blocked'
                ]
        
        if status not in valid_statuses:
            raise Exception(f"Invalid status: {status}. Must be one of: {', '.join(valid_statuses)}")
        
        # Check if discussion exists
        discussion = db.query(models.Discussion).filter(
            models.Discussion.id == discussion_id
        ).first()
        if not discussion:
            raise Exception(f"Discussion {discussion_id} not found")
        
        # Get current status
        current_task = db.execute(
            models.discussion_task_association.select().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_id
                )
            )
        ).first()
        
        old_status = current_task.status if current_task else "none"
        
        # Update status in existing table
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
        
        # Create if doesn't exist
        if result.rowcount == 0:
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=task_id,
                    status=status,
                    annotators=0
                )
            )
        
        # Handle workflow progression based on new status
        auto_actions = []
        
        if status == 'completed' and task_id < 3:
            # Auto-unlock next task when current task is truly completed
            next_task_id = task_id + 1
            next_task_result = db.execute(
                models.discussion_task_association.update().where(
                    and_(
                        models.discussion_task_association.c.discussion_id == discussion_id,
                        models.discussion_task_association.c.task_number == next_task_id,
                        models.discussion_task_association.c.status == 'locked'
                    )
                ).values(
                    status='unlocked'
                )
            )
            
            if next_task_result.rowcount == 0:
                # Create next task if doesn't exist
                db.execute(
                    models.discussion_task_association.insert().values(
                        discussion_id=discussion_id,
                        task_number=next_task_id,
                        status='unlocked',
                        annotators=0
                    )
                )
            
            auto_actions.append(f"Auto-unlocked Task {next_task_id}")
        
        elif status == 'rework':
            # When flagged for rework, may need to reset downstream tasks
            if task_id < 3:
                # Check if downstream tasks should be locked again
                downstream_tasks = db.execute(
                    models.discussion_task_association.select().where(
                        and_(
                            models.discussion_task_association.c.discussion_id == discussion_id,
                            models.discussion_task_association.c.task_number > task_id
                        )
                    )
                ).fetchall()
                
                for downstream_task in downstream_tasks:
                    if downstream_task.status in ['unlocked', 'in_progress', 'ready_for_consensus']:
                        # Lock downstream tasks that haven't been completed yet
                        db.execute(
                            models.discussion_task_association.update().where(
                                and_(
                                    models.discussion_task_association.c.discussion_id == discussion_id,
                                    models.discussion_task_association.c.task_number == downstream_task.task_number
                                )
                            ).values(status='locked')
                        )
                        auto_actions.append(f"Auto-locked Task {downstream_task.task_number} (upstream rework)")
        
        db.commit()
        
        # Get updated discussion for response
        updated_discussion = get_discussion_by_id(db, discussion_id)
        
        logger.info(f"Task {task_id} status updated from '{old_status}' to '{status}' by {updated_by}")
        if auto_actions:
            logger.info(f"Auto-actions: {', '.join(auto_actions)}")
        
        return schemas.TaskManagementResult(
            success=True,
            message=f"Task {task_id} status updated to {status}" + 
                   (f". Auto-actions: {', '.join(auto_actions)}" if auto_actions else ""),
            discussion=updated_discussion
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating task status: {str(e)}")
        return schemas.TaskManagementResult(
            success=False,
            message=f"Failed to update task status: {str(e)}",
            discussion=None
        )

def get_workflow_status_summary(db: Session, discussion_id: str) -> Dict[str, Any]:
    """
    Get a comprehensive workflow status summary for a discussion
    """
    try:
        # Get all task associations
        task_associations = db.execute(
            models.discussion_task_association.select().where(
                models.discussion_task_association.c.discussion_id == discussion_id
            )
        ).fetchall()
        
        summary = {
            "discussion_id": discussion_id,
            "overall_status": "not_started",
            "tasks": {},
            "workflow_stage": "initial",
            "next_action": "Start Task 1 annotations",
            "blockers": []
        }
        
        for task_assoc in task_associations:
            task_num = task_assoc.task_number
            status = task_assoc.status
            annotators = task_assoc.annotators
            
            # Get consensus info
            consensus = db.query(models.ConsensusAnnotation).filter(
                models.ConsensusAnnotation.discussion_id == discussion_id,
                models.ConsensusAnnotation.task_id == task_num
            ).first()
            
            # Get required annotators
            required = 3 if task_num < 3 else 5
            
            summary["tasks"][f"task_{task_num}"] = {
                "status": status,
                "annotators": annotators,
                "required_annotators": required,
                "has_consensus": consensus is not None,
                "consensus_meets_criteria": False
            }
            
            if consensus:
                from services.consensus_service import _should_task_be_completed
                meets_criteria = _should_task_be_completed(db, discussion_id, task_num, consensus.data)
                summary["tasks"][f"task_{task_num}"]["consensus_meets_criteria"] = meets_criteria
            
            # Check for blockers
            if status in ['rework', 'flagged', 'blocked']:
                summary["blockers"].append(f"Task {task_num}: {status}")
        
        # Determine overall status and next action
        if all(summary["tasks"].get(f"task_{i}", {}).get("status") == "completed" for i in range(1, 4)):
            summary["overall_status"] = "completed"
            summary["workflow_stage"] = "complete"
            summary["next_action"] = "Discussion complete"
        elif any(summary["tasks"].get(f"task_{i}", {}).get("status") in ["rework", "flagged", "blocked"] for i in range(1, 4)):
            summary["overall_status"] = "blocked"
            summary["workflow_stage"] = "blocked"
            summary["next_action"] = "Resolve blockers"
        else:
            # Find the current working task
            for task_num in range(1, 4):
                task_key = f"task_{task_num}"
                task_info = summary["tasks"].get(task_key, {})
                task_status = task_info.get("status", "locked")
                
                if task_status == "ready_for_consensus":
                    summary["overall_status"] = "awaiting_consensus"
                    summary["workflow_stage"] = f"task_{task_num}_consensus"
                    summary["next_action"] = f"Create consensus for Task {task_num}"
                    break
                elif task_status in ["unlocked", "in_progress"]:
                    summary["overall_status"] = "in_progress"
                    summary["workflow_stage"] = f"task_{task_num}_annotations"
                    annotators = task_info.get("annotators", 0)
                    required = task_info.get("required_annotators", 3)
                    summary["next_action"] = f"Collect more annotations for Task {task_num} ({annotators}/{required})"
                    break
                elif task_status == "consensus_created":
                    summary["overall_status"] = "awaiting_review"
                    summary["workflow_stage"] = f"task_{task_num}_review"
                    summary["next_action"] = f"Review Task {task_num} consensus criteria"
                    break
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting workflow status: {str(e)}")
        return {"error": str(e)}