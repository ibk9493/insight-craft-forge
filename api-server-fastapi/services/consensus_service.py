from fastapi import logger
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models  # Assuming models.py contains the updated ConsensusAnnotation model
import schemas  # Assuming schemas.py contains ConsensusAnnotationCreate and ConsensusAnnotationResponse
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


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
    # Find existing consensus annotation based on discussion_id and task_id only

    # task_assoc = db.query(models.discussion_task_association).filter(
    #     models.discussion_task_association.c.discussion_id == consensus_input.discussion_id,
    #     models.discussion_task_association.c.task_id == consensus_input.task_id
    # ).first()
    # if task_assoc and task_assoc.status == 'rework':
    #     raise ValueError(f"Cannot create consensus for task {consensus_input.task_id} - task is marked for rework")
    
    
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
    Determine if a task should be marked as 'completed' based on consensus data.
    
    Rules:
    - Task 1: Must have relevance=True AND learning_value=True AND clarity=True (image_grounded optional)
    - Task 2: Must have address_all_aspects=True AND with_explanation=True (code_executable depends on if code exists)
    - Task 3: Always completed when consensus exists (since it's rewriting/classification)
    
    Returns:
    - True if task should be marked as 'completed'
    - False if task should remain 'unlocked' (consensus exists but criteria not met)
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Evaluating completion criteria for task {task_id}, discussion {discussion_id}")
    logger.info(f"Consensus data: {consensus_data}")
    
    if task_id == 1:
        # Task 1: Question Quality - require core quality criteria
        relevance = consensus_data.get('relevance', False)
        learning_value = consensus_data.get('learning', False)  # Note: might be 'learning' not 'learning_value'
        clarity = consensus_data.get('clarity', False)
        grounded_value = consensus_data.get('grounded')
        if grounded_value == "N/A":
            image_grounded = True  # Skip this check
        else:
            image_grounded = bool(grounded_value)
        
        # image_grounded is optional - only required if the discussion actually has images
        image_grounded = consensus_data.get('grounded', True)  # Default to True if not applicable
        
        required_fields = [relevance, learning_value, clarity]
        if grounded_value != "N/A":
            required_fields.append(image_grounded)
        # Check if image grounding is applicable (you might want to check if discussion has images)
        if consensus_data.get('grounded') is not None and consensus_data.get('grounded') != 'N/A':
            required_fields.append(image_grounded)
        
        all_criteria_met = all(required_fields)
        
        logger.info(f"Task 1 criteria: relevance={relevance}, learning={learning_value}, clarity={clarity}, grounded={image_grounded}")
        logger.info(f"Task 1 completion criteria met: {all_criteria_met}")
        
        return all_criteria_met
    
    elif task_id == 2:
        # Task 2: Answer Quality - require completeness and explanation
        address_all_aspects = consensus_data.get('aspects', False)
        with_explanation = consensus_data.get('explanation', False)
        
        # code_executable - only required if there's actually code to execute
        code_executable = consensus_data.get('execution')
        
        required_fields = [address_all_aspects, with_explanation]
        
        # If there's code, it should be executable or marked as N/A
        if code_executable is not None:
            if code_executable in ['Executable', 'N/A']:
                code_ok = True
            else:
                code_ok = False
            required_fields.append(code_ok)
        
        all_criteria_met = all(required_fields)
        
        logger.info(f"Task 2 criteria: aspects={address_all_aspects}, explanation={with_explanation}, code_executable={code_executable}")
        logger.info(f"Task 2 completion criteria met: {all_criteria_met}")
        
        return all_criteria_met
    
    elif task_id == 3:
        # Task 3: Rewrite - always complete when consensus exists
        # This task is about rewriting/classification, not quality gates
        logger.info("Task 3 automatically marked as completable (rewrite task)")
        return True
    
    else:
        logger.warning(f"Unknown task_id: {task_id}")
        return False


def _update_task_statuses_after_consensus(db: Session, discussion_id: str, completed_task_id: int, consensus_data: dict):
    """
    Enhanced task status update logic that considers true/false field criteria.
    Only marks tasks as 'completed' when ALL three tasks have consensus created.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Auto-updating task statuses for discussion {discussion_id} after task {completed_task_id} consensus")
        
        # Import here to avoid circular imports
        from services import discussions_service
        
        # 1. Check if the current task should actually be marked as consensus_created
        should_complete = _should_task_be_completed(db, discussion_id, completed_task_id, consensus_data)
        
        if should_complete:
            # Mark as consensus_created (not completed yet)
            logger.info(f"Task {completed_task_id} meets completion criteria - marking as consensus_created")
            discussions_service.update_task_status_enhanced(
                db, discussion_id, completed_task_id, "consensus_created", "consensus_system"
            )
        else:
            # Consensus exists but doesn't meet criteria - keep as consensus_created but with note
            logger.info(f"Task {completed_task_id} consensus exists but criteria not met - marking as consensus_created")
            discussions_service.update_task_status_enhanced(
                db, discussion_id, completed_task_id, "consensus_created", "consensus_system"
            )
        
        # 2. Check if ALL three tasks now have consensus_created status
        all_tasks_have_consensus = _check_all_tasks_have_consensus(db, discussion_id)
        
        if all_tasks_have_consensus:
            logger.info(f"All tasks for discussion {discussion_id} have consensus - marking all as completed")
            # Mark all three tasks as completed (this overwrites the consensus_created status)
            for task_id in [1, 2, 3]:
                discussions_service.update_task_status_enhanced(
                    db, discussion_id, task_id, "completed", "consensus_system"
                )
        
        logger.info(f"Successfully updated task statuses after consensus evaluation")
        
    except Exception as e:
        logger.error(f"Error updating task statuses after consensus: {str(e)}")


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
    # This function uses models.Annotation, not models.ConsensusAnnotation.
    # It appears to be for a different purpose (calculating overall consensus from individual annotations).
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
def _determine_consensus_phase(annotations_count: int, required: int, consensus, agreement_analysis) -> str:
    """
    Determine what phase the consensus process is in
    """
    if annotations_count < required:
        return "collecting_annotations"
    
    if not consensus:
        if agreement_analysis and agreement_analysis.get("overall_agreement_rate", 0) >= 80:
            return "ready_for_consensus"
        else:
            return "needs_pod_lead_review"
    
    # Consensus exists, check if it meets criteria
    return "consensus_created"


def _get_recommended_action(consensus_phase: str, completion_status: Dict = None) -> str:
    """
    Get recommended next action based on consensus phase
    """
    if consensus_phase == "collecting_annotations":
        return "Collect more annotations"
    elif consensus_phase == "ready_for_consensus":
        return "Create consensus annotation"
    elif consensus_phase == "needs_pod_lead_review":
        return "Pod lead should review for low agreement"
    elif consensus_phase == "consensus_created":
        if completion_status and completion_status.get("can_complete", False):
            return "Mark task as completed"
        else:
            return "Review consensus criteria"
    else:
        return "Review task status"
def get_discussions_ready_for_consensus(db: Session, task_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get discussions that are ready for consensus creation
    """
    try:
        ready_discussions = []
        
        # Get all discussions
        discussions = db.query(models.Discussion).all()
        
        for discussion in discussions:
            for check_task_id in ([task_id] if task_id else [1, 2, 3]):
                consensus_status = get_consensus_status(db, discussion.id, check_task_id)
                
                if consensus_status.get("consensus_phase") == "ready_for_consensus":
                    agreement_rate = consensus_status.get("agreement_analysis", {}).get("overall_agreement_rate", 0)
                    
                    ready_discussions.append({
                        "discussion_id": discussion.id,
                        "discussion_title": discussion.title,
                        "task_id": check_task_id,
                        "task_name": f"Task {check_task_id}",
                        "annotations_count": consensus_status.get("annotations_count"),
                        "agreement_rate": agreement_rate,
                        "recommended_consensus": _build_recommended_consensus(
                            consensus_status.get("agreement_analysis", {})
                        )
                    })
        
        # Sort by agreement rate (highest first)
        ready_discussions.sort(key=lambda x: x["agreement_rate"], reverse=True)
        
        return ready_discussions
        
    except Exception as e:
        logger.error(f"Error getting discussions ready for consensus: {str(e)}")
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
    Calculate agreement between annotations for consensus readiness
    """
    if len(annotations) < 2:
        return {"agreement_rate": 0, "message": "Not enough annotations"}
    
    # Get field agreement by task type
    if task_id == 1:
        key_fields = ['relevance', 'learning', 'clarity', 'grounded']
    elif task_id == 2:
        key_fields = ['aspects', 'explanation', 'execution']
    elif task_id == 3:
        key_fields = ['classify', 'short_answer_list', 'longAnswer_text']
    else:
        return {"agreement_rate": 0, "message": "Invalid task ID"}
    
    field_agreements = {}
    total_agreements = 0
    total_fields = 0
    
    for field in key_fields:
        field_values = []
        for annotation in annotations:
            if field in annotation.data:
                field_values.append(annotation.data[field])
        
        if len(field_values) >= 2:
            # Calculate agreement for this field
            most_common_value = max(set(field_values), key=field_values.count)
            agreement_count = field_values.count(most_common_value)
            agreement_rate = (agreement_count / len(field_values)) * 100
            
            field_agreements[field] = {
                "values": field_values,
                "consensus_value": most_common_value,
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

def get_consensus_status(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    Get detailed consensus status for a task
    """
    try:
        # Get annotations count
        annotations = db.query(models.Annotation).filter(
            models.Annotation.discussion_id == discussion_id,
            models.Annotation.task_id == task_id
        ).all()
        
        # Get consensus annotation
        consensus = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.discussion_id == discussion_id,
            models.ConsensusAnnotation.task_id == task_id
        ).first()
        
        # Get required annotators
        required_annotators = 3 if task_id < 3 else 5
        
        # Calculate agreement if we have annotations
        agreement_analysis = None
        if len(annotations) >= 2:
            agreement_analysis = _calculate_annotation_agreement(annotations, task_id)
        
        # Determine consensus phase
        consensus_phase = _determine_consensus_phase(
            len(annotations), 
            required_annotators, 
            consensus, 
            agreement_analysis
        )
        
        # Check completion criteria if consensus exists
        completion_status = None
        if consensus:
            completion_status = _get_task_completion_status(consensus.data, task_id)
        
        return {
            "discussion_id": discussion_id,
            "task_id": task_id,
            "annotations_count": len(annotations),
            "required_annotators": required_annotators,
            "has_consensus": consensus is not None,
            "consensus_phase": consensus_phase,
            "agreement_analysis": agreement_analysis,
            "completion_status": completion_status,
            "consensus_created_by": consensus.user_id if consensus else None,
            "consensus_created_at": consensus.timestamp.isoformat() if consensus else None,
            "recommended_action": _get_recommended_action(consensus_phase, completion_status)
        }
        
    except Exception as e:
        logger.error(f"Error getting consensus status: {str(e)}")
        return {"error": str(e)}