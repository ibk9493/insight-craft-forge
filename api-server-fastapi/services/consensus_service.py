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
    db_entry = db.query(models.ConsensusAnnotation).filter(
        and_(
            models.ConsensusAnnotation.discussion_id == consensus_data.discussion_id,
            models.ConsensusAnnotation.task_id == consensus_data.task_id
        )
    ).first()
    
    current_time = datetime.utcnow()
    iso_current_time = current_time.isoformat()

    if db_entry:
        # Update existing consensus
        updated_data = consensus_data.data.copy() # Work with a copy
        updated_data["_last_updated"] = iso_current_time
        
        db_entry.data = updated_data # Assign the new dictionary
        db_entry.timestamp = current_time
    else:
        # Create new consensus
        new_data = consensus_data.data.copy() if consensus_data.data is not None else {}
        new_data["_created"] = iso_current_time
        
        db_entry = models.ConsensusAnnotation(
            discussion_id=consensus_data.discussion_id,
            task_id=consensus_data.task_id,
            data=new_data,
            timestamp=current_time # Explicitly set timestamp
        )
        db.add(db_entry)
    
    try:
        db.commit()
        db.refresh(db_entry)
    except Exception as e:
        db.rollback()
        # Ideally, log the exception e here for server-side debugging
        print(f"Error during consensus commit/refresh: {str(e)}") # Basic print for now
        raise 

    return schemas.Annotation(
        id=db_entry.id,
        discussion_id=db_entry.discussion_id,
        user_id="consensus",  # Consensus records use "consensus" as user_id
        task_id=db_entry.task_id,
        data=db_entry.data,
        timestamp=db_entry.timestamp # This will be the refreshed timestamp
    )

def calculate_consensus(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    # Get all annotations for this discussion and task
    annotations = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.task_id == task_id
        )
    ).all()
    
    # Get task configuration
    required_annotators = 3 if task_id < 3 else 5  # Task 3 requires 5 annotators
    
    # If we have enough annotations, perform actual consensus calculation
    if len(annotations) >= required_annotators:
        # Simple majority voting for each field
        field_counts = {}
        
        # Count votes for each field value
        for annotation in annotations:
            for key, value in annotation.data.items():
                # Skip text fields and metadata fields
                if key.endswith('_text') or key.startswith('_'):
                    continue
                
                if key not in field_counts:
                    field_counts[key] = {}
                
                # Convert to string to make counting easier
                str_value = str(value)
                if str_value not in field_counts[key]:
                    field_counts[key][str_value] = 0
                    
                field_counts[key][str_value] += 1
        
        # Find majority for each field
        result = {}
        agreement = True
        
        for field, votes in field_counts.items():
            # Find value with most votes
            max_votes = 0
            max_value = None
            
            for value, count in votes.items():
                if count > max_votes:
                    max_votes = count
                    max_value = value
            
            # Check if we have a clear majority
            if max_votes > len(annotations) / 2:
                result[field] = "Agreement"
            else:
                result[field] = "No Agreement"
                agreement = False
        
        # Check for overall agreement
        overall = "Agreement" if agreement else "No Agreement"
        
        return {"result": overall, "agreement": agreement, "fields": result, "annotator_count": len(annotations)}
    else:
        return {
            "result": f"Not enough annotations ({len(annotations)}/{required_annotators})", 
            "agreement": False,
            "annotator_count": len(annotations),
            "required": required_annotators
        }

def override_consensus(db: Session, override_data: schemas.ConsensusOverride) -> schemas.Annotation:
    # Check if consensus already exists
    existing = db.query(models.ConsensusAnnotation).filter(
        and_(
            models.ConsensusAnnotation.discussion_id == override_data.discussion_id,
            models.ConsensusAnnotation.task_id == override_data.task_id
        )
    ).first()
    
    timestamp = datetime.utcnow()
    
    # Add metadata about the override
    override_data.data["_overridden"] = True
    override_data.data["_override_timestamp"] = timestamp.isoformat()
    
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
