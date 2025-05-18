from sqlalchemy.orm import Session, joinedload
from sqlalchemy import exc
from typing import List, Optional
from datetime import datetime
import logging
from contextlib import contextmanager

import models
import schemas
from services import discussions_service

# Set up logging
logger = logging.getLogger(__name__)

class BatchNotFoundError(Exception):
    """Raised when a batch cannot be found."""
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

def validate_batch_data(batch_data: schemas.BatchUploadCreate) -> None:
    """Validate batch data."""
    if not batch_data.name:
        raise ValueError("Batch name cannot be empty")
    
    # Add more validation rules as needed

def get_all_batches(db: Session) -> List[models.BatchUpload]:
    """
    Retrieve all batch uploads from the database ordered by creation date.
    """
    try:
        batches = db.query(models.BatchUpload).order_by(models.BatchUpload.created_at.desc()).all()
        logger.info(f"Retrieved {len(batches)} batches")
        return batches
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_all_batches: {str(e)}")
        raise DatabaseError(f"Failed to retrieve batches: {str(e)}")

def get_batch_by_id(db: Session, batch_id: int) -> models.BatchUpload:
    """
    Retrieve a batch upload by its ID.
    Raises BatchNotFoundError if the batch does not exist.
    """
    if not batch_id:
        logger.warning("Empty batch_id provided for batch lookup")
        raise ValueError("Batch ID cannot be empty")
    
    try:
        batch = db.query(models.BatchUpload).filter(models.BatchUpload.id == batch_id).first()
        
        if not batch:
            logger.warning(f"Batch with ID {batch_id} not found")
            raise BatchNotFoundError(f"Batch with ID {batch_id} not found")
        
        logger.info(f"Retrieved batch with ID {batch_id}")
        return batch
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_batch_by_id: {str(e)}")
        raise DatabaseError(f"Failed to retrieve batch: {str(e)}")

def create_batch(db: Session, batch: schemas.BatchUploadCreate) -> models.BatchUpload:
    """
    Create a new batch upload.
    """
    # Validate input data
    validate_batch_data(batch)
    
    try:
        with transaction_scope(db):
            # Create new batch instance
            db_batch = models.BatchUpload(**batch.dict())
            db.add(db_batch)
            db.flush()
            logger.info(f"Created new batch: {batch.name}")
        
        # Refresh outside transaction to avoid holding locks
        db.refresh(db_batch)
        return db_batch
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_batch: {str(e)}")
        raise

def update_batch(db: Session, batch_id: int, batch_data: schemas.BatchUploadCreate) -> models.BatchUpload:
    """
    Update a batch's details.
    Raises BatchNotFoundError if the batch does not exist.
    """
    # Validate input data
    validate_batch_data(batch_data)
    
    try:
        with transaction_scope(db):
            # Find the batch
            db_batch = db.query(models.BatchUpload).filter(models.BatchUpload.id == batch_id).first()
            
            if not db_batch:
                logger.warning(f"Attempted to update non-existent batch with ID {batch_id}")
                raise BatchNotFoundError(f"Batch with ID {batch_id} not found")
            
            # Update batch fields
            for key, value in batch_data.dict().items():
                setattr(db_batch, key, value)
            
            db.flush()
            logger.info(f"Updated batch with ID {batch_id}")
        
        # Refresh outside transaction to avoid holding locks
        db.refresh(db_batch)
        return db_batch
    except BatchNotFoundError:
        # Re-raise not found errors
        raise
    except ValueError as e:
        # Re-raise validation errors
        raise
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_batch: {str(e)}")
        raise

