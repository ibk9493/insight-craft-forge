import logging
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models  # Assuming models.py contains the updated ConsensusAnnotation model
import schemas  # Assuming schemas.py contains ConsensusAnnotationCreate and ConsensusAnnotationResponse
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from collections import Counter
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)
TASK_FIELDS = {
    1: ['relevance', 'learning', 'clarity'],
    2: ['aspects', 'explanation', 'execution'], 
    3: ['classify', 'short_answer_list', 'longAnswer_text', 'supporting_docs_available']
}

BOOLEAN_FIELDS = {'relevance', 'learning', 'clarity', 'aspects', 'explanation', 'supporting_docs_available'}

def _determine_manual_consensus_phase(annotations_count: int, required: int, consensus, agreement_analysis) -> str:
    """
    Determine consensus phase for manual-only workflow
    """
    if annotations_count < required:
        return "collecting_annotations"
    
    if not consensus:
        return "ready_for_manual_consensus"  # Always manual
    
    return "consensus_created"

def auto_create_consensus_if_ready(db: Session, discussion_id: str, task_id: int) -> Optional[schemas.ConsensusAnnotationResponse]:
    """
    Auto-create consensus if enough annotations exist and agreement is sufficient.
    DISABLED: Returns existing consensus only, no auto-creation.
    """
    try:
        # Only check if consensus already exists, don't create new ones
        existing_consensus = get_consensus_annotation_by_discussion_and_task(db, discussion_id, task_id)
        if existing_consensus:
            return existing_consensus
        
        # REMOVED: Auto-creation logic
        logger.info(f"Auto-consensus creation disabled for {discussion_id}/task{task_id}")
        return None
        
    except Exception as e:
        logger.error(f"Error checking existing consensus: {str(e)}")
        return None

def handle_task3_retroactive_updates(db: Session, discussion_id: str, task3_consensus_data: Dict[str, Any]) -> bool:
    """
    Handle retroactive updates when Task 3 indicates supporting docs are not available.
    Returns True if retroactive update was performed.
    """
    try:
        supporting_docs_available = task3_consensus_data.get('supporting_docs_available', True)
        
        if supporting_docs_available:
            # No retroactive update needed
            return False
        
        logger.info(f"Task 3 indicates no supporting docs for {discussion_id}, performing retroactive update")
        
        # Get current Task 2 consensus
        task2_consensus = get_consensus_annotation_by_discussion_and_task(db, discussion_id, 2)
        
        if not task2_consensus:
            logger.warning(f"No Task 2 consensus found for retroactive update: {discussion_id}")
            return False
        
        # Create updated Task 2 consensus data
        updated_task2_data = task2_consensus.data.copy()
        original_explanation = updated_task2_data.get('explanation')
        
        # Update explanation to False
        updated_task2_data['explanation'] = False
        
        # Add retroactive update metadata
        updated_task2_data['_retroactively_updated_by_task3'] = True
        updated_task2_data['_retroactive_update_timestamp'] = datetime.utcnow().isoformat()
        updated_task2_data['_original_explanation_value'] = original_explanation
        
        # Update the Task 2 consensus
        task2_consensus.data = updated_task2_data
        task2_consensus.timestamp = datetime.utcnow()
        db.commit()
        
        logger.info(f"Retroactively updated Task 2 consensus for {discussion_id}")
        
        # Re-evaluate Task 2 quality criteria
        task2_passes = validate_consensus_criteria(updated_task2_data, 2)
        
        if not task2_passes:
            # Task 2 now fails criteria due to retroactive update
            from services import discussions_service
            discussions_service.update_task_status_enhanced(
                db, discussion_id, 2, "quality_failed", "retroactive_update_system"
            )
            logger.info(f"Task 2 marked as quality_failed due to retroactive update: {discussion_id}")
        
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error handling retroactive updates: {str(e)}")
        raise Exception(f"Retroactive update failed: {str(e)}")

