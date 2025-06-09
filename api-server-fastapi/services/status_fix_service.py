# services/status_fix_service.py - FIXED VERSION
import logging
import json
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Dict, List, Any, Optional
from datetime import datetime
import models
from services import discussions_service, consensus_service

logger = logging.getLogger(__name__)

class StatusFixResult:
    """Result of a status fix operation"""
    def __init__(self):
        self.total_discussions_analyzed = 0
        self.status_updates = []
        self.errors = []
        self.rework_skipped = []  # Track rework tasks that were skipped
        self.summary = {
            "updated_discussions": 0,
            "status_changes": {},
            "fixes_applied": {},
            "rework_tasks_preserved": 0,
            "workflow_corrections_ignored": 0
        }

def fix_all_discussion_statuses(db: Session, dry_run: bool = True) -> Dict[str, Any]:
    """
    Fix status inconsistencies across all discussions according to enhanced workflow logic.
    Now properly handles rework flags stored in discussion_task_association.status field.
    """
    logger.info(f"Starting enhanced status fix operation (dry_run={dry_run})")
    
    result = StatusFixResult()
    
    try:
        # Get all discussions
        discussions = discussions_service.get_discussions(db, limit=10000, offset=0)
        result.total_discussions_analyzed = len(discussions)
        
        logger.info(f"Analyzing {len(discussions)} discussions for status fixes")
        
        for discussion in discussions:
            try:
                # Analyze and fix this discussion's status
                discussion_fixes = _analyze_and_fix_discussion_status(
                    db, discussion, dry_run, result
                )
                
                if discussion_fixes:
                    result.status_updates.extend(discussion_fixes)
                    result.summary["updated_discussions"] += 1
                    
            except Exception as e:
                error_msg = f"Error processing discussion {discussion.id}: {str(e)}"
                logger.error(error_msg)
                result.errors.append(error_msg)
        
        # Calculate summary statistics
        result.summary = _calculate_enhanced_fix_summary(result.status_updates, result.rework_skipped)
        
        if not dry_run:
            db.commit()
            logger.info(f"Status fixes applied: {result.summary['updated_discussions']} discussions updated, {result.summary['rework_tasks_preserved']} rework tasks preserved")
        else:
            logger.info(f"Dry run completed: {result.summary['updated_discussions']} discussions would be updated, {result.summary['rework_tasks_preserved']} rework tasks would be preserved")
        
        return {
            "success": True,
            "dry_run": dry_run,
            "timestamp": datetime.utcnow().isoformat(),
            "total_discussions_analyzed": result.total_discussions_analyzed,
            "updated_discussions": result.summary["updated_discussions"],
            "status_updates": result.status_updates,
            "rework_tasks_preserved": result.summary["rework_tasks_preserved"],
            "workflow_corrections_ignored": result.summary["workflow_corrections_ignored"],
            "summary": result.summary,
            "errors": result.errors,
            "rework_details": result.rework_skipped
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Status fix operation failed: {str(e)}")
        return {
            "success": False,
            "dry_run": dry_run,
            "error": str(e),
            "total_discussions_analyzed": result.total_discussions_analyzed,
            "errors": result.errors
        }

def _analyze_and_fix_discussion_status(
    db: Session, 
    discussion, 
    dry_run: bool,
    result: StatusFixResult
) -> List[Dict[str, Any]]:
    """
    Analyze a single discussion and fix status inconsistencies.
    Now properly reads rework flags from discussion_task_association.status field.
    """
    updates = []
    
    try:
        # Get current task associations
        task_associations = db.execute(
            models.discussion_task_association.select().where(
                models.discussion_task_association.c.discussion_id == discussion.id
            )
        ).fetchall()
        
        # Convert to dict for easy access and extract rework flags
        current_statuses = {}
        rework_flags = []
        
        for assoc in task_associations:
            # Parse status field - it might be JSON or plain string
            status_data = _parse_status_field(assoc.status)
            
            current_statuses[assoc.task_number] = {
                "status": status_data.get("status", assoc.status) if isinstance(status_data, dict) else assoc.status,
                "annotators": assoc.annotators,
                "raw_status": assoc.status
            }
            
            # If status contains rework/flag data, extract it
            if isinstance(status_data, dict) and _is_rework_flag(status_data):
                rework_flags.append({
                    "task_id": assoc.task_number,
                    "flagged_from_task": status_data.get("flagged_from_task", assoc.task_number),
                    "workflow_scenario": status_data.get("workflow_scenario", "unknown"),
                    "reason": status_data.get("reason", "Workflow rework required"),
                    "category": status_data.get("category", "workflow_misrouting"),
                    "flagged_by": status_data.get("flagged_by", "unknown"),
                    "flagged_by_role": status_data.get("flagged_by_role", "unknown"),
                    "flagged_at": status_data.get("flagged_at", "unknown"),
                    "original_status": status_data.get("status", "rework")
                })
        
        logger.debug(f"Discussion {discussion.id}: Found {len(rework_flags)} rework flags")
        
        # Analyze each task and determine correct status
        for task_num in range(1, 4):
            # Check if this task has rework flags that should be preserved
            task_rework_info = _check_task_rework_status(
                db, discussion.id, task_num, rework_flags
            )
            
            if task_rework_info["should_preserve_rework"]:
                # Log that we're preserving this rework status
                result.rework_skipped.append({
                    "discussion_id": discussion.id,
                    "discussion_title": discussion.title,
                    "task_id": task_num,
                    "current_status": current_statuses.get(task_num, {}).get("status", "unknown"),
                    "rework_reason": task_rework_info["reason"],
                    "workflow_scenario": task_rework_info["workflow_scenario"],
                    "flagged_by": task_rework_info["flagged_by"],
                    "flagged_at": task_rework_info["flagged_at"]
                })
                result.summary["rework_tasks_preserved"] += 1
                logger.info(f"Preserving rework status for {discussion.id} Task {task_num}: {task_rework_info['workflow_scenario']}")
                continue
            
            # Determine correct status for non-rework tasks
            correct_status = _determine_correct_task_status(
                db, discussion.id, task_num, current_statuses, rework_flags
            )
            
            current_status = current_statuses.get(task_num, {}).get("status", "locked")
            
            if correct_status != current_status:
                update_info = {
                    "discussion_id": discussion.id,
                    "discussion_title": discussion.title,
                    "task_id": task_num,
                    "current_status": current_status,
                    "correct_status": correct_status,
                    "reason": _get_status_change_reason(
                        db, discussion.id, task_num, current_statuses, correct_status, rework_flags
                    ),
                    "rework_aware": True  # Flag that this fix considered rework status
                }
                
                if not dry_run:
                    # Apply the fix
                    _apply_status_fix(db, discussion.id, task_num, correct_status)
                    update_info["applied"] = True
                else:
                    update_info["applied"] = False
                
                updates.append(update_info)
                logger.info(f"Status fix for {discussion.id} Task {task_num}: {current_status} -> {correct_status}")
        
        return updates
        
    except Exception as e:
        logger.error(f"Error analyzing discussion {discussion.id}: {str(e)}")
        return []

def _parse_status_field(status_value) -> Any:
    """
    Parse the status field which might be:
    - Plain string: "unlocked", "rework", "flagged"
    - JSON string: '{"status": "rework", "reason": "...", ...}'
    """
    if not status_value:
        return "locked"
    
    if isinstance(status_value, dict):
        return status_value
    
    if isinstance(status_value, str):
        # Try to parse as JSON first
        try:
            parsed = json.loads(status_value)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        
        # If not JSON, return as plain string
        return status_value
    
    return status_value

def _is_rework_flag(status_data) -> bool:
    """
    Check if status data represents a rework flag
    """
    if not isinstance(status_data, dict):
        return False
    
    return (
        status_data.get("status") in ("rework", "flagged") or
        status_data.get("category") == "workflow_misrouting" or
        "workflow_scenario" in status_data
    )

def _check_task_rework_status(
    db: Session, 
    discussion_id: str, 
    task_num: int, 
    rework_flags: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Check if a task should preserve its rework status based on workflow scenarios.
    """
    # Find rework flags that affect this task
    affecting_flags = []
    
    for flag in rework_flags:
        workflow_scenario = flag.get("workflow_scenario", "")
        flagged_from_task = flag.get("flagged_from_task", 0)
        
        # Determine if this flag affects the current task
        should_affect = False
        
        if workflow_scenario == "stop_at_task1":
            # Task should be stopped at task 1, so task 2 and 3 should be rework/blocked
            should_affect = task_num >= 2
        elif workflow_scenario == "stop_at_task2":
            # Task should be stopped at task 2, so task 3 should be rework/blocked
            should_affect = task_num >= 3
        elif workflow_scenario == "stop_at_task3":
            # Specific task 3 issue
            should_affect = task_num == 3
        elif flag.get("task_id") == task_num:
            # Direct flag on this task
            should_affect = True
        
        if should_affect:
            affecting_flags.append(flag)
    
    if affecting_flags:
        # Use the most recent flag
        latest_flag = max(affecting_flags, key=lambda x: x.get("flagged_at", ""))
        return {
            "should_preserve_rework": True,
            "reason": latest_flag.get("reason", "Workflow rework required"),
            "workflow_scenario": latest_flag.get("workflow_scenario", "unknown"),
            "flagged_by": latest_flag.get("flagged_by", "unknown"),
            "flagged_at": latest_flag.get("flagged_at", "unknown")
        }
    
    return {
        "should_preserve_rework": False,
        "reason": None,
        "workflow_scenario": None,
        "flagged_by": None,
        "flagged_at": None
    }

def _determine_correct_task_status(
    db: Session, 
    discussion_id: str, 
    task_num: int, 
    current_statuses: Dict[int, Dict],
    rework_flags: List[Dict[str, Any]]
) -> str:
    """
    Determine the correct status for a task based on enhanced workflow logic.
    Now considers rework flags stored in the status field.
    """
    try:
        # Get current task info
        current_task = current_statuses.get(task_num, {})
        current_status = current_task.get("status", "locked")
        annotators = current_task.get("annotators", 0)
        required_annotators = 5 if task_num == 3 else 3
        
        # Check if there are rework flags that should block this task
        blocking_flags = [
            flag for flag in rework_flags 
            if _flag_should_block_task(flag, task_num)
        ]
        
        if blocking_flags:
            # Task should be blocked due to workflow rework
            latest_flag = max(blocking_flags, key=lambda x: x.get("flagged_at", ""))
            workflow_scenario = latest_flag.get("workflow_scenario", "")
            
            if workflow_scenario in ["stop_at_task1", "stop_at_task2"]:
                return latest_flag.get("original_status", "rework")
            else:
                return latest_flag.get("original_status", "rework")
        
        # Check if consensus exists
        consensus = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.discussion_id == discussion_id,
            models.ConsensusAnnotation.task_id == task_num
        ).first()
        
        # If task is already completed, consensus_created, or quality_failed - these are final states
        if consensus:
    # Validate if consensus meets quality criteria
            passes_criteria = consensus_service.validate_consensus_criteria(consensus.data, task_num)
            
            if passes_criteria:
                return "consensus_created"  # Stay as consensus_created (NOT completed)
            else:
                return "quality_failed"     # Mark as quality_failed + block downstream
                
        # If marked as final states but no consensus exists, need to fix
        if current_status in ("completed", "consensus_created", "quality_failed"):
            # No consensus but marked as final state - check annotations
            if annotators >= required_annotators:
                return "ready_for_consensus"
            else:
                return "unlocked"
        
        # If task is rework or flagged - keep these states (require manual intervention)
        if current_status in ("rework", "flagged"):
            return current_status
        
        # For Task 1 - can always be unlocked if not in final state or rework
        if task_num == 1:
            if consensus:
                return "consensus_created"
            elif annotators >= required_annotators:
                return "ready_for_consensus"
            elif annotators > 0:
                return "unlocked"
            else:
                return "unlocked"  # Task 1 should be unlocked by default
        
        # For Tasks 2 and 3 - check if previous task allows progression
        prev_task_num = task_num - 1
        prev_task = current_statuses.get(prev_task_num, {})
        prev_status = prev_task.get("status", "locked")
        
        # If previous task is not in a state that allows progression
        if prev_status not in ("completed", "consensus_created", "quality_failed"):
            return "locked"
        
        # If previous task failed quality, downstream tasks should be blocked
        if prev_status == "quality_failed":
            return "blocked"
        
        # Previous task allows progression - determine status based on current task state
        if consensus:
            # Validate consensus criteria
            passes_criteria = consensus_service.validate_consensus_criteria(consensus.data, task_num)
            if passes_criteria:
                return "consensus_created"
            else:
                return "quality_failed"
        elif annotators >= required_annotators:
            return "ready_for_consensus"
        elif current_status in ("unlocked", "in_progress") or annotators > 0:
            return "unlocked"
        else:
            return "unlocked" # Should be unlocked since previous task is done
            
    except Exception as e:
        logger.error(f"Error determining correct status for {discussion_id} task {task_num}: {str(e)}")
        return current_status  # Return current status if analysis fails

def _flag_should_block_task(flag: Dict[str, Any], task_num: int) -> bool:
    """
    Determine if a rework flag should block a specific task.
    """
    workflow_scenario = flag.get("workflow_scenario", "")
    
    if workflow_scenario == "stop_at_task1":
        return task_num >= 2  # Block tasks 2 and 3
    elif workflow_scenario == "stop_at_task2":
        return task_num >= 3  # Block task 3
    elif workflow_scenario == "stop_at_task3":
        return task_num == 3  # Block only task 3
    elif flag.get("task_id") == task_num:
        return True  # Direct flag on this task
    
    return False

def _get_status_change_reason(
    db: Session, 
    discussion_id: str, 
    task_num: int, 
    current_statuses: Dict, 
    correct_status: str,
    rework_flags: List[Dict[str, Any]]
) -> str:
    """
    Generate a human-readable reason for the status change.
    Now includes rework awareness from status field data.
    """
    current_task = current_statuses.get(task_num, {})
    current_status = current_task.get("status", "locked")
    annotators = current_task.get("annotators", 0)
    required = 5 if task_num == 3 else 3
    
    # Check if there are workflow rework flags affecting this change
    affecting_flags = [
        flag for flag in rework_flags 
        if _flag_should_block_task(flag, task_num)
    ]
    
    if affecting_flags and correct_status in ("rework", "blocked", "flagged"):
        flag = affecting_flags[0]
        return f"Preserving rework status due to workflow scenario: {flag.get('workflow_scenario', 'unknown')}"
    
    # Check consensus
    try:
        consensus = db.query(models.ConsensusAnnotation).filter(
            models.ConsensusAnnotation.discussion_id == discussion_id,
            models.ConsensusAnnotation.task_id == task_num
        ).first()
        has_consensus = consensus is not None
    except:
        has_consensus = False
    
    # Generate reason based on the change
    if current_status == "locked" and correct_status == "unlocked":
        if task_num == 1:
            return "Task 1 should be unlocked by default (no rework flags blocking)"
        else:
            prev_task = current_statuses.get(task_num - 1, {})
            return f"Previous task ({prev_task.get('status', 'unknown')}) allows progression (no rework flags blocking)"
    
    elif current_status == "unlocked" and correct_status == "ready_for_consensus":
        return f"Has sufficient annotations ({annotators}/{required}) for consensus (rework-aware)"
    
    elif current_status == "ready_for_consensus" and correct_status == "consensus_created":
        return "Consensus annotation exists (rework-aware)"
    
    elif current_status == "consensus_created" and correct_status == "ready_for_consensus":
        return "Consensus annotation missing but annotations sufficient (rework-aware)"
    
    elif current_status == "consensus_created" and correct_status == "unlocked":
        return f"Consensus missing and insufficient annotations ({annotators}/{required}) (rework-aware)"
    
    elif correct_status == "blocked":
        prev_task = current_statuses.get(task_num - 1, {})
        return f"Blocked by upstream task status: {prev_task.get('status', 'unknown')} (rework-aware)"
    
    else:
        return f"Status correction: {current_status} -> {correct_status} (rework-aware)"

def _apply_status_fix(db: Session, discussion_id: str, task_num: int, new_status: str):
    """
    Apply a status fix to the database.
    Only updates with plain string status, preserving any existing JSON flag data.
    """
    try:
        # Update the task status in the association table
        result = db.execute(
            models.discussion_task_association.update().where(
                and_(
                    models.discussion_task_association.c.discussion_id == discussion_id,
                    models.discussion_task_association.c.task_number == task_num
                )
            ).values(status=new_status)  # Use plain string status
        )
        
        # If no rows were updated, create the association
        if result.rowcount == 0:
            db.execute(
                models.discussion_task_association.insert().values(
                    discussion_id=discussion_id,
                    task_number=task_num,
                    status=new_status,
                    annotators=0
                )
            )
        
        logger.debug(f"Applied rework-aware status fix: {discussion_id} Task {task_num} -> {new_status}")
        
    except Exception as e:
        logger.error(f"Error applying status fix: {str(e)}")
        raise

def _calculate_enhanced_fix_summary(
    status_updates: List[Dict[str, Any]], 
    rework_skipped: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate summary statistics for the status fixes including rework preservation.
    """
    summary = {
        "updated_discussions": len(set(update["discussion_id"] for update in status_updates)),
        "total_status_changes": len(status_updates),
        "rework_tasks_preserved": len(rework_skipped),
        "workflow_corrections_ignored": len([skip for skip in rework_skipped if skip.get("workflow_scenario")]),
        "status_changes": {},
        "fixes_applied": {},
        "tasks_affected": {"task_1": 0, "task_2": 0, "task_3": 0},
        "rework_scenarios_preserved": {}
    }
    
    for update in status_updates:
        # Count status transitions
        transition = f"{update['current_status']} -> {update['correct_status']}"
        summary["status_changes"][transition] = summary["status_changes"].get(transition, 0) + 1
        
        # Count fix types
        fix_type = update.get("reason", "unknown")
        summary["fixes_applied"][fix_type] = summary["fixes_applied"].get(fix_type, 0) + 1
        
        # Count tasks affected
        task_key = f"task_{update['task_id']}"
        summary["tasks_affected"][task_key] += 1
    
    # Count rework scenarios preserved
    for skip in rework_skipped:
        scenario = skip.get("workflow_scenario", "unknown")
        summary["rework_scenarios_preserved"][scenario] = summary["rework_scenarios_preserved"].get(scenario, 0) + 1
    
    return summary

# API endpoint handler
def handle_status_fix_request(db: Session, dry_run: bool = True) -> Dict[str, Any]:
    """
    Handle the API request for status fixes with rework awareness.
    """
    logger.info(f"Enhanced status fix API called with dry_run={dry_run}")
    
    try:
        result = fix_all_discussion_statuses(db, dry_run)
        
        # Add API-specific metadata
        result["api_version"] = "2.1"  # Updated version for correct rework flag reading
        result["operation"] = "status_fix_rework_aware_fixed"
        
        if dry_run:
            result["message"] = f"Analysis complete. {result.get('updated_discussions', 0)} discussions would be updated, {result.get('rework_tasks_preserved', 0)} rework tasks preserved."
        else:
            result["message"] = f"Status fixes applied successfully. {result.get('updated_discussions', 0)} discussions updated, {result.get('rework_tasks_preserved', 0)} rework tasks preserved."
        
        return result
        
    except Exception as e:
        logger.error(f"Enhanced status fix API error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "operation": "status_fix_rework_aware_fixed",
            "api_version": "2.1"
        }