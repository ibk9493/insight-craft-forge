from sqlalchemy.orm import Session
from sqlalchemy import and_, exc
import models
import schemas
from datetime import datetime
from typing import List, Optional, Dict, Any
import logging
from contextlib import contextmanager

# Set up logging
logger = logging.getLogger(__name__)

class ConsensusNotFoundError(Exception):
    """Raised when a consensus annotation cannot be found."""
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

def validate_consensus_data(data: dict) -> None:
    """Validate consensus data structure."""
    if not isinstance(data, dict):
        raise ValidationError("Consensus data must be a dictionary")
    
    # Add more specific validation here as needed
    # For example, check for required fields, data types, etc.

def get_consensus(db: Session, discussion_id: str, task_id: int) -> Optional[schemas.Annotation]:
    """
    Get consensus annotation for a discussion task.
    Returns None if no consensus exists.
    """
    if not discussion_id:
        logger.warning("Empty discussion_id provided for consensus lookup")
        raise ValidationError("Discussion ID cannot be empty")
    
    if task_id is None:
        logger.warning("Empty task_id provided for consensus lookup")
        raise ValidationError("Task ID cannot be empty")
    
    try:
        consensus = db.query(models.ConsensusAnnotation).filter(
            and_(
                models.ConsensusAnnotation.discussion_id == discussion_id,
                models.ConsensusAnnotation.task_id == task_id
            )
        ).first()
        
        if not consensus:
            logger.info(f"No consensus found for discussion {discussion_id}, task {task_id}")
            return None
        
        logger.info(f"Retrieved consensus for discussion {discussion_id}, task {task_id}")
        return schemas.Annotation(
            discussion_id=consensus.discussion_id,
            user_id="consensus",
            task_id=consensus.task_id,
            data=consensus.data,
            timestamp=consensus.timestamp
        )
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_consensus: {str(e)}")
        raise DatabaseError(f"Failed to retrieve consensus: {str(e)}")

def _get_existing_consensus(
    db: Session, 
    discussion_id: str, 
    task_id: int
) -> Optional[models.ConsensusAnnotation]:
    """Helper function to retrieve an existing consensus annotation."""
    try:
        return db.query(models.ConsensusAnnotation).filter(
            and_(
                models.ConsensusAnnotation.discussion_id == discussion_id,
                models.ConsensusAnnotation.task_id == task_id
            )
        ).first()
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in _get_existing_consensus: {str(e)}")
        raise DatabaseError(f"Failed to retrieve existing consensus: {str(e)}")

def create_or_update_consensus(db: Session, consensus_data: schemas.AnnotationCreate) -> schemas.Annotation:
    """
    Create a new consensus annotation or update an existing one.
    """
    # Validate input
    if not consensus_data.discussion_id:
        logger.warning("Empty discussion_id provided for consensus creation")
        raise ValidationError("Discussion ID cannot be empty")
    
    if consensus_data.task_id is None:
        logger.warning("Empty task_id provided for consensus creation")
        raise ValidationError("Task ID cannot be empty")
    
    # Validate the data structure
    validate_consensus_data(consensus_data.data)
    
    try:
        with transaction_scope(db):
            # Check if consensus already exists
            existing = _get_existing_consensus(db, consensus_data.discussion_id, consensus_data.task_id)
            
            timestamp = datetime.utcnow()
            
            if existing:
                # Update existing consensus
                existing.data = consensus_data.data
                existing.timestamp = timestamp
                logger.info(f"Updated consensus for discussion {consensus_data.discussion_id}, "
                           f"task {consensus_data.task_id}")
            else:
                # Create new consensus
                existing = models.ConsensusAnnotation(
                    discussion_id=consensus_data.discussion_id,
                    task_id=consensus_data.task_id,
                    data=consensus_data.data,
                    timestamp=timestamp
                )
                db.add(existing)
                logger.info(f"Created new consensus for discussion {consensus_data.discussion_id}, "
                           f"task {consensus_data.task_id}")
            
            db.flush()
        
        # Refresh outside transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.Annotation(
            discussion_id=existing.discussion_id,
            user_id="consensus",  # Consensus records use "consensus" as user_id
            task_id=existing.task_id,
            data=existing.data,
            timestamp=existing.timestamp
        )
    except ValidationError:
        # Re-raise validation errors
        raise
    except DatabaseError:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_or_update_consensus: {str(e)}")
        raise

