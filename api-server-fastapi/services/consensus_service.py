from sqlalchemy.orm import Session
from sqlalchemy import and_
import models  # Assuming models.py contains the updated ConsensusAnnotation model
import schemas  # Assuming schemas.py contains ConsensusAnnotationCreate and ConsensusAnnotationResponse
from datetime import datetime
from typing import List, Optional, Dict, Any


def get_consensus_annotation_by_ids(
        db: Session,
        discussion_id: str,
        task_id: int,
        annotator_id: str
) -> Optional[schemas.ConsensusAnnotationResponse]:
    """
    Retrieves a specific consensus annotation by discussion_id, task_id, and annotator_id.
    """
    db_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == discussion_id,
        models.ConsensusAnnotation.task_id == task_id,
        models.ConsensusAnnotation.annotator_id == annotator_id
    ).first()

    if not db_annotation:
        return None

    # Ensure data has _last_updated if it was added during creation/update
    # This might already be in db_annotation.data if saved correctly

    return schemas.ConsensusAnnotationResponse(
        id=db_annotation.id,
        discussion_id=db_annotation.discussion_id,
        user_id=db_annotation.user_id,  # User who saved it
        annotator_id=db_annotation.annotator_id,  # The annotator
        task_id=db_annotation.task_id,
        data=db_annotation.data,
        timestamp=db_annotation.timestamp
    )


def get_all_consensus_annotations_for_task(
        db: Session,
        discussion_id: str,
        task_id: int
) -> List[schemas.ConsensusAnnotationResponse]:
    """
    Retrieves all consensus annotations for a given discussion_id and task_id.
    """
    db_annotations = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == discussion_id,
        models.ConsensusAnnotation.task_id == task_id
    ).all()

    return [
        schemas.ConsensusAnnotationResponse(
            id=anno.id,
            discussion_id=anno.discussion_id,
            user_id=anno.user_id,
            annotator_id=anno.annotator_id,
            task_id=anno.task_id,
            data=anno.data,
            timestamp=anno.timestamp
        ) for anno in db_annotations
    ]


def create_or_update_consensus_annotation(
        db: Session,
        consensus_input: schemas.ConsensusAnnotationCreate,
        current_user_id: str
) -> schemas.ConsensusAnnotationResponse:
    """
    Creates a new consensus annotation or updates an existing one for a specific annotator.
    'current_user_id' is the ID of the user performing the save (from token).
    'consensus_input.annotator_id' is the ID of the annotator this data pertains to (from payload's user_id).
    """
    db_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == consensus_input.discussion_id,
        models.ConsensusAnnotation.task_id == consensus_input.task_id,
        models.ConsensusAnnotation.annotator_id == consensus_input.annotator_id  # Use annotator_id for lookup
    ).first()

    current_time = datetime.utcnow()
    iso_current_time = current_time.isoformat()

    # Prepare data from input schema, which should be ConsensusAnnotationData
    # The schema for consensus_input.data is schemas.ConsensusAnnotationData
    annotation_data_dict = consensus_input.data.model_dump()  # Pydantic v2

    if db_annotation:
        annotation_data_dict["_last_updated"] = iso_current_time

        db_annotation.data = annotation_data_dict
        db_annotation.timestamp = current_time
        db_annotation.user_id = current_user_id  # Update user who last modified it
    else:
        annotation_data_dict["_created"] = iso_current_time  # Or _last_updated, consistent
        annotation_data_dict["_last_updated"] = iso_current_time

        db_annotation = models.ConsensusAnnotation(
            discussion_id=consensus_input.discussion_id,
            task_id=consensus_input.task_id,
            annotator_id=consensus_input.annotator_id,  # Store annotator_id from input
            user_id=current_user_id,  # Store current user (saver)
            data=annotation_data_dict,
            timestamp=current_time
        )
        db.add(db_annotation)

    try:
        db.commit()
        db.refresh(db_annotation)
    except Exception as e:
        db.rollback()
        # Consider logging the exception 'e' properly
        raise e

    return schemas.ConsensusAnnotationResponse(
        id=db_annotation.id,
        discussion_id=db_annotation.discussion_id,
        user_id=db_annotation.user_id,  # User who saved
        annotator_id=db_annotation.annotator_id,  # The annotator
        task_id=db_annotation.task_id,
        data=db_annotation.data,
        timestamp=db_annotation.timestamp
    )


