# services/general_report_service.py
import logging
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
from services import consensus_service, discussions_service

logger = logging.getLogger(__name__)
MAX_DISCUSSIONS_LIMIT = 10000

def generate_general_report(db: Session) -> Dict[str, Any]:
    """
    Generate a comprehensive workflow status report by leveraging existing services.
    Enhanced with corrected stuck analysis - only truly problematic states are considered stuck.
    
    Returns:
        Dict containing summary, consensus readiness, unlock readiness, rework status, and recommendations.
    """
    logger.info("Generating enhanced general workflow report")
    discussions = discussions_service.get_discussions(db, limit=MAX_DISCUSSIONS_LIMIT, offset=0)
    
    report = {
        "report_timestamp": datetime.utcnow().isoformat(),
        "total_discussions": len(discussions),
        "ready_for_consensus": [],
        "ready_for_task_unlock": [],
        "rework_required": [],
        "stuck_discussions": [],  # Only truly stuck discussions
        "normal_workflow_states": {  # NEW: Track normal states separately
            "collecting_annotations": 0,
            "quality_blocked_expected": 0,
        },
        "workflow_summary": {
            "discussions_ready_for_consensus": 0,
            "discussions_ready_for_unlock": 0,
            "fully_completed_discussions": 0,
            "rework_discussions": 0,
            "stuck_discussions": 0,  # Only truly stuck
            "collecting_annotations": 0,  # Normal state
            "quality_blocked": 0,  # Expected blocks due to quality failures
        },
        "task_breakdown": {
            f"task_{i}": {
                "ready_for_consensus": 0, 
                "ready_for_unlock": 0, 
                "completed": 0,
                "rework_required": 0,
                "collecting_annotations": 0,  # Normal state
                "quality_blocked": 0,  # Expected blocks
            } for i in range(1, 4)
        },
        "bottleneck_analysis": {
            "total_stuck": 0,  # Only true bottlenecks
            "ready_for_consensus": 0,  # Admin action needed
            "rework_flagged": 0,  # Quality issues
            "blocked_non_quality": 0,  # True dependency blocks
            "normal_flow_collecting": 0,  # Not a bottleneck
            "normal_flow_quality_blocked": 0,  # Expected behavior
        },
        "recommendations": []
    }
    
    for discussion in discussions:
        status_summary = discussions_service.get_workflow_status_summary(db, discussion.id)
        discussion_stuck_reasons = []
        discussion_is_stuck = False
        
        # Check readiness for consensus and unlock
        for task_id, task_status in status_summary.get("tasks", {}).items():
            task_num = int(task_id.split('_')[1])
            task_key = f"task_{task_num}"
            current_status = task_status["status"]
            annotators = task_status.get("annotators", 0)
            required_annotators = 5 if task_num == 3 else 3
            
            # Check for rework/flagged status - TRULY STUCK
            if current_status in ('rework', 'flagged'):
                report["rework_required"].append({
                    "discussion_id": discussion.id,
                    "discussion_title": discussion.title,
                    "task_id": task_num,
                    "status": current_status,
                    "annotator_count": annotators,
                    "required_annotators": required_annotators
                })
                report["workflow_summary"]["rework_discussions"] += 1
                report["task_breakdown"][task_key]["rework_required"] += 1
                report["bottleneck_analysis"]["rework_flagged"] += 1
                discussion_stuck_reasons.append(f"Task {task_num}: Requires rework ({current_status})")
                discussion_is_stuck = True
                continue
            
            # Check for blocked status - ANALYZE TYPE OF BLOCK
            if current_status == 'blocked':
                is_quality_block = _is_blocked_due_to_upstream_quality_failure(db, discussion.id, task_num)
                
                if is_quality_block:
                    # This is EXPECTED behavior - not stuck
                    report["workflow_summary"]["quality_blocked"] += 1
                    report["task_breakdown"][task_key]["quality_blocked"] += 1
                    report["bottleneck_analysis"]["normal_flow_quality_blocked"] += 1
                    report["normal_workflow_states"]["quality_blocked_expected"] += 1
                else:
                    # This is a TRUE dependency issue - stuck
                    report["bottleneck_analysis"]["blocked_non_quality"] += 1
                    discussion_stuck_reasons.append(f"Task {task_num}: Blocked by non-quality upstream issues")
                    discussion_is_stuck = True
                continue
            
            # Check for missing annotations - NORMAL WORKFLOW STATE
            if current_status not in ('completed', 'consensus_created', 'quality_failed'):
                if annotators < required_annotators:
                    # This is NORMAL workflow progression - not stuck
                    report["task_breakdown"][task_key]["collecting_annotations"] += 1
                    report["bottleneck_analysis"]["normal_flow_collecting"] += 1
                    report["workflow_summary"]["collecting_annotations"] += 1
                    report["normal_workflow_states"]["collecting_annotations"] += 1
                    # DO NOT add to stuck discussions
                
                # Check if ready for consensus - ADMIN ACTION NEEDED (stuck)
                else:
                    consensus_status = consensus_service.get_consensus_status(db, discussion.id, task_num)
                    
                    if consensus_status.get("consensus_phase") == "ready_for_consensus":
                        agreement_analysis = consensus_status.get("agreement_analysis", {})
                        agreement_rate = agreement_analysis.get("overall_agreement_rate", 0)
                        
                        report["ready_for_consensus"].append({
                            "discussion_id": discussion.id,
                            "discussion_title": discussion.title,
                            "task_id": task_num,
                            "agreement_rate": agreement_rate,
                            "annotator_count": consensus_status.get("annotations_count", annotators),
                            "required_annotators": consensus_status.get("required_annotators", required_annotators),
                            "agreement_details": agreement_analysis,
                            "priority": "high" if agreement_rate >= 90 else "medium" if agreement_rate >= 70 else "low"
                        })
                        report["workflow_summary"]["discussions_ready_for_consensus"] += 1
                        report["task_breakdown"][task_key]["ready_for_consensus"] += 1
                        report["bottleneck_analysis"]["ready_for_consensus"] += 1
                        discussion_stuck_reasons.append(f"Task {task_num}: Ready for consensus creation ({agreement_rate:.1f}% agreement)")
                        discussion_is_stuck = True
            
            # Unlock readiness analysis - ADMIN ACTION NEEDED
            if current_status == "completed" and task_num < 3:
                next_task_key = f"task_{task_num + 1}"
                next_task_status = status_summary["tasks"].get(next_task_key, {}).get("status", "locked")
                
                if next_task_status == "locked":
                    # Check if consensus meets criteria for unlocking
                    consensus_meets_criteria = True  # Default assumption
                    try:
                        # Get consensus for completed task and validate criteria
                        consensus = consensus_service.get_consensus_status(db, discussion.id, task_num)
                        if consensus.get("completion_status"):
                            consensus_meets_criteria = consensus["completion_status"].get("can_complete", True)
                    except Exception as e:
                        logger.warning(f"Could not check consensus criteria for {discussion.id} task {task_num}: {e}")
                    
                    report["ready_for_task_unlock"].append({
                        "discussion_id": discussion.id,
                        "discussion_title": discussion.title,
                        "completed_task_id": task_num,
                        "next_task_id": task_num + 1,
                        "current_next_task_status": next_task_status,
                        "consensus_meets_criteria": consensus_meets_criteria
                    })
                    report["workflow_summary"]["discussions_ready_for_unlock"] += 1
                    report["task_breakdown"][task_key]["ready_for_unlock"] += 1
            
            # Completed tasks count
            if current_status == "completed":
                report["task_breakdown"][task_key]["completed"] += 1
        
        # Overall discussion status analysis
        overall_status = status_summary.get("overall_status", "unknown")
        
        # Fully completed discussions
        if overall_status == "completed":
            report["workflow_summary"]["fully_completed_discussions"] += 1
        
        # Track ONLY truly stuck discussions with detailed reasons
        if discussion_is_stuck:
            report["stuck_discussions"].append({
                "discussion_id": discussion.id,
                "discussion_title": discussion.title,
                "stuck_reasons": discussion_stuck_reasons,
                "overall_status": overall_status
            })
            report["workflow_summary"]["stuck_discussions"] += 1
    
    # Update total stuck count (only true bottlenecks)
    report["bottleneck_analysis"]["total_stuck"] = report["workflow_summary"]["stuck_discussions"]
    
    # Generate enhanced recommendations
    report["recommendations"] = generate_enhanced_recommendations(report)
    
    logger.info(f"Enhanced general report completed: {report['workflow_summary']}")
    return report

