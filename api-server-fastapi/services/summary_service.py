from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, desc
import models
from services import discussions_service, consensus_service
import logging
from sqlalchemy import case
logger = logging.getLogger(__name__)




def get_system_summary(db: Session):
    """
    Generate comprehensive system summary with enhanced workflow analysis.
    Includes proper "stuck" detection based on actionable bottlenecks.
    Updated to align with frontend requirements and include trainer breakdown.
    """
    try:
        # Total discussions
        total_discussions = discussions_service.get_discussions_count(db)
        
        # Get all discussions with their task status
        discussions = discussions_service.get_discussions(db, limit=10000)
        
        # Task completion counts with enhanced categories
        task_completion_counts = {
            1: {'completed': 0, 'consensus_created': 0, 'quality_failed': 0,'blocked': 0, 'total_done': 0},
            2: {'completed': 0, 'consensus_created': 0, 'quality_failed': 0,'blocked': 0, 'total_done': 0},
            3: {'completed': 0, 'consensus_created': 0, 'quality_failed': 0,'blocked': 0, 'total_done': 0}
        }
        
        # Enhanced stuck analysis (corrected logic)
        stuck_analysis = _analyze_task_bottlenecks_corrected(db, discussions)
        
        # Calculate task completions
        for disc in discussions:
            for task_num in range(1, 4):
                task_status = disc.tasks[f'task{task_num}'].status
                
                if task_status in task_completion_counts[task_num]:
                    task_completion_counts[task_num][task_status] += 1
                
                # Count total "done" tasks (completed work, regardless of quality outcome)
                if task_status in ('completed', 'consensus_created', 'quality_failed','blocked'):
                    task_completion_counts[task_num]['total_done'] += 1
        
        # Total annotations
        total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 0
        
        # Unique annotators
        unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).scalar() or 0
        
        # Batches data
        total_batches = db.query(func.count(models.BatchUpload.id)).scalar() or 0
        
        # Batch breakdown (top 5 batches)
        batches_breakdown = db.query(
            models.BatchUpload.name,
            func.count(models.Discussion.id).label('discussions')
        ).join(models.Discussion, models.Discussion.batch_id == models.BatchUpload.id)
        batches_breakdown = batches_breakdown.group_by(models.BatchUpload.name).order_by(desc('discussions')).limit(5).all()
        batches_breakdown = [{"name": name, "discussions": count} for name, count in batches_breakdown]
        
        # Enhanced trainer breakdown with task-specific metrics
        trainer_breakdown = _get_enhanced_trainer_breakdown(db)
        
        # Enhanced workflow progression analysis
        workflow_progression = _analyze_workflow_progression(discussions)
        
        # Consensus annotations count
        consensus_annotations = db.query(func.count(models.ConsensusAnnotation.id)).scalar() or 0
        
        # Calculate workflow health metrics
        workflow_health = _calculate_workflow_health(discussions)
        
        return {
            # Basic metrics
            "total_discussions": total_discussions,
            "total_annotations": total_annotations,
            "unique_annotators": unique_annotators,
            "consensus_annotations": consensus_annotations,
            "total_batches": total_batches,
            
            # Enhanced task completion breakdown
            "task_completions": {
                "task1": task_completion_counts[1],
                "task2": task_completion_counts[2], 
                "task3": task_completion_counts[3]
            },
            
            # Legacy fields for backward compatibility
            "task1_completed": task_completion_counts[1]['completed'],
            "task2_completed": task_completion_counts[2]['completed'],
            "task3_completed": task_completion_counts[3]['completed'],
            "total_tasks_completed": sum(counts['completed'] for counts in task_completion_counts.values()),
            
            # Batch and trainer information
            "batchesBreakdown": batches_breakdown,
            "trainerBreakdown": trainer_breakdown,
            
            # Enhanced workflow analysis
            "taskProgression": workflow_progression,
            "bottleneckAnalysis": stuck_analysis,
            "workflowHealth": workflow_health,
            
            # Operational insights
            "actionableInsights": _generate_actionable_insights(stuck_analysis, workflow_health)
        }
        
    except Exception as e:
        logger.error(f"Error generating system summary: {str(e)}")
        return _get_error_fallback_summary()


