
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime

import models
import schemas
from services import discussions_service

def get_all_batches(db: Session) -> List[models.BatchUpload]:
    """
    Retrieve all batch uploads from the database
    """
    return db.query(models.BatchUpload).order_by(models.BatchUpload.created_at.desc()).all()

def get_batch_by_id(db: Session, batch_id: int) -> Optional[models.BatchUpload]:
    """
    Retrieve a batch upload by its ID
    """
    return db.query(models.BatchUpload).filter(models.BatchUpload.id == batch_id).first()

def create_batch(db: Session, batch: schemas.BatchUploadCreate) -> models.BatchUpload:
    """
    Create a new batch upload
    """
    db_batch = models.BatchUpload(**batch.dict())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch

def delete_batch(db: Session, batch_id: int) -> bool:
    """
    Delete a batch upload and its associated discussions
    """
    # First, find the batch
    db_batch = db.query(models.BatchUpload).filter(models.BatchUpload.id == batch_id).first()
    if not db_batch:
        return False
        
    try:
        # Find all discussions associated with this batch
        discussions = db.query(models.Discussion).filter(models.Discussion.batch_id == batch_id).all()
        
        # Delete all discussions first
        for discussion in discussions:
            # Delete related annotations
            db.query(models.Annotation).filter(models.Annotation.discussion_id == discussion.id).delete()
            # Delete related consensus annotations
            db.query(models.ConsensusAnnotation).filter(models.ConsensusAnnotation.discussion_id == discussion.id).delete()
            # Delete the discussion task associations
            db.execute(models.discussion_task_association.delete().where(
                models.discussion_task_association.c.discussion_id == discussion.id
            ))
            
        # Now delete the discussions
        db.query(models.Discussion).filter(models.Discussion.batch_id == batch_id).delete()
        
        # Finally, delete the batch
        db.delete(db_batch)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error deleting batch: {e}")
        return False

def get_batch_discussions(db: Session, batch_id: int) -> List[schemas.Discussion]:
    """
    Get all discussions associated with a batch
    """
    # Find discussions with this batch ID
    db_discussions = db.query(models.Discussion).filter(models.Discussion.batch_id == batch_id).all()
    
    # Convert to response models using the existing discussions_service
    discussions = []
    for db_discussion in db_discussions:
        discussion = discussions_service.map_discussion_to_response(db, db_discussion)
        discussions.append(discussion)
    
    return discussions

def update_batch(db: Session, batch_id: int, batch_data: schemas.BatchUploadCreate) -> Optional[models.BatchUpload]:
    """
    Update a batch's details
    """
    db_batch = db.query(models.BatchUpload).filter(models.BatchUpload.id == batch_id).first()
    if not db_batch:
        return None
    
    for key, value in batch_data.dict().items():
        setattr(db_batch, key, value)
    
    db.commit()
    db.refresh(db_batch)
    return db_batch