def validate_consensus_criteria(consensus_data: Dict[str, Any], task_id: int) -> bool:
    """
    Validate if consensus meets quality criteria for task progression.
    """
    try:
        if task_id == 1:
            # Task 1: All 3 fields must be True
            required_fields = ['relevance', 'learning', 'clarity']
            return all(consensus_data.get(field, False) for field in required_fields)
        
        elif task_id == 2:
            # Task 2: aspects and explanation must be True, execution must be "Executable" if not "N/A"
            aspects = consensus_data.get('aspects', False)
            explanation = consensus_data.get('explanation', False)
            execution = consensus_data.get('execution')
            
            base_criteria = aspects and explanation
            
            if execution and execution != "N/A":
                return base_criteria and execution == "Executable"
            
            return base_criteria
        
        elif task_id == 3:
            # Task 3: supporting_docs_available must be True
            return True # consensus_data.get('supporting_docs_available', False)
        
        return False
        
    except Exception as e:
        logger.error(f"Error validating consensus criteria: {str(e)}")
        return False

def _calculate_field_consensus(annotations: List[models.Annotation], field: str) -> Any:
    """
    Calculate consensus for a single field using majority voting.
    """
    field_values = []
    
    for annotation in annotations:
        if field in annotation.data and annotation.data[field] is not None:
            field_values.append(annotation.data[field])
    
    if not field_values:
        return None
    
    if field in BOOLEAN_FIELDS:
        # Boolean field: majority of True/False
        true_count = sum(1 for val in field_values if val)
        false_count = len(field_values) - true_count
        return true_count > false_count
    else:
        # Non-boolean field: most common value
        value_counts = Counter(field_values)
        most_common_value, most_common_count = value_counts.most_common(1)[0]
        return most_common_value

def create_field_by_field_consensus(db: Session, discussion_id: str, task_id: int) -> Optional[Dict[str, Any]]:
    """
    Create consensus using field-by-field majority voting.
    Returns consensus data or None if insufficient annotations.
    """
    try:
        # Get all annotations for this task
        annotations = db.query(models.Annotation).filter(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.task_id == task_id
        ).all()
        
        required_annotators = 5 if task_id == 3 else 3
        
        if len(annotations) < required_annotators:
            logger.warning(f"Insufficient annotations for consensus: {len(annotations)}/{required_annotators}")
            return None
        
        consensus_data = {}
        fields = TASK_FIELDS.get(task_id, [])
        
        for field in fields:
            field_consensus = _calculate_field_consensus(annotations, field)
            if field_consensus is not None:
                consensus_data[field] = field_consensus
        
        # Add consensus metadata
        consensus_data["_consensus_method"] = "field_majority"
        consensus_data["_total_annotators"] = len(annotations)
        consensus_data["_created_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Created field consensus for {discussion_id}/task{task_id}: {consensus_data}")
        return consensus_data
        
    except Exception as e:
        logger.error(f"Error creating field consensus: {str(e)}")
        return None

def get_consensus_annotation_by_discussion_and_task(
        db: Session,
        discussion_id: str,
        task_id: int
) -> Optional[schemas.ConsensusAnnotationResponse]:
    """
    Retrieves a consensus annotation by discussion_id and task_id.
    Since ConsensusAnnotation is unique on (discussion_id, task_id), this returns the single consensus.
    """
    db_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == discussion_id,
        models.ConsensusAnnotation.task_id == task_id
    ).first()

    if not db_annotation:
        return None

    return schemas.ConsensusAnnotationResponse(
        id=db_annotation.id,
        discussion_id=db_annotation.discussion_id,
        user_id=db_annotation.user_id,  # User who saved it
        annotator_id=db_annotation.annotator_id,  # The annotator
        task_id=db_annotation.task_id,
        data=db_annotation.data,
        timestamp=db_annotation.timestamp
    )