def _get_enhanced_trainer_breakdown(db: Session) -> list:
    """
    Get enhanced trainer breakdown with detailed task-specific metrics.
    """
    try:
        # Get trainer breakdown with enhanced metrics
        annotators = db.query(
        models.Annotation.user_id,
        func.count(models.Annotation.id).label('total_annotations'),
        func.sum(case((models.Annotation.task_id == 1, 1), else_=0)).label('task1_count'),
        func.sum(case((models.Annotation.task_id == 2, 1), else_=0)).label('task2_count'),
        func.sum(case((models.Annotation.task_id == 3, 1), else_=0)).label('task3_count')
        ).group_by(models.Annotation.user_id).order_by(desc('total_annotations')).all()

        trainers = db.query(models.AuthorizedUser).all()
        trainer_email_map = {str(trainer.id): trainer.email for trainer in trainers}

        trainer_breakdown = []
        for annotator in annotators:
            trainer_breakdown.append({
            "trainer_id": annotator.user_id,
            "trainer_email": trainer_email_map.get(str(annotator.user_id), "N/A"),
            "total_annotations": annotator.total_annotations,
            "task1_count": annotator.task1_count,
            "task2_count": annotator.task2_count,
            "task3_count": annotator.task3_count
            })

        return trainer_breakdown
        
    except Exception as e:
        logger.error(f"Error getting trainer breakdown: {str(e)}")
        return ["Error getting trainer breakdown: {str(e)}"]

    
def _analyze_task_bottlenecks_corrected(db: Session, discussions) -> dict:
    """
    Analyze where discussions are truly stuck requiring intervention.
    CORRECTED LOGIC:
    - Missing annotations = NOT stuck (normal workflow)
    - Blocked due to quality failure = NOT stuck (expected behavior)
    - Rework/flagged = STUCK (needs intervention)
    - Ready for consensus = STUCK (needs admin action)
    - Blocked for non-quality reasons = STUCK (needs investigation)
    """
    stuck_analysis = {
        # These are normal workflow states - NOT stuck
        "task1_missing_annotations": 0,
        "task2_missing_annotations": 0,
        "task3_missing_annotations": 0,
        
        # These are stuck states requiring intervention
        "task1_ready_for_consensus": 0,
        "task2_ready_for_consensus": 0,
        "task3_ready_for_consensus": 0,
        "total_stuck_discussions": 0,
        "stuck_details": [],
        
        # Additional metrics for full picture
        "normal_workflow_collecting": 0,
        "quality_blocked_expected": 0,
        "rework_flagged": 0,
        "blocked_non_quality": 0
    }
    
    for disc in discussions:
        discussion_stuck_reasons = []
        discussion_is_stuck = False
        
        # Analyze each task
        for task_num in range(1, 4):
            task = disc.tasks[f'task{task_num}']
            task_status = task.status
            annotators = task.annotators
            required_annotators = 5 if task_num == 3 else 3
            
            # Check for rework/flagged status - TRULY STUCK
            if task_status in ('rework', 'flagged'):
                stuck_analysis["rework_flagged"] += 1
                discussion_stuck_reasons.append(f"Task {task_num}: Requires rework ({task_status})")
                discussion_is_stuck = True
                continue
            
            # Check for blocked status - ANALYZE TYPE OF BLOCK
            if task_status == 'blocked':
                is_quality_block = _is_blocked_due_to_upstream_quality_failure(db, disc.id, task_num)
                
                if is_quality_block:
                    # This is EXPECTED behavior - not stuck
                    stuck_analysis["quality_blocked_expected"] += 1
                else:
                    # This is a TRUE dependency issue - stuck
                    stuck_analysis["blocked_non_quality"] += 1
                    discussion_stuck_reasons.append(f"Task {task_num}: Blocked by non-quality upstream issues")
                    discussion_is_stuck = True
                continue
            
            # Check task progression states
            if task_status not in ('completed', 'consensus_created', 'quality_failed','blocked'):
                if annotators < required_annotators:
                    # This is NORMAL workflow progression - not stuck
                    stuck_analysis[f"task{task_num}_missing_annotations"] += 1
                    stuck_analysis["normal_workflow_collecting"] += 1
                    # DO NOT add to stuck discussions
                
                elif task_status == "ready_for_consensus":
                    # This requires admin action - stuck
                    stuck_analysis[f"task{task_num}_ready_for_consensus"] += 1
                    discussion_stuck_reasons.append(f"Task {task_num}: Ready for consensus creation")
                    discussion_is_stuck = True
        
        # Track ONLY truly stuck discussions with detailed reasons
        if discussion_is_stuck:
            stuck_analysis["total_stuck_discussions"] += 1
            stuck_analysis["stuck_details"].append({
                "discussion_id": disc.id,
                "discussion_title": disc.title,
                "stuck_reasons": discussion_stuck_reasons
            })
    
    return stuck_analysis


