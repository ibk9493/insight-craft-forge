
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas
from datetime import datetime
from typing import List, Optional, Union

def get_annotations(
    db: Session, 
    discussion_id: Optional[str] = None, 
    user_id: Optional[str] = None, 
    task_id: Optional[int] = None
) -> List[schemas.Annotation]:
    query = db.query(models.Annotation)
    
    if discussion_id:
        query = query.filter(models.Annotation.discussion_id == discussion_id)
        
    if user_id:
        query = query.filter(models.Annotation.user_id == user_id)
        
    if task_id:
        query = query.filter(models.Annotation.task_id == task_id)
    
    return [
        schemas.Annotation(
            discussion_id=annotation.discussion_id,
            user_id=annotation.user_id,
            task_id=annotation.task_id,
            data=annotation.data,
            timestamp=annotation.timestamp
        )
        for annotation in query.all()
    ]

def create_or_update_annotation(db: Session, annotation: schemas.AnnotationCreate) -> schemas.Annotation:
    # Check if this annotation already exists
    existing = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == annotation.discussion_id,
            models.Annotation.user_id == annotation.user_id,
            models.Annotation.task_id == annotation.task_id
        )
    ).first()
    
    if existing:
        # Update existing annotation
        existing.data = annotation.data
        existing.timestamp = datetime.utcnow()
    else:
        # Create new annotation
        existing = models.Annotation(
            discussion_id=annotation.discussion_id,
            user_id=annotation.user_id,
            task_id=annotation.task_id,
            data=annotation.data
        )
        db.add(existing)
        
        # Update discussion task annotators count
        task_assoc = db.query(models.discussion_task_association).filter(
            and_(
                models.discussion_task_association.c.discussion_id == annotation.discussion_id,
                models.discussion_task_association.c.task_number == annotation.task_id
            )
        ).first()
        
        if task_assoc:
            db.execute(
                models.discussion_task_association.update().where(
                    and_(
                        models.discussion_task_association.c.discussion_id == annotation.discussion_id,
                        models.discussion_task_association.c.task_number == annotation.task_id
                    )
                ).values(
                    annotators=task_assoc.annotators + 1
                )
            )
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )

def update_annotation(
    db: Session, 
    discussion_id: str, 
    user_id: str, 
    task_id: int, 
    annotation_update: schemas.AnnotationUpdate
) -> schemas.Annotation:
    existing = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.user_id == user_id,
            models.Annotation.task_id == task_id
        )
    ).first()
    
    if not existing:
        raise ValueError("Annotation not found")
    
    # Update the annotation
    existing.data = annotation_update.data
    existing.timestamp = datetime.utcnow()
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )

def override_annotation(db: Session, annotation: schemas.AnnotationOverride) -> schemas.Annotation:
    # Check if this annotation already exists
    existing = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == annotation.discussion_id,
            models.Annotation.user_id == annotation.user_id,
            models.Annotation.task_id == annotation.task_id
        )
    ).first()
    
    if existing:
        # Update existing annotation
        existing.data = annotation.data
        existing.timestamp = annotation.timestamp or datetime.utcnow()
    else:
        # Create new annotation
        existing = models.Annotation(
            discussion_id=annotation.discussion_id,
            user_id=annotation.user_id,
            task_id=annotation.task_id,
            data=annotation.data,
            timestamp=annotation.timestamp or datetime.utcnow()
        )
        db.add(existing)
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )

# New function to allow pod leads to overwrite annotations
def pod_lead_override_annotation(
    db: Session, 
    pod_lead_id: str,
    annotation_override: schemas.PodLeadAnnotationOverride
) -> schemas.Annotation:
    # First verify that the user doing the override is a pod lead
    # In a real app, this would check against actual user roles in the database
    
    # Find the annotation to override
    existing = db.query(models.Annotation).filter(
        and_(
            models.Annotation.discussion_id == annotation_override.discussion_id,
            models.Annotation.user_id == annotation_override.annotator_id,
            models.Annotation.task_id == annotation_override.task_id
        )
    ).first()
    
    if not existing:
        # Create new annotation if it doesn't exist
        existing = models.Annotation(
            discussion_id=annotation_override.discussion_id,
            user_id=annotation_override.annotator_id,
            task_id=annotation_override.task_id,
            data=annotation_override.data
        )
        db.add(existing)
    else:
        # Update existing annotation
        existing.data = annotation_override.data
        existing.timestamp = datetime.utcnow()
    
    # Add an audit trail entry showing this was overridden by a pod lead
    existing.data["_overridden_by"] = pod_lead_id
    existing.data["_overridden_at"] = datetime.utcnow().isoformat()
    
    db.commit()
    db.refresh(existing)
    
    return schemas.Annotation(
        discussion_id=existing.discussion_id,
        user_id=existing.user_id,
        task_id=existing.task_id,
        data=existing.data,
        timestamp=existing.timestamp
    )
