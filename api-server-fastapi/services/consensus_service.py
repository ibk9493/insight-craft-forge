
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
from datetime import datetime
from typing import List, Optional, Dict, Any

def get_consensus(db: Session, discussion_id: str, task_id: int) -> Optional[schemas.Annotation]:
    consensus = db.query(models.ConsensusAnnotation).filter(
        and_(
            models.ConsensusAnnotation.discussion_id == discussion_id,
            models.ConsensusAnnotation.task_id == task_id
        )
    ).first()
    
    if not consensus:
        return None
    
    return schemas.Annotation(
        discussion_id=consensus.discussion_id,
        user_id="consensus",
        task_id=consensus.task_id,
        data=consensus.data,
        timestamp=consensus.timestamp
    )

def create_or_update_consensus(db: Session, consensus_data: schemas.AnnotationCreate) -> schemas.Annotation:
    # Check if consensus already exists
    existing = db.query(models.ConsensusAnnotation).filter(
        and_(
            models.ConsensusAnnotation.discussion_id == consensus_data.discussion_id,
            models.ConsensusAnnotation.task_id == consensus_data.task_id
        )
    ).first()
    
    if existing:
        # Update existing consensus
        existing.data = consensus_data.data
        existing.timestamp = datetime.utcnow()
    else:
        # Create new consensus
        existing = models.ConsensusAnnotation(
            discussion_id=consensus_data.discussion_id,
            task_id=consensus_data.task_id,
            data=consensus_data.data
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id="consensus",  # Consensus records use "consensus" as user_id
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )

def calculate_consensus(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    # Get all annotations for this discussion and task
    annotations = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.task_id == task_id
        )
    ).all()
    
    # Simple implementation: just check if there are enough annotations
    if len(annotations) >= 3:
        return {"result": "Agreement", "agreement": True}
    else:
        return {"result": "Not enough annotations", "agreement": False}

def override_consensus(db: Session, override_data: schemas.ConsensusOverride) -> schemas.Annotation:
    # Check if consensus already exists
    existing = db.query(models.ConsensusAnnotation).filter(
        and_(
            models.ConsensusAnnotation.discussion_id == override_data.discussion_id,
            models.ConsensusAnnotation.task_id == override_data.task_id
        )
    ).first()
    
    timestamp = datetime.utcnow()
    
    if existing:
        # Update existing consensus
        existing.data = override_data.data
        existing.timestamp = timestamp
    else:
        # Create new consensus
        existing = models.ConsensusAnnotation(
            discussion_id=override_data.discussion_id,
            task_id=override_data.task_id,
            data=override_data.data,
            timestamp=timestamp
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id="override",
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )
