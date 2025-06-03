# services/general_report_service.py

from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter  # Added Counter import here
from datetime import datetime
import logging
import models
import schemas
from services import consensus_service, discussions_service

logger = logging.getLogger(__name__)


def generate_general_report(db: Session) -> Dict[str, Any]:
    """
    Generate a comprehensive report showing:
    1. Tasks with 100% agreement that are ready for consensus creation
    2. Tasks with consensus that should have next task unlocked
    3. Overall workflow status across all discussions
    
    Returns:
        Dictionary containing comprehensive workflow status report
    """
    logger.info("Generating general workflow report")
    
    try:
        # Get all discussions
        all_discussions = discussions_service.get_discussions(db, limit=10000, offset=0)
        
        if not all_discussions:
            return {
                "total_discussions": 0,
                "message": "No discussions found",
                "report_timestamp": datetime.utcnow().isoformat()
            }
        
        # Initialize report structure
        report = {
            "report_timestamp": datetime.utcnow().isoformat(),
            "total_discussions": len(all_discussions),
            "ready_for_consensus": [],
            "ready_for_task_unlock": [],
            "workflow_summary": {
                "discussions_ready_for_consensus": 0,
                "discussions_ready_for_unlock": 0,
                "fully_completed_discussions": 0,
                "blocked_discussions": 0
            },
            "task_breakdown": {
                "task_1": {"ready_for_consensus": 0, "ready_for_unlock": 0, "completed": 0},
                "task_2": {"ready_for_consensus": 0, "ready_for_unlock": 0, "completed": 0},
                "task_3": {"ready_for_consensus": 0, "ready_for_unlock": 0, "completed": 0}
            },
            "recommendations": []
        }
        
        # Process each discussion
        for discussion in all_discussions:
            discussion_analysis = _analyze_discussion_workflow_status(db, discussion)
            
            # Add to ready for consensus list
            for task_info in discussion_analysis["ready_for_consensus"]:
                report["ready_for_consensus"].append({
                    "discussion_id": discussion.id,
                    "discussion_title": discussion.title,
                    "task_id": task_info["task_id"],
                    "agreement_rate": task_info["agreement_rate"],
                    "annotator_count": task_info["annotator_count"],
                    "required_annotators": task_info["required_annotators"],
                    "agreement_details": task_info["agreement_details"]
                })
                
                # Update summary counters
                report["workflow_summary"]["discussions_ready_for_consensus"] += 1
                report["task_breakdown"][f"task_{task_info['task_id']}"]["ready_for_consensus"] += 1
            
            # Add to ready for unlock list
            for task_info in discussion_analysis["ready_for_unlock"]:
                report["ready_for_task_unlock"].append({
                    "discussion_id": discussion.id,
                    "discussion_title": discussion.title,
                    "completed_task_id": task_info["completed_task_id"],
                    "next_task_id": task_info["next_task_id"],
                    "consensus_meets_criteria": task_info["consensus_meets_criteria"],
                    "current_next_task_status": task_info["current_next_task_status"]
                })
                
                # Update summary counters
                report["workflow_summary"]["discussions_ready_for_unlock"] += 1
                report["task_breakdown"][f"task_{task_info['completed_task_id']}"]["ready_for_unlock"] += 1
            
            # Count completed tasks
            for task_id in [1, 2, 3]:
                if discussion.tasks[f"task{task_id}"].status == "completed":
                    report["task_breakdown"][f"task_{task_id}"]["completed"] += 1
            
            # Check if discussion is fully completed
            if all(discussion.tasks[f"task{i}"].status == "completed" for i in [1, 2, 3]):
                report["workflow_summary"]["fully_completed_discussions"] += 1
        
        # Generate recommendations
        report["recommendations"] = _generate_workflow_recommendations(report)
        
        logger.info(f"Generated report: {report['workflow_summary']}")
        return report
        
    except Exception as e:
        logger.error(f"Error generating general report: {str(e)}")
        raise Exception(f"Report generation failed: {str(e)}")