def _is_blocked_due_to_upstream_quality_failure(db: Session, discussion_id: str, task_id: int) -> bool:
    """
    Check if a task is blocked specifically due to upstream quality failure.
    This is expected behavior, not a true bottleneck.
    
    Args:
        db: Database session
        discussion_id: Discussion ID
        task_id: Current task ID that is blocked
        
    Returns:
        bool: True if blocked due to upstream quality failure (expected), False if other issue (stuck)
    """
    try:
        # Check if any upstream tasks failed quality
        status_summary = discussions_service.get_workflow_status_summary(db, discussion_id)
        tasks = status_summary.get("tasks", {})
        
        for upstream_task_id in range(1, task_id):
            upstream_task_key = f"task_{upstream_task_id}"
            upstream_status = tasks.get(upstream_task_key, {}).get("status", "unknown")
            
            if upstream_status == "quality_failed":
                logger.debug(f"Task {task_id} blocked due to upstream task {upstream_task_id} quality failure - expected behavior")
                return True
        
        return False
        
    except Exception as e:
        logger.error(f"Error checking upstream quality failure for {discussion_id} task {task_id}: {str(e)}")
        # Default to assuming it's not a quality block (conservative approach)
        return False

def generate_enhanced_recommendations(report: Dict[str, Any]) -> list:
    """
    Generate enhanced recommendations focusing only on true bottlenecks.
    """
    recommendations = []
    
    # High priority: Rework required (TRUE BOTTLENECK)
    if report["workflow_summary"]["rework_discussions"] > 0:
        recommendations.append({
            "type": "rework_required",
            "priority": "high",
            "message": f"{report['workflow_summary']['rework_discussions']} discussions require rework or have been flagged.",
            "action": "Review flagged discussions and resolve quality issues to unblock workflow.",
            "count": report["workflow_summary"]["rework_discussions"]
        })
    
    # Medium priority: Ready for consensus (ADMIN ACTION NEEDED)
    if report["workflow_summary"]["discussions_ready_for_consensus"] > 0:
        high_agreement = len([item for item in report["ready_for_consensus"] if item.get("agreement_rate", 0) >= 90])
        
        recommendations.append({
            "type": "consensus_creation",
            "priority": "medium",
            "message": f"{report['workflow_summary']['discussions_ready_for_consensus']} discussions have tasks ready for consensus creation ({high_agreement} with high agreement).",
            "action": "Prioritize consensus creation for high-agreement tasks first.",
            "count": report["workflow_summary"]["discussions_ready_for_consensus"]
        })
    
    # Medium priority: Ready for unlock (ADMIN ACTION NEEDED)
    if report["workflow_summary"]["discussions_ready_for_unlock"] > 0:
        recommendations.append({
            "type": "task_unlock",
            "priority": "medium", 
            "message": f"{report['workflow_summary']['discussions_ready_for_unlock']} discussions have completed tasks ready for unlocking next steps.",
            "action": "Review and unlock next tasks where quality criteria are met.",
            "count": report["workflow_summary"]["discussions_ready_for_unlock"]
        })
    
    # High priority: Non-quality blockers (TRUE BOTTLENECK)
    if report["bottleneck_analysis"]["blocked_non_quality"] > 0:
        recommendations.append({
            "type": "workflow_blockers",
            "priority": "high",
            "message": f"{report['bottleneck_analysis']['blocked_non_quality']} tasks are blocked by non-quality upstream issues.",
            "action": "Investigate and resolve technical or process issues causing task blocks.",
            "count": report["bottleneck_analysis"]["blocked_non_quality"]
        })
    
    # Informational: Normal workflow states (NOT PROBLEMS)
    normal_collecting = report["workflow_summary"]["collecting_annotations"]
    normal_quality_blocked = report["workflow_summary"]["quality_blocked"]
    
    if normal_collecting > 0 or normal_quality_blocked > 0:
        recommendations.append({
            "type": "workflow_health",
            "priority": "info",
            "message": f"Normal workflow: {normal_collecting} tasks collecting annotations, {normal_quality_blocked} tasks properly blocked by quality gates.",
            "action": "No action needed - these represent healthy workflow progression.",
            "count": normal_collecting + normal_quality_blocked
        })
    
    # Overall progress assessment
    completion_rate = (report["workflow_summary"]["fully_completed_discussions"] / report["total_discussions"] * 100
                       if report["total_discussions"] else 0)
    
    if completion_rate < 10:
        priority = "high"
        action = "Consider workflow optimization and resource reallocation to improve completion rate."
    elif completion_rate < 30:
        priority = "medium" 
        action = "Monitor workflow efficiency and consider process improvements."
    else:
        priority = "low"
        action = "Continue monitoring workflow efficiency."
    
    recommendations.append({
        "type": "workflow_progress",
        "priority": priority,
        "message": f"Overall completion rate: {completion_rate:.1f}%. {report['workflow_summary']['stuck_discussions']} discussions truly stuck requiring intervention.",
        "action": action,
        "count": int(completion_rate)
    })
    
    # Sort recommendations by priority
    priority_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 4))
    
    return recommendations