def delete_batch(db: Session, batch_id: int) -> bool:
    """
    Delete a batch upload and its associated discussions.
    Returns True if the batch was deleted, False if the batch was not found.
    """
    try:
        # First, find the batch
        try:
            db_batch = get_batch_by_id(db, batch_id)
        except BatchNotFoundError:
            logger.warning(f"Attempted to delete non-existent batch with ID {batch_id}")
            return False
        
        with transaction_scope(db):
            # Find all discussions associated with this batch
            discussions = db.query(models.Discussion).filter(models.Discussion.batch_id == batch_id).all()
            
            # Keep track of what we're deleting for logging
            discussion_count = len(discussions)
            annotation_count = 0
            consensus_count = 0
            task_assoc_count = 0
            
            # Delete all discussions and related data
            for discussion in discussions:
                # Delete related annotations
                annotation_result = db.query(models.Annotation).filter(
                    models.Annotation.discussion_id == discussion.id
                ).delete()
                annotation_count += annotation_result
                
                # Delete related consensus annotations
                consensus_result = db.query(models.ConsensusAnnotation).filter(
                    models.ConsensusAnnotation.discussion_id == discussion.id
                ).delete()
                consensus_count += consensus_result
                
                # Delete the discussion task associations
                task_result = db.execute(
                    models.discussion_task_association.delete().where(
                        models.discussion_task_association.c.discussion_id == discussion.id
                    )
                )
                task_assoc_count += task_result.rowcount
            
            # Now delete the discussions
            discussion_delete_result = db.query(models.Discussion).filter(
                models.Discussion.batch_id == batch_id
            ).delete()
            
            # Finally, delete the batch
            db.delete(db_batch)
            
            # Flush to catch any errors before committing
            db.flush()
            
            logger.info(
                f"Deleted batch {batch_id} with {discussion_count} discussions, "
                f"{annotation_count} annotations, {consensus_count} consensus annotations, "
                f"and {task_assoc_count} task associations"
            )
            
            return True
    except BatchNotFoundError:
        return False
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_batch: {str(e)}")
        raise

def get_batch_discussions(db: Session, batch_id: int) -> List[schemas.Discussion]:
    """
    Get all discussions associated with a batch.
    """
    try:
        # Verify batch exists
        try:
            get_batch_by_id(db, batch_id)
        except BatchNotFoundError:
            logger.warning(f"Attempted to get discussions for non-existent batch with ID {batch_id}")
            raise
        
        # Find discussions with this batch ID
        db_discussions = db.query(models.Discussion).filter(
            models.Discussion.batch_id == batch_id
        ).all()
        
        logger.info(f"Found {len(db_discussions)} discussions for batch {batch_id}")
        
        # Convert to response models using the existing discussions_service
        discussions = []
        for db_discussion in db_discussions:
            try:
                discussion = discussions_service.get_discussion_by_id(db, db_discussion.id)
                if discussion:
                    discussions.append(discussion)
            except Exception as e:
                logger.error(f"Error mapping discussion {db_discussion.id}: {str(e)}")
                # Continue processing other discussions even if one fails
                continue
        
        return discussions
    except BatchNotFoundError:
        # Re-raise not found errors
        raise
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_batch_discussions: {str(e)}")
        raise DatabaseError(f"Failed to retrieve batch discussions: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in get_batch_discussions: {str(e)}")
        raise

def get_batch_statistics(db: Session, batch_id: int) -> dict:
    """
    Get statistics about a batch, including:
    - Total number of discussions
    - Total annotations submitted
    - Total users who have contributed
    - Completion percentage
    """
    try:
        # Verify batch exists
        batch = get_batch_by_id(db, batch_id)
        
        # Get all discussions
        discussions = db.query(models.Discussion).filter(
            models.Discussion.batch_id == batch_id
        ).all()
        
        discussion_count = len(discussions)
        if discussion_count == 0:
            return {
                "discussion_count": 0,
                "annotation_count": 0,
                "unique_annotators": 0,
                "completion_percentage": 0
            }
        
        # Get annotation counts
        discussion_ids = [d.id for d in discussions]
        
        annotation_count = db.query(models.Annotation).filter(
            models.Annotation.discussion_id.in_(discussion_ids)
        ).count()
        
        # Get unique annotators
        unique_annotators = db.query(models.Annotation.user_id).filter(
            models.Annotation.discussion_id.in_(discussion_ids)
        ).distinct().count()
        
        # Calculate completion percentage (if applicable)
        # This depends on your specific requirements, so this is a placeholder
        completion_percentage = 0
        if discussion_count > 0:
            # Example: calculate based on tasks completed vs. total tasks
            total_tasks = sum(len(d.tasks) for d in discussions if hasattr(d, 'tasks'))
            if total_tasks > 0:
                completed_tasks = annotation_count
                completion_percentage = (completed_tasks / total_tasks) * 100
        
        statistics = {
            "discussion_count": discussion_count,
            "annotation_count": annotation_count,
            "unique_annotators": unique_annotators,
            "completion_percentage": round(completion_percentage, 2)
        }
        
        logger.info(f"Generated statistics for batch {batch_id}: {statistics}")
        return statistics
    except BatchNotFoundError:
        # Re-raise not found errors
        raise
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_batch_statistics: {str(e)}")
        raise DatabaseError(f"Failed to retrieve batch statistics: {str(e)}")