def get_consensus_annotation_by_ids(
        db: Session,
        discussion_id: str,
        task_id: int,
        annotator_id: str
) -> Optional[schemas.ConsensusAnnotationResponse]:
    """
    Retrieves a specific consensus annotation by discussion_id, task_id, and annotator_id.
    Note: Given the unique constraint on (discussion_id, task_id), this will return the same
    result as get_consensus_annotation_by_discussion_and_task if a record exists.
    """
    db_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == discussion_id,
        models.ConsensusAnnotation.task_id == task_id,
        models.ConsensusAnnotation.annotator_id == annotator_id
    ).first()

    if not db_annotation:
        return None

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
    Given the unique constraint, this will return at most one record.
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
    Creates a new consensus annotation or updates an existing one.
    'current_user_id' is the ID of the user performing the save (from token).
    'consensus_input.annotator_id' is the ID of the annotator this data pertains to (from payload's user_id).

    Since ConsensusAnnotation has unique constraint on (discussion_id, task_id),
    there can only be one consensus per discussion-task combination.
    """
    db_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == consensus_input.discussion_id,
        models.ConsensusAnnotation.task_id == consensus_input.task_id
    ).first()
    current_time = datetime.utcnow()
    iso_current_time = current_time.isoformat()

    # Prepare data from input schema
    # Check if data is already a dict or if it's a Pydantic model
    if isinstance(consensus_input.data, dict):
        annotation_data_dict = consensus_input.data.copy()  # Make a copy of the dict
    else:
        annotation_data_dict = consensus_input.data.model_dump()  # For Pydantic models

    if db_annotation:
        # Update existing annotation
        annotation_data_dict["_last_updated"] = iso_current_time

        db_annotation.data = annotation_data_dict
        db_annotation.timestamp = current_time
        db_annotation.user_id = current_user_id  # Update user who last modified it
        db_annotation.annotator_id = consensus_input.annotator_id  # Update annotator_id
    else:
        # Create new annotation
        annotation_data_dict["_created"] = iso_current_time
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
        _update_task_statuses_after_consensus(
            db, 
            consensus_input.discussion_id, 
            consensus_input.task_id, 
            annotation_data_dict  # Pass the consensus data for validation
        )
    except Exception as e:
        db.rollback()
        raise e

    return schemas.ConsensusAnnotationResponse(
        id=db_annotation.id,
        discussion_id=db_annotation.discussion_id,
        user_id=db_annotation.user_id,  # User who saved
        annotator_id=db_annotation.annotator_id,  # The annotator this consensus pertains to
        task_id=db_annotation.task_id,
        data=db_annotation.data,
        timestamp=db_annotation.timestamp
    )

def _should_task_be_completed(db: Session, discussion_id: str, task_id: int, consensus_data: dict) -> bool:
    """
    ENHANCED version using quality gate criteria.
    """
    return validate_consensus_criteria(consensus_data, task_id)

def _update_task_statuses_after_consensus(db: Session, discussion_id: str, completed_task_id: int, consensus_data: dict):
    """
    Handle task status updates after MANUAL consensus creation only.
    """
    try:
        logger.info(f"Processing manual consensus for {discussion_id}/task{completed_task_id}")
        
        # Import here to avoid circular imports
        from services import discussions_service
        
        # Step 1: Mark current task as consensus_created
        discussions_service.update_task_status_enhanced(
            db, discussion_id, completed_task_id, "consensus_created", "manual_consensus_system"
        )
        
        # Step 2: Handle Task 3 retroactive logic (keep this as it's important business logic)
        retroactive_update_performed = False
        if completed_task_id == 3:
            retroactive_update_performed = handle_task3_retroactive_updates(
                db, discussion_id, consensus_data
            )
        
        # Step 3: Validate quality criteria for current task
        passes_criteria = validate_consensus_criteria(consensus_data, completed_task_id)
        
        if passes_criteria:
            # Quality criteria met - mark as completed
            discussions_service.update_task_status_enhanced(
                db, discussion_id, completed_task_id, "completed", "manual_consensus_system"
            )
            
            # REMOVED: Automatic unlocking of next task
            # Next tasks must be manually unlocked by administrators
            logger.info(f"Task {completed_task_id} completed for {discussion_id} - next task requires manual unlock")
        else:
            # Quality criteria not met - mark as quality_failed
            discussions_service.update_task_status_enhanced(
                db, discussion_id, completed_task_id, "quality_failed", "manual_consensus_system"
            )
            
            # Block all downstream tasks
            for next_task_id in range(completed_task_id + 1, 4):
                discussions_service.update_task_status_enhanced(
                    db, discussion_id, next_task_id, "blocked", "manual_consensus_system"
                )
            
            logger.info(f"Task {completed_task_id} failed quality criteria, blocked downstream tasks")
        
        # Step 4: Handle special messaging
        if retroactive_update_performed:
            logger.info(f"Retroactive update completed for {discussion_id}")
        
    except Exception as e:
        logger.error(f"Error updating task statuses after manual consensus: {str(e)}")
        raise

def _check_all_tasks_have_consensus(db: Session, discussion_id: str) -> bool:
    """
    Check if all three tasks (1, 2, 3) have consensus annotations created.
    """
    try:
        for task_id in [1, 2, 3]:
            consensus = db.query(models.ConsensusAnnotation).filter(
                models.ConsensusAnnotation.discussion_id == discussion_id,
                models.ConsensusAnnotation.task_id == task_id
            ).first()
            
            if not consensus:
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error checking consensus status for all tasks: {str(e)}")
        return False

def _get_task_completion_status(consensus_data: dict, task_id: int) -> dict:
    """
    Get a detailed breakdown of task completion status for debugging/UI display.
    
    Returns:
    - Dict with completion status and details about which criteria are met/not met
    """
    
    if task_id == 1:
        relevance = consensus_data.get('relevance', False)
        learning_value = consensus_data.get('learning', False) 
        clarity = consensus_data.get('clarity', False)
        image_grounded = consensus_data.get('grounded', True)
        
        criteria = {
            'relevance': relevance,
            'learning_value': learning_value, 
            'clarity': clarity,
            'image_grounded': image_grounded if consensus_data.get('grounded') not in [None, 'N/A'] else True
        }
        
        all_met = all(criteria.values())
        
        return {
            'task_id': task_id,
            'can_complete': all_met,
            'criteria': criteria,
            'missing_criteria': [k for k, v in criteria.items() if not v],
            'message': "All quality criteria met" if all_met else f"Missing: {', '.join([k for k, v in criteria.items() if not v])}"
        }
    
    elif task_id == 2:
        address_all_aspects = consensus_data.get('aspects', False)
        with_explanation = consensus_data.get('explanation', False)
        code_execution = consensus_data.get('execution')
        
        criteria = {
            'address_all_aspects': address_all_aspects,
            'with_explanation': with_explanation,
        }
        
        if code_execution is not None:
            criteria['code_executable'] = code_execution in ['Executable', 'N/A']
        
        all_met = all(criteria.values())
        
        return {
            'task_id': task_id,
            'can_complete': all_met,
            'criteria': criteria,
            'missing_criteria': [k for k, v in criteria.items() if not v],
            'message': "All answer quality criteria met" if all_met else f"Missing: {', '.join([k for k, v in criteria.items() if not v])}"
        }
    
    elif task_id == 3:
        return {
            'task_id': task_id,
            'can_complete': True,
            'criteria': {'rewrite_complete': True},
            'missing_criteria': [],
            'message': "Rewrite task - automatically completable"
        }

def calculate_consensus(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    This function calculates overall consensus from individual annotations for analysis purposes.
    Note: This is different from creating ConsensusAnnotation records.
    """
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
        override_input: schemas.ConsensusOverride,
        current_user_id: str
) -> schemas.ConsensusAnnotationResponse:
    """
    Overrides or creates a consensus annotation.
    'current_user_id' is the user performing the override.
    """
    # Get annotator_id from override_input if available, otherwise use a default
    annotator_id_for_override = getattr(override_input, 'annotator_id', 'master_override')

    existing_annotation = db.query(models.ConsensusAnnotation).filter(
        models.ConsensusAnnotation.discussion_id == override_input.discussion_id,
        models.ConsensusAnnotation.task_id == override_input.task_id
    ).first()

    current_time = datetime.utcnow()
    iso_current_time = current_time.isoformat()

    # Prepare data
    if isinstance(override_input.data, BaseModel):
        data_to_save = override_input.data.model_dump()
    else:
        data_to_save = override_input.data.copy() if override_input.data else {}

    data_to_save["_overridden_by_user"] = current_user_id
    data_to_save["_override_timestamp"] = iso_current_time
    data_to_save["_last_updated"] = iso_current_time

    if existing_annotation:
        existing_annotation.data = data_to_save
        existing_annotation.timestamp = current_time
        existing_annotation.user_id = current_user_id
        existing_annotation.annotator_id = annotator_id_for_override
    else:
        data_to_save["_created"] = iso_current_time
        existing_annotation = models.ConsensusAnnotation(
            discussion_id=override_input.discussion_id,
            task_id=override_input.task_id,
            annotator_id=annotator_id_for_override,
            user_id=current_user_id,
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

# Legacy function for backward compatibility
def override_consensus(db: Session, override_data: schemas.ConsensusOverride) -> schemas.Annotation:
    """
    Legacy function - kept for backward compatibility with existing endpoint.
    This should probably be updated to use the new ConsensusAnnotation model.
    """
    # This function appears to work with the old Annotation model for consensus
    # You may want to update this to use ConsensusAnnotation instead
    pass

def get_consensus_status(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    Modified to reflect manual-only consensus workflow.
    """
    try:
        annotations = db.query(models.Annotation).filter(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.task_id == task_id
        ).all()

        consensus = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.discussion_id == discussion_id,
            models.ConsensusAnnotation.task_id == task_id
        ).first()

        required_annotators = 3 if task_id < 3 else 5

        agreement_analysis = None
        if len(annotations) >= 2:
            agreement_analysis = _calculate_annotation_agreement(annotations, task_id)

        # Use manual phase determination for consistent workflow
        consensus_phase = _determine_manual_consensus_phase(
            len(annotations), 
            required_annotators, 
            consensus, 
            agreement_analysis
        )

        completion_status = _get_task_completion_status(consensus.data, task_id) if consensus else None

        return {
            "discussion_id": discussion_id,
            "task_id": task_id,
            "annotations_count": len(annotations),
            "required_annotators": required_annotators,
            "has_consensus": bool(consensus),
            "consensus_phase": consensus_phase,
            "agreement_analysis": agreement_analysis,
            "completion_status": completion_status,
            "consensus_created_by": consensus.user_id if consensus else None,
            "consensus_created_at": consensus.timestamp.isoformat() if consensus else None,
            "recommended_action": _get_manual_recommended_action(consensus_phase, completion_status),
            "workflow_mode": "manual_only"  # Flag to indicate manual workflow
        }

    except Exception as e:
        logger.exception("Error getting consensus status")
        return {"error": str(e)}

def _get_manual_recommended_action(consensus_phase: str, completion_status: Dict = None) -> str:
    """
    Get recommended action for manual workflow
    """
    if consensus_phase == "collecting_annotations":
        return "Collect more annotations"
    elif consensus_phase == "ready_for_manual_consensus":
        return "Administrator should manually create consensus"
    elif consensus_phase == "consensus_created":
        if completion_status and completion_status.get("can_complete", False):
            return "Administrator can mark task as completed"
        else:
            return "Review consensus criteria with administrator"
    else:
        return "Administrator review required"

def get_discussions_ready_for_manual_consensus(db: Session, task_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get discussions that have enough annotations and are ready for manual consensus creation
    """
    try:
        ready_discussions = []
        
        discussions = db.query(models.Discussion).all()
        
        for discussion in discussions:
            for check_task_id in ([task_id] if task_id else [1, 2, 3]):
                consensus_status = get_consensus_status(db, discussion.id, check_task_id)
                
                if consensus_status.get("consensus_phase") == "ready_for_manual_consensus":
                    agreement_rate = consensus_status.get("agreement_analysis", {}).get("overall_agreement_rate", 0)
                    
                    ready_discussions.append({
                        "discussion_id": discussion.id,
                        "discussion_title": discussion.title,
                        "task_id": check_task_id,
                        "task_name": f"Task {check_task_id}",
                        "annotations_count": consensus_status.get("annotations_count"),
                        "agreement_rate": agreement_rate,
                        "priority": "high" if agreement_rate >= 80 else "medium" if agreement_rate >= 60 else "low",
                        "suggested_consensus": _build_recommended_consensus(
                            consensus_status.get("agreement_analysis", {})
                        )
                    })
        
        # Sort by agreement rate and priority
        ready_discussions.sort(key=lambda x: (x["agreement_rate"], x["annotations_count"]), reverse=True)
        
        return ready_discussions
        
    except Exception as e:
        logger.error(f"Error getting discussions ready for manual consensus: {str(e)}")
        return []

def _build_recommended_consensus(agreement_analysis: Dict) -> Dict[str, Any]:
    """
    Build recommended consensus values based on agreement analysis
    """
    if not agreement_analysis or "field_agreements" not in agreement_analysis:
        return {}
    
    recommended_consensus = {}
    field_agreements = agreement_analysis["field_agreements"]
    
    for field, stats in field_agreements.items():
        if stats["agreement_rate"] >= 60:  # Use majority value if reasonable agreement
            recommended_consensus[field] = stats["consensus_value"]
    
    return recommended_consensus   

def _calculate_annotation_agreement(annotations: List[models.Annotation], task_id: int) -> Dict[str, Any]:
    """
    Calculate agreement between annotations for consensus readiness.
    Fixed to handle lists properly for fields like 'short_answer_list'.
    """
    if len(annotations) < 2:
        return {"agreement_rate": 0, "message": "Not enough annotations"}

    key_fields = {
        1: ['relevance', 'learning', 'clarity', 'grounded'],
        2: ['aspects', 'explanation', 'execution'],
    }.get(task_id, [])

    if not key_fields:
        return {"agreement_rate": 0, "message": "Invalid task ID"}

    field_agreements = {}
    total_agreements = 0
    total_fields = 0

    for field in key_fields:
        field_values = []
        for annotation in annotations:
            if field in annotation.data:
                value = annotation.data[field]
                if isinstance(value, list):
                    value = tuple(sorted(value))  # Sort and convert lists to tuples to make them hashable
                field_values.append(value)

        if len(field_values) >= 2:
            most_common_value, agreement_count = Counter(field_values).most_common(1)[0]
            agreement_rate = (agreement_count / len(field_values)) * 100

            field_agreements[field] = {
                "values": [list(v) if isinstance(v, tuple) else v for v in field_values],  # Convert back for readability
                "consensus_value": list(most_common_value) if isinstance(most_common_value, tuple) else most_common_value,
                "agreement_rate": round(agreement_rate, 1),
                "agreed_count": agreement_count,
                "total_count": len(field_values)
            }

            total_agreements += agreement_count
            total_fields += len(field_values)

    overall_agreement = (total_agreements / total_fields * 100) if total_fields > 0 else 0

    return {
        "overall_agreement_rate": round(overall_agreement, 1),
        "field_agreements": field_agreements,
        "total_annotators": len(annotations),
        "analysis_timestamp": datetime.utcnow().isoformat()
    }