def _analyze_discussion_workflow_status(db: Session, discussion: schemas.Discussion) -> Dict[str, Any]:
    """
    Analyze workflow status for a single discussion.
    
    Returns:
        Dictionary with ready_for_consensus and ready_for_unlock lists
    """
    
    ready_for_consensus = []
    ready_for_unlock = []
    
    # Check each task
    for task_id in [1, 2, 3]:
        task_status = discussion.tasks[f"task{task_id}"].status
        
        # Skip if task is locked
        if task_status == "locked":
            continue
        
        # Check if ready for consensus (100% agreement)
        if task_status in ["unlocked", "completed"]:
            consensus_readiness = _check_consensus_readiness(db, discussion.id, task_id)
            
            if consensus_readiness["ready"]:
                ready_for_consensus.append({
                    "task_id": task_id,
                    "agreement_rate": consensus_readiness["agreement_rate"],
                    "annotator_count": consensus_readiness["annotator_count"],
                    "required_annotators": consensus_readiness["required_annotators"],
                    "agreement_details": consensus_readiness["agreement_details"]
                })
        
        # Check if ready for unlock (has consensus with proper criteria)
        if task_status == "completed":
            unlock_readiness = _check_unlock_readiness(db, discussion.id, task_id)
            
            if unlock_readiness["ready"]:
                ready_for_unlock.append({
                    "completed_task_id": task_id,
                    "next_task_id": unlock_readiness["next_task_id"],
                    "consensus_meets_criteria": unlock_readiness["consensus_meets_criteria"],
                    "current_next_task_status": unlock_readiness["current_next_task_status"]
                })
    
    return {
        "ready_for_consensus": ready_for_consensus,
        "ready_for_unlock": ready_for_unlock
    }