def calculate_consensus(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    # This function uses models.Annotation, not models.ConsensusAnnotation.
    # It appears to be for a different purpose (calculating overall consensus from individual annotations).
    # No changes made here based on the current request for ConsensusAnnotation handling.
    annotations = db.query(models.Annotation).filter(
        models.Annotation.discussion_id == discussion_id,
        models.Annotation.task_id == task_id
    ).all()

    required_annotators = 3 if task_id < 3 else 5

    if len(annotations) >= required_annotators:
        field_counts = {}
        for annotation in annotations:
            for key, value in annotation.data.items():
                if key.endswith('_text') or key.startswith('_'):
                    continue
                if key not in field_counts:
                    field_counts[key] = {}
                str_value = str(value)
                if str_value not in field_counts[key]:
                    field_counts[key][str_value] = 0
                field_counts[key][str_value] += 1

        result = {}
        agreement = True
        for field, votes in field_counts.items():
            max_votes = 0
            max_value = None
            for value, count in votes.items():
                if count > max_votes:
                    max_votes = count
                    max_value = value
            if max_votes > len(annotations) / 2:
                result[field] = "Agreement"
            else:
                result[field] = "No Agreement"
                agreement = False
        overall = "Agreement" if agreement else "No Agreement"
        return {"result": overall, "agreement": agreement, "fields": result, "annotator_count": len(annotations)}
    else:
        return {
            "result": f"Not enough annotations ({len(annotations)}/{required_annotators})",
            "agreement": False,
            "annotator_count": len(annotations),
            "required": required_annotators
        }


def override_consensus_annotation(
        db: Session,
        override_input: schemas.ConsensusOverride,  # Assuming ConsensusOverride schema is updated
        current_user_id: str  # ID of the admin/user performing the override
) -> schemas.ConsensusAnnotationResponse:
    """
    Overrides or creates a consensus annotation.
    Requires 'annotator_id' in 'override_input' to specify whose annotation is being set/overridden,
    or a special value for a master consensus.
    'current_user_id' is the user performing the override.
    """
    # Assumption: schemas.ConsensusOverride now includes an 'annotator_id' field.
    # If not, this function will need a default or another way to get annotator_id.
    # For this example, let's assume override_input has an annotator_id.
    # If override_input.annotator_id is not available, this will raise an AttributeError.
    # You might need to adjust schemas.ConsensusOverride to include:
    # annotator_id: str = "master_consensus" # or some other logic

    annotator_id_for_override = getattr(override_input, 'annotator_id', 'master_override')  # Default if not in schema

    existing_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == override_input.discussion_id,
        models.ConsensusAnnotation.task_id == override_input.task_id,
        models.ConsensusAnnotation.annotator_id == annotator_id_for_override
    ).first()

    current_time = datetime.utcnow()
    iso_current_time = current_time.isoformat()

    # Prepare data, ensuring it's a dictionary
    # override_input.data should be Dict[str, Any] or a Pydantic model like ConsensusAnnotationData
    if isinstance(override_input.data, BaseModel):  # Check if it's a Pydantic model
        data_to_save = override_input.data.model_dump()
    else:  # Assume it's already a dict
        data_to_save = override_input.data.copy() if override_input.data else {}

    data_to_save["_overridden_by_user"] = current_user_id
    data_to_save["_override_timestamp"] = iso_current_time
    data_to_save["_last_updated"] = iso_current_time

    if existing_annotation:
        existing_annotation.data = data_to_save
        existing_annotation.timestamp = current_time
        existing_annotation.user_id = current_user_id  # User performing the override
        # existing_annotation.annotator_id remains annotator_id_for_override
    else:
        data_to_save["_created"] = iso_current_time
        existing_annotation = models.ConsensusAnnotation(
            discussion_id=override_input.discussion_id,
            task_id=override_input.task_id,
            annotator_id=annotator_id_for_override,
            user_id=current_user_id,  # User performing the override
            data=data_to_save,
            timestamp=current_time
        )
        db.add(existing_annotation)

    try:
        db.commit()
        db.refresh(existing_annotation)
    except Exception as e:
        db.rollback()
        raise e

    return schemas.ConsensusAnnotationResponse(
        id=existing_annotation.id,
        discussion_id=existing_annotation.discussion_id,
        user_id=existing_annotation.user_id,
        annotator_id=existing_annotation.annotator_id,
        task_id=existing_annotation.task_id,
        data=existing_annotation.data,
        timestamp=existing_annotation.timestamp
    )

