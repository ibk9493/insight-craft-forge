from sqlalchemy.orm import Session
from sqlalchemy import and_, exc
import models
import schemas
from datetime import datetime
from typing import List, Optional, Union
import logging
from contextlib import contextmanager

# Set up logging
logger = logging.getLogger(__name__)

class AnnotationNotFoundError(Exception):
    """Raised when an annotation cannot be found."""
    pass

class PermissionError(Exception):
    """Raised when a user doesn't have permission for an operation."""
    pass

class DatabaseError(Exception):
    """Raised when a database operation fails."""
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

def validate_annotation_data(data: dict) -> None:
    """Validate annotation data structure."""
    if not isinstance(data, dict):
        raise ValueError("Annotation data must be a dictionary")
    
    # Add more specific validation here as needed
    # For example, check for required fields, data types, etc.

def get_annotations(
    db: Session, 
    discussion_id: Optional[str] = None, 
    user_id: Optional[str] = None, 
    task_id: Optional[int] = None
) -> List[schemas.Annotation]:
    """Get annotations matching the provided filters."""
    try:
        query = db.query(models.Annotation)
        
        if discussion_id:
            query = query.filter(models.Annotation.discussion_id == discussion_id)
            
        if user_id:
            query = query.filter(models.Annotation.user_id == user_id)
            
        if task_id:
            query = query.filter(models.Annotation.task_id == task_id)
        
        annotations = query.all()
        logger.info(f"Retrieved {len(annotations)} annotations")
        
        result = []
        for annotation in annotations:
            try:
                # Add defensive coding to handle potential missing fields
                anno_obj = schemas.Annotation(
                    id=getattr(annotation, 'id', 0),  # Use a default if id is missing
                    discussion_id=annotation.discussion_id,
                    user_id=annotation.user_id,
                    task_id=annotation.task_id,
                    data=annotation.data or {},  # Provide default for data
                    timestamp=annotation.timestamp or datetime.utcnow()  # Default timestamp
                )
                result.append(anno_obj)
            except Exception as e:
                # Log the error but continue processing other annotations
                logger.error(f"Error processing annotation {annotation.id if hasattr(annotation, 'id') else 'unknown'}: {str(e)}")
                continue
        
        return result
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_annotations: {str(e)}")
        raise DatabaseError(f"Failed to retrieve annotations: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in get_annotations: {str(e)}")
        # Return empty list to avoid breaking the client
        return []
    
def create_annotation(db: Session, annotation: schemas.AnnotationCreate) -> schemas.Annotation:
    # Get the database model from the implementation
    db_annotation = create_or_update_annotation(db, annotation)
    
    # Make sure we return a proper Annotation schema object with ALL required fields
    return schemas.Annotation(
        id=db_annotation.id,  # This is the critical missing field
        discussion_id=db_annotation.discussion_id,
        user_id=db_annotation.user_id,
        task_id=db_annotation.task_id,
        data=db_annotation.data,
        timestamp=db_annotation.timestamp
    )

    
def _get_existing_annotation(
    db: Session, 
    discussion_id: str, 
    user_id: str, 
    task_id: int
) -> Optional[models.Annotation]:
    """Helper function to retrieve an existing annotation."""
    try:
        return db.query(models.Annotation).filter(
            and_(
                models.Annotation.discussion_id == discussion_id,
                models.Annotation.user_id == user_id,
                models.Annotation.task_id == task_id
            )
        ).first()
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in _get_existing_annotation: {str(e)}")
        raise DatabaseError(f"Failed to retrieve existing annotation: {str(e)}")

def _increment_task_annotators(
    db: Session, 
    discussion_id: str, 
    task_id: int
) -> None:
    """Helper function to increment the annotators count for a task."""
    try:
        task_assoc = db.query(models.discussion_task_association).filter(
            and_(
                models.discussion_task_association.c.discussion_id == discussion_id,
                models.discussion_task_association.c.task_number == task_id
            )
        ).first()
        
        if task_assoc:
            db.execute(
                models.discussion_task_association.update().where(
                    and_(
                        models.discussion_task_association.c.discussion_id == discussion_id,
                        models.discussion_task_association.c.task_number == task_id
                    )
                ).values(
                    annotators=task_assoc.annotators + 1
                )
            )
            logger.info(f"Incremented annotators count for discussion {discussion_id}, task {task_id}")
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in _increment_task_annotators: {str(e)}")
        raise DatabaseError(f"Failed to update task annotators count: {str(e)}")

def create_or_update_annotation(db: Session, annotation: schemas.AnnotationCreate) -> schemas.Annotation:
    """Create a new annotation or update an existing one."""
    # Validate the data structure
    validate_annotation_data(annotation.data)
    
    try:
        with transaction_scope(db):
            existing = _get_existing_annotation(
                db, annotation.discussion_id, annotation.user_id, annotation.task_id
            )
            
            if existing:
                # Update existing annotation
                existing.data = annotation.data
                existing.timestamp = datetime.utcnow()
                logger.info(f"Updated annotation for discussion {annotation.discussion_id}, "
                           f"user {annotation.user_id}, task {annotation.task_id}")
            else:
                # Create new annotation
                existing = models.Annotation(
                    discussion_id=annotation.discussion_id,
                    user_id=annotation.user_id,
                    task_id=annotation.task_id,
                    data=annotation.data,
                    timestamp=datetime.utcnow()
                )
                db.add(existing)
                logger.info(f"Created new annotation for discussion {annotation.discussion_id}, "
                           f"user {annotation.user_id}, task {annotation.task_id}")
                
                # Update discussion task annotators count
                _increment_task_annotators(db, annotation.discussion_id, annotation.task_id)
            
            db.flush()  # Ensure the model has been assigned an ID
        
        # Refresh outside the transaction to avoid holding locks
        db.refresh(existing)
        
        # Return a complete Annotation object with ID
        return schemas.Annotation(
            id=existing.id,  # Include the ID field
            discussion_id=existing.discussion_id,
            user_id=existing.user_id,
            task_id=existing.task_id,
            data=existing.data,
            timestamp=existing.timestamp
        )
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_or_update_annotation: {str(e)}")
        raise
    