def get_discussions_ready_for_manual_consensus(db: Session, task_id: Optional[int] = None, min_agreement_rate: float = 70.0) -> List[Dict[str, Any]]:
    """
    Get discussions that are ready for manual consensus creation with filtering options.
    Enhanced to include agreement rate filtering and priority scoring.
    """
    try:
        ready_discussions = []
        
        discussions = discussions_service.get_discussions(db, limit=MAX_DISCUSSIONS_LIMIT, offset=0)
        
        for discussion in discussions:
            for check_task_id in ([task_id] if task_id else [1, 2, 3]):
                consensus_status = consensus_service.get_consensus_status(db, discussion.id, check_task_id)
                
                if consensus_status.get("consensus_phase") == "ready_for_consensus":
                    agreement_analysis = consensus_status.get("agreement_analysis", {})
                    agreement_rate = agreement_analysis.get("overall_agreement_rate", 0)
                    
                    # Filter by minimum agreement rate
                    if agreement_rate >= min_agreement_rate:
                        # Calculate priority score
                        priority_score = agreement_rate
                        if agreement_rate >= 95:
                            priority = "very_high"
                        elif agreement_rate >= 90:
                            priority = "high"
                        elif agreement_rate >= 80:
                            priority = "medium"
                        else:
                            priority = "low"
                        
                        ready_discussions.append({
                            "discussion_id": discussion.id,
                            "discussion_title": discussion.title,
                            "task_id": check_task_id,
                            "task_name": f"Task {check_task_id}",
                            "annotations_count": consensus_status.get("annotations_count", 0),
                            "required_annotators": consensus_status.get("required_annotators", 3),
                            "agreement_rate": agreement_rate,
                            "priority": priority,
                            "priority_score": priority_score,
                            "agreement_details": agreement_analysis,
                            "suggested_consensus": _build_recommended_consensus(agreement_analysis),
                            "can_auto_create": agreement_rate >= 95  # Flag for potential auto-creation
                        })
        
        # Sort by priority score (agreement rate) descending
        ready_discussions.sort(key=lambda x: x["priority_score"], reverse=True)
        
        logger.info(f"Found {len(ready_discussions)} discussions ready for manual consensus (min agreement: {min_agreement_rate}%)")
        return ready_discussions
        
    except Exception as e:
        logger.error(f"Error getting discussions ready for manual consensus: {str(e)}")
        return []

def _build_recommended_consensus(agreement_analysis: Dict) -> Dict[str, Any]:
    """
    Build recommended consensus values based on agreement analysis.
    Enhanced with confidence scoring.
    """
    if not agreement_analysis or "field_agreements" not in agreement_analysis:
        return {}
    
    recommended_consensus = {}
    field_agreements = agreement_analysis["field_agreements"]
    
    for field, stats in field_agreements.items():
        agreement_rate = stats.get("agreement_rate", 0)
        
        if agreement_rate >= 60:  # Use majority value if reasonable agreement
            recommended_consensus[field] = {
                "value": stats["consensus_value"],
                "confidence": "high" if agreement_rate >= 80 else "medium",
                "agreement_rate": agreement_rate,
                "agreed_count": stats.get("agreed_count", 0),
                "total_count": stats.get("total_count", 0)
            }
    
    return recommended_consensus