def _is_blocked_due_to_upstream_quality_failure(db: Session, discussion_id: str, task_id: int) -> bool:
    """
    Check if a task is blocked specifically due to upstream quality failure.
    This is expected behavior, not a true bottleneck.
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


def _analyze_workflow_progression(discussions) -> dict:
    """
    Analyze overall workflow progression patterns.
    """
    progression = {
        "not_started": 0,           # All tasks locked
        "task1_in_progress": 0,     # Task 1 active, not done
        "task1_done": 0,            # Task 1 finished (any completion state)
        "task2_in_progress": 0,     # Task 2 active, not done  
        "task2_done": 0,            # Task 2 finished
        "task3_in_progress": 0,     # Task 3 active, not done
        "fully_completed": 0,       # All tasks completed with quality passed
        "workflow_blocked": 0       # Has blocked/rework/flagged tasks
    }
    
    for disc in discussions:
        # Check for blocked workflow
        has_blocked_tasks = any(
            disc.tasks[f'task{i}'].status in ('blocked', 'rework', 'flagged')
            for i in range(1, 4)
        )
        
        if has_blocked_tasks:
            progression["workflow_blocked"] += 1
            continue
        
        # Analyze progression stage
        task1_status = disc.tasks['task1'].status
        task2_status = disc.tasks['task2'].status  
        task3_status = disc.tasks['task3'].status
        
        # Task status categories
        task1_done = task1_status in ('completed', 'consensus_created', 'quality_failed')
        task2_done = task2_status in ('completed', 'consensus_created', 'quality_failed')
        task3_done = task3_status in ('completed', 'consensus_created', 'quality_failed')
        
        task1_active = task1_status in ('unlocked', 'ready_for_consensus')
        task2_active = task2_status in ('unlocked', 'ready_for_consensus')
        task3_active = task3_status in ('unlocked', 'ready_for_consensus')
        
        # Determine progression stage
        if not task1_active and not task1_done:
            progression["not_started"] += 1
        elif task1_active:
            progression["task1_in_progress"] += 1
        elif task1_done and not task2_done and not task2_active:
            progression["task1_done"] += 1
        elif task2_active:
            progression["task2_in_progress"] += 1
        elif task2_done and not task3_done and not task3_active:
            progression["task2_done"] += 1
        elif task3_active:
            progression["task3_in_progress"] += 1
        elif all(disc.tasks[f'task{i}'].status == 'completed' for i in range(1, 4)):
            progression["fully_completed"] += 1
    
    return progression


def _calculate_workflow_health(discussions) -> dict:
    """
    Calculate overall workflow health metrics.
    """
    health = {
        "healthy_discussions": 0,      # Normal progression states
        "quality_issues": 0,           # Has quality_failed tasks
        "blocked_discussions": 0,      # Has blocked/rework/flagged tasks
        "consensus_pending": 0,        # Has consensus_created tasks
        "completion_rate": 0.0,        # Percentage fully completed
        "average_task_completion": 0.0 # Average tasks completed per discussion
    }
    
    total_tasks_completed = 0
    total_possible_tasks = len(discussions) * 3
    
    for disc in discussions:
        has_quality_issues = False
        has_blocked_tasks = False
        has_consensus_pending = False
        tasks_completed = 0
        
        for task_num in range(1, 4):
            status = disc.tasks[f'task{task_num}'].status
            
            if status == 'completed':
                tasks_completed += 1
                total_tasks_completed += 1
            elif status == 'quality_failed':
                has_quality_issues = True
                total_tasks_completed += 1  # Still counts as work done
            elif status in ('blocked', 'rework', 'flagged'):
                has_blocked_tasks = True
            elif status == 'consensus_created':
                has_consensus_pending = True
                total_tasks_completed += 1  # Work is done, awaiting validation
        
        # Categorize discussion health
        if has_blocked_tasks:
            health["blocked_discussions"] += 1
        elif has_quality_issues:
            health["quality_issues"] += 1
        elif has_consensus_pending:
            health["consensus_pending"] += 1
        else:
            health["healthy_discussions"] += 1
        
        # Check if fully completed (all tasks have status 'completed')
        if tasks_completed == 3:
            health["completion_rate"] += 1
    
    # Calculate percentages
    if len(discussions) > 0:
        health["completion_rate"] = (health["completion_rate"] / len(discussions)) * 100
        health["average_task_completion"] = total_tasks_completed / len(discussions)
    
    return health


def _generate_actionable_insights(stuck_analysis: dict, workflow_health: dict) -> list:
    """
    Generate actionable insights for administrators.
    Updated to focus on truly stuck issues only.
    """
    insights = []
    
    # High priority: Rework required (TRULY STUCK)
    if stuck_analysis["rework_flagged"] > 0:
        insights.append({
            "type": "rework_required",
            "priority": "high",
            "message": f"{stuck_analysis['rework_flagged']} discussions require rework or have been flagged",
            "action": "Review flagged discussions and resolve quality issues to unblock workflow"
        })
    
    # Medium priority: Consensus creation backlog (ADMIN ACTION NEEDED)
    ready_for_consensus = (
        stuck_analysis["task1_ready_for_consensus"] +
        stuck_analysis["task2_ready_for_consensus"] +
        stuck_analysis["task3_ready_for_consensus"]
    )
    
    if ready_for_consensus > 0:
        insights.append({
            "type": "consensus_backlog", 
            "priority": "medium",
            "message": f"{ready_for_consensus} discussions ready for consensus creation",
            "action": "Review and create consensus annotations for ready discussions"
        })
    
    # High priority: Non-quality blockers (TRULY STUCK)
    if stuck_analysis["blocked_non_quality"] > 0:
        insights.append({
            "type": "workflow_blockers",
            "priority": "high", 
            "message": f"{stuck_analysis['blocked_non_quality']} discussions have non-quality workflow blockers",
            "action": "Investigate and resolve technical or process issues causing task blocks"
        })
    
    # Informational: Normal workflow states (NOT PROBLEMS)
    normal_collecting = stuck_analysis["normal_workflow_collecting"]
    quality_blocked = stuck_analysis["quality_blocked_expected"]
    
    if normal_collecting > 0 or quality_blocked > 0:
        insights.append({
            "type": "workflow_health",
            "priority": "info",
            "message": f"Normal workflow: {normal_collecting} tasks collecting annotations, {quality_blocked} tasks properly blocked by quality gates",
            "action": "No action needed - these represent healthy workflow progression"
        })
    
    # Overall progress assessment
    completion_rate = workflow_health["completion_rate"]
    if completion_rate < 10:
        insights.append({
            "type": "low_completion",
            "priority": "high",
            "message": f"Low completion rate: {completion_rate:.1f}%",
            "action": "Consider workflow optimization and resource allocation"
        })
    elif completion_rate < 30:
        insights.append({
            "type": "moderate_completion",
            "priority": "medium",
            "message": f"Moderate completion rate: {completion_rate:.1f}%",
            "action": "Monitor workflow efficiency and consider process improvements"
        })
    
    return insights


def _get_error_fallback_summary() -> dict:
    """
    Return a safe fallback summary when errors occur.
    """
    return {
        "total_discussions": 0,
        "task_completions": {
            "task1": {"completed": 0, "consensus_created": 0, "quality_failed": 0, "total_done": 0},
            "task2": {"completed": 0, "consensus_created": 0, "quality_failed": 0, "total_done": 0},
            "task3": {"completed": 0, "consensus_created": 0, "quality_failed": 0, "total_done": 0}
        },
        "task1_completed": 0,
        "task2_completed": 0, 
        "task3_completed": 0,
        "total_tasks_completed": 0,
        "total_annotations": 0,
        "unique_annotators": 0,
        "total_batches": 0,
        "batchesBreakdown": [],
        "trainerBreakdown": [],
        "taskProgression": {
            "not_started": 0,
            "task1_in_progress": 0,
            "task1_done": 0,
            "task2_in_progress": 0,
            "task2_done": 0,
            "task3_in_progress": 0,
            "fully_completed": 0,
            "workflow_blocked": 0
        },
        "bottleneckAnalysis": {
            "task1_missing_annotations": 0,
            "task1_ready_for_consensus": 0,
            "task2_missing_annotations": 0,
            "task2_ready_for_consensus": 0,
            "task3_missing_annotations": 0,
            "task3_ready_for_consensus": 0,
            "total_stuck_discussions": 0,
            "stuck_details": [],
            "normal_workflow_collecting": 0,
            "quality_blocked_expected": 0,
            "rework_flagged": 0,
            "blocked_non_quality": 0
        },
        "workflowHealth": {
            "healthy_discussions": 0,
            "quality_issues": 0,
            "blocked_discussions": 0,
            "consensus_pending": 0,
            "completion_rate": 0.0,
            "average_task_completion": 0.0
        },
        "consensus_annotations": 0,
        "actionableInsights": [],
        "error": "Failed to generate system summary"
    }