def update_annotation(
    db: Session, 
    discussion_id: str, 
    user_id: str, 
    task_id: int, 
    annotation_update: schemas.AnnotationUpdate
) -> schemas.Annotation:
    """Update an existing annotation."""
    # Validate the data structure
    validate_annotation_data(annotation_update.data)
    
    try:
        with transaction_scope(db):
            existing = _get_existing_annotation(db, discussion_id, user_id, task_id)
            
            if not existing:
                logger.warning(f"Attempted to update non-existent annotation: "
                              f"discussion {discussion_id}, user {user_id}, task {task_id}")
                raise AnnotationNotFoundError(
                    f"Annotation not found for discussion {discussion_id}, "
                    f"user {user_id}, task {task_id}"
                )
            
            # Update the annotation
            existing.data = annotation_update.data
            existing.timestamp = datetime.utcnow()
            logger.info(f"Updated annotation for discussion {discussion_id}, "
                       f"user {user_id}, task {task_id}")
            
            db.flush()
        
        # Refresh outside the transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.Annotation(
                id=existing.id,  # Include the ID field
                discussion_id=existing.discussion_id,
                user_id=existing.user_id,
                task_id=existing.task_id,
                data=existing.data,
                timestamp=existing.timestamp
            )
    except AnnotationNotFoundError:
        # Re-raise not found errors
        raise
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_annotation: {str(e)}")
        raise

def override_annotation(db: Session, annotation: schemas.AnnotationOverride) -> schemas.Annotation:
    """Override an annotation with specific timestamp."""
    # Validate the data structure
    validate_annotation_data(annotation.data)
    
    try:
        with transaction_scope(db):
            existing = _get_existing_annotation(
                db, annotation.discussion_id, annotation.user_id, annotation.task_id
            )
            
            timestamp = annotation.timestamp or datetime.utcnow()
            
            if existing:
                # Update existing annotation
                existing.data = annotation.data
                existing.timestamp = timestamp
                logger.info(f"Overridden annotation for discussion {annotation.discussion_id}, "
                           f"user {annotation.user_id}, task {annotation.task_id}")
            else:
                # Create new annotation
                existing = models.Annotation(
                    discussion_id=annotation.discussion_id,
                    user_id=annotation.user_id,
                    task_id=annotation.task_id,
                    data=annotation.data,
                    timestamp=timestamp
                )
                db.add(existing)
                logger.info(f"Created new annotation via override for discussion {annotation.discussion_id}, "
                           f"user {annotation.user_id}, task {annotation.task_id}")
            
            db.flush()
        
        # Refresh outside the transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.Annotation(
        id=existing.id,  # Include the ID field
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in override_annotation: {str(e)}")
        raise

def is_pod_lead(db: Session, user_id: str) -> bool:
    """Check if a user is a pod lead."""
    try:
        # This would be replaced with actual role checking logic
        # Example: query a user_roles table or similar
        # For now, we'll just simulate this check
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return False
        return "pod_lead" in user.roles
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in is_pod_lead check: {str(e)}")
        raise DatabaseError(f"Failed to check user permissions: {str(e)}")

def pod_lead_override_annotation(
    db: Session, 
    pod_lead_id: str,
    annotation_override: schemas.PodLeadAnnotationOverride
) -> schemas.Annotation:
    """Allow pod leads to override annotations."""
    # Validate the data structure
    validate_annotation_data(annotation_override.data)
    
    try:
        # Verify the user is a pod lead
        if not is_pod_lead(db, pod_lead_id):
            logger.warning(f"User {pod_lead_id} attempted pod lead override without permission")
            raise PermissionError(f"User {pod_lead_id} does not have pod lead permissions")
        
        # Copy the data to avoid modifying the input
        override_data = annotation_override.data.copy()
        
        # Add audit trail metadata
        now = datetime.utcnow()
        metadata = {
            "_overridden_by": pod_lead_id,
            "_overridden_at": now.isoformat()
        }
        
        # Store metadata in a dedicated field rather than modifying the original data
        if "_metadata" not in override_data:
            override_data["_metadata"] = {}
        override_data["_metadata"].update(metadata)
        
        with transaction_scope(db):
            existing = _get_existing_annotation(
                db, 
                annotation_override.discussion_id, 
                annotation_override.annotator_id, 
                annotation_override.task_id
            )
            
            if not existing:
                # Create new annotation if it doesn't exist
                existing = models.Annotation(
                    discussion_id=annotation_override.discussion_id,
                    user_id=annotation_override.annotator_id,
                    task_id=annotation_override.task_id,
                    data=override_data,
                    timestamp=now
                )
                db.add(existing)
                logger.info(f"Pod lead {pod_lead_id} created new annotation for "
                           f"discussion {annotation_override.discussion_id}, "
                           f"user {annotation_override.annotator_id}, task {annotation_override.task_id}")
            else:
                # Update existing annotation
                existing.data = override_data
                existing.timestamp = now
                logger.info(f"Pod lead {pod_lead_id} overrode annotation for "
                           f"discussion {annotation_override.discussion_id}, "
                           f"user {annotation_override.annotator_id}, task {annotation_override.task_id}")
            
            db.flush()
        
        # Refresh outside the transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.Annotation(
        id=existing.id,  # Include the ID field
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )
    except PermissionError:
        # Re-raise permission errors
        raise
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in pod_lead_override_annotation: {str(e)}")
        raise