def _check_consensus_readiness(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    Check if a task is ready for consensus creation (100% agreement).
    """
    
    # Get all annotations for this task
    annotations = db.query(models.Annotation).filter(
        models.Annotation.discussion_id == discussion_id,
        models.Annotation.task_id == task_id
    ).all()
    
    required_annotators = 3 if task_id < 3 else 5
    
    if len(annotations) < required_annotators:
        return {
            "ready": False,
            "reason": f"Not enough annotations ({len(annotations)}/{required_annotators})",
            "annotator_count": len(annotations),
            "required_annotators": required_annotators
        }
    
    # Check if consensus already exists
    existing_consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
        db, discussion_id, task_id
    )
    
    if existing_consensus:
        return {
            "ready": False,
            "reason": "Consensus already exists",
            "annotator_count": len(annotations),
            "required_annotators": required_annotators
        }
    
    # Calculate agreement
    agreement_analysis = _calculate_field_agreement(annotations, task_id)
    
    # Check if we have 100% agreement on all fields
    perfect_agreement_fields = [
        field for field, stats in agreement_analysis["field_agreement"].items()
        if stats["agreement_rate"] == 100.0
    ]
    
    total_fields = len(agreement_analysis["field_agreement"])
    perfect_fields = len(perfect_agreement_fields)
    
    overall_agreement_rate = (perfect_fields / total_fields * 100) if total_fields > 0 else 0
    
    # Consider ready if >= 80% of fields have perfect agreement
    is_ready = overall_agreement_rate >= 80.0
    
    return {
        "ready": is_ready,
        "agreement_rate": round(overall_agreement_rate, 2),
        "annotator_count": len(annotations),
        "required_annotators": required_annotators,
        "agreement_details": agreement_analysis,
        "perfect_agreement_fields": perfect_agreement_fields
    }


def _check_unlock_readiness(db: Session, discussion_id: str, task_id: int) -> Dict[str, Any]:
    """
    Check if next task should be unlocked based on completed task consensus.
    """
    
    # Check if there's a next task
    next_task_id = task_id + 1
    if next_task_id > 3:
        return {"ready": False, "reason": "No next task (Task 3 is final)"}
    
    # Get consensus for current task
    consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
        db, discussion_id, task_id
    )
    
    if not consensus:
        return {"ready": False, "reason": "No consensus exists for current task"}
    
    # Check if consensus meets completion criteria
    from services.consensus_service import _should_task_be_completed
    
    meets_criteria = _should_task_be_completed(db, discussion_id, task_id, consensus.data)
    
    if not meets_criteria:
        return {
            "ready": False, 
            "reason": "Consensus exists but doesn't meet completion criteria",
            "consensus_meets_criteria": False
        }
    
    # Get next task status
    next_task_assoc = db.query(models.discussion_task_association).filter(
        models.discussion_task_association.c.discussion_id == discussion_id,
        models.discussion_task_association.c.task_number == next_task_id
    ).first()
    
    current_next_task_status = next_task_assoc.status if next_task_assoc else "locked"
    
    # Ready if next task is still locked (needs unlocking)
    is_ready = current_next_task_status == "locked"
    
    return {
        "ready": is_ready,
        "next_task_id": next_task_id,
        "consensus_meets_criteria": meets_criteria,
        "current_next_task_status": current_next_task_status,
        "reason": "Ready for unlock" if is_ready else f"Next task already {current_next_task_status}"
    }


def _calculate_field_agreement(annotations: List[models.Annotation], task_id: int) -> Dict[str, Any]:
    """
    Calculate field-by-field agreement rates for annotations.
    """
    
    if not annotations:
        return {"field_agreement": {}, "overall_agreement": 0}
    
    # Define fields to check based on task
    if task_id == 1:
        fields_to_check = ['relevance', 'learning', 'clarity', 'grounded']
    elif task_id == 2:
        fields_to_check = ['aspects', 'explanation', 'execution']
    elif task_id == 3:
        fields_to_check = ['classify', 'rewrite_text', 'longAnswer_text']
    else:
        fields_to_check = []
    
    field_agreement = {}
    
    for field in fields_to_check:
        field_values = []
        
        for annotation in annotations:
            value = annotation.data.get(field)
            if value is not None:
                # Normalize boolean values
                if field in ['relevance', 'learning', 'clarity', 'aspects', 'explanation']:
                    field_values.append(bool(value))
                else:
                    field_values.append(str(value).lower().strip())
        
        if not field_values:
            continue
        
        # Calculate agreement for this field
        if len(set(field_values)) == 1:
            # Perfect agreement
            agreement_rate = 100.0
            consensus_value = field_values[0]
        else:
            # Find majority - Counter is now imported at the top
            value_counts = Counter(field_values)
            most_common_value, most_common_count = value_counts.most_common(1)[0]
            agreement_rate = (most_common_count / len(field_values)) * 100
            consensus_value = most_common_value
        
        field_agreement[field] = {
            "agreement_rate": round(agreement_rate, 2),
            "consensus_value": consensus_value,
            "total_annotations": len(field_values),
            "value_distribution": value_counts
        }
    
    # Calculate overall agreement
    if field_agreement:
        overall_agreement = sum(stats["agreement_rate"] for stats in field_agreement.values()) / len(field_agreement)
    else:
        overall_agreement = 0
    
    return {
        "field_agreement": field_agreement,
        "overall_agreement": round(overall_agreement, 2)
    }


def _generate_workflow_recommendations(report: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Generate actionable recommendations based on report findings.
    """
    recommendations = []
    
    ready_consensus_count = len(report["ready_for_consensus"])
    ready_unlock_count = len(report["ready_for_task_unlock"])
    
    # Consensus creation recommendations
    if ready_consensus_count > 0:
        if ready_consensus_count >= 10:
            priority = "high"
            message = f"High volume: {ready_consensus_count} tasks ready for consensus creation"
        elif ready_consensus_count >= 5:
            priority = "medium"
            message = f"Moderate volume: {ready_consensus_count} tasks ready for consensus creation"
        else:
            priority = "low"
            message = f"{ready_consensus_count} tasks ready for consensus creation"
        
        recommendations.append({
            "type": "consensus_creation",
            "message": message,
            "priority": priority,
            "action": "Review and create consensus annotations for tasks with 100% agreement"
        })
    
    # Task unlock recommendations
    if ready_unlock_count > 0:
        if ready_unlock_count >= 10:
            priority = "high"
            message = f"High volume: {ready_unlock_count} tasks ready for unlocking"
        elif ready_unlock_count >= 5:
            priority = "medium"
            message = f"Moderate volume: {ready_unlock_count} tasks ready for unlocking"
        else:
            priority = "low"
            message = f"{ready_unlock_count} tasks ready for unlocking"
        
        recommendations.append({
            "type": "task_unlock",
            "message": message,
            "priority": priority,
            "action": "Review consensus criteria and unlock next tasks"
        })
    
    # Progress recommendations
    total_discussions = report["total_discussions"]
    completed_discussions = report["workflow_summary"]["fully_completed_discussions"]
    
    if total_discussions > 0:
        completion_rate = (completed_discussions / total_discussions) * 100
        
        if completion_rate < 10:
            recommendations.append({
                "type": "workflow_progress",
                "message": f"Low completion rate: {completion_rate:.1f}% of discussions fully completed",
                "priority": "high",
                "action": "Focus on moving discussions through the workflow pipeline"
            })
        elif completion_rate < 50:
            recommendations.append({
                "type": "workflow_progress", 
                "message": f"Moderate progress: {completion_rate:.1f}% of discussions completed",
                "priority": "medium",
                "action": "Continue steady progress through annotation workflow"
            })
        else:
            recommendations.append({
                "type": "workflow_progress",
                "message": f"Good progress: {completion_rate:.1f}% of discussions completed",
                "priority": "info",
                "action": "Maintain current workflow pace"
            })
    
    return recommendations