def calculate_consensus(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    Calculate consensus based on multiple annotations.
    This is a simple implementation that can be extended with more complex logic.
    """
    if not discussion_id:
        logger.warning("Empty discussion_id provided for consensus calculation")
        raise ValidationError("Discussion ID cannot be empty")
    
    if task_id is None:
        logger.warning("Empty task_id provided for consensus calculation")
        raise ValidationError("Task ID cannot be empty")
    
    try:
        # Get all annotations for this discussion and task
        annotations = db.query(models.Annotation).filter(
            and_(
                models.Annotation.discussion_id == discussion_id,
                models.Annotation.task_id == task_id
            )
        ).all()
        
        logger.info(f"Found {len(annotations)} annotations for discussion {discussion_id}, task {task_id}")
        
        # Simple implementation: just check if there are enough annotations
        # This could be extended with more sophisticated consensus algorithms
        min_annotations_required = 3  # This could be a configuration parameter
        
        result = {
            "annotation_count": len(annotations),
            "min_required": min_annotations_required
        }
        
        if len(annotations) >= min_annotations_required:
            result["result"] = "Agreement"
            result["agreement"] = True
            
            # Example of calculating agreement stats (simplified)
            # In a real implementation, this would analyze the actual annotation content
            annotator_values = {}
            for annotation in annotations:
                user_id = annotation.user_id
                # This is a placeholder - in reality you'd extract key values from the annotation data
                annotator_values[user_id] = annotation.data.get("value", None)
            
            result["annotator_values"] = annotator_values
        else:
            result["result"] = "Not enough annotations"
            result["agreement"] = False
        
        logger.info(f"Calculated consensus for discussion {discussion_id}, task {task_id}: {result['result']}")
        return result
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in calculate_consensus: {str(e)}")
        raise DatabaseError(f"Failed to calculate consensus: {str(e)}")

def override_consensus(db: Session, override_data: schemas.ConsensusOverride) -> schemas.Annotation:
    """
    Override consensus with admin-provided data.
    """
    # Validate input
    if not override_data.discussion_id:
        logger.warning("Empty discussion_id provided for consensus override")
        raise ValidationError("Discussion ID cannot be empty")
    
    if override_data.task_id is None:
        logger.warning("Empty task_id provided for consensus override")
        raise ValidationError("Task ID cannot be empty")
    
    # Validate the data structure
    validate_consensus_data(override_data.data)
    
    try:
        with transaction_scope(db):
            # Check if consensus already exists
            existing = _get_existing_consensus(db, override_data.discussion_id, override_data.task_id)
            
            timestamp = datetime.utcnow()
            
            # Add metadata about the override
            override_data_with_meta = override_data.data.copy()
            if "_metadata" not in override_data_with_meta:
                override_data_with_meta["_metadata"] = {}
            
            override_data_with_meta["_metadata"]["overridden"] = True
            override_data_with_meta["_metadata"]["override_time"] = timestamp.isoformat()
            
            if hasattr(override_data, 'override_reason') and override_data.override_reason:
                override_data_with_meta["_metadata"]["override_reason"] = override_data.override_reason
            
            if existing:
                # Update existing consensus
                existing.data = override_data_with_meta
                existing.timestamp = timestamp
                logger.info(f"Overrode existing consensus for discussion {override_data.discussion_id}, "
                           f"task {override_data.task_id}")
            else:
                # Create new consensus
                existing = models.ConsensusAnnotation(
                    discussion_id=override_data.discussion_id,
                    task_id=override_data.task_id,
                    data=override_data_with_meta,
                    timestamp=timestamp
                )
                db.add(existing)
                logger.info(f"Created new consensus via override for discussion {override_data.discussion_id}, "
                           f"task {override_data.task_id}")
            
            db.flush()
        
        # Refresh outside transaction to avoid holding locks
        db.refresh(existing)
        
        return schemas.Annotation(
            discussion_id=existing.discussion_id,
            user_id="override",  # Mark as an override
            task_id=existing.task_id,
            data=existing.data,
            timestamp=existing.timestamp
        )
    except ValidationError:
        # Re-raise validation errors
        raise
    except DatabaseError:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in override_consensus: {str(e)}")
        raise

def get_all_consensus_for_discussion(db: Session, discussion_id: str) -> List[schemas.Annotation]:
    """
    Get all consensus annotations for a discussion.
    """
    if not discussion_id:
        logger.warning("Empty discussion_id provided for consensus lookup")
        raise ValidationError("Discussion ID cannot be empty")
    
    try:
        consensus_annotations = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.discussion_id == discussion_id
        ).all()
        
        logger.info(f"Retrieved {len(consensus_annotations)} consensus annotations for discussion {discussion_id}")
        
        return [
            schemas.Annotation(
                discussion_id=consensus.discussion_id,
                user_id="consensus",
                task_id=consensus.task_id,
                data=consensus.data,
                timestamp=consensus.timestamp
            )
            for consensus in consensus_annotations
        ]
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_all_consensus_for_discussion: {str(e)}")
        raise DatabaseError(f"Failed to retrieve consensus annotations: {str(e)}")

def delete_consensus(db: Session, discussion_id: str, task_id: int) -> bool:
    """
    Delete a consensus annotation.
    Returns True if deleted, False if not found.
    """
    if not discussion_id:
        logger.warning("Empty discussion_id provided for consensus deletion")
        raise ValidationError("Discussion ID cannot be empty")
    
    if task_id is None:
        logger.warning("Empty task_id provided for consensus deletion")
        raise ValidationError("Task ID cannot be empty")
    
    try:
        with transaction_scope(db):
            result = db.query(models.ConsensusAnnotation).filter(
                and_(
                    models.ConsensusAnnotation.discussion_id == discussion_id,
                    models.ConsensusAnnotation.task_id == task_id
                )
            ).delete()
            
            if result > 0:
                logger.info(f"Deleted consensus for discussion {discussion_id}, task {task_id}")
                return True
            else:
                logger.info(f"No consensus found to delete for discussion {discussion_id}, task {task_id}")
                return False
    except DatabaseError:
        # Re-raise database errors
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_consensus: {str(e)}")
        raise