from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, and_, or_, desc, exc
import models
import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager

# Configure logging
logger = logging.getLogger(__name__)

class DatabaseError(Exception):
    """Raised when a database operation fails."""
    pass

class ValidationError(Exception):
    """Raised when input validation fails."""
    pass

@contextmanager
def transaction_scope(db: Session):
    """Provide a transactional scope around a series of operations."""
    try:
        yield
        db.commit()
    except exc.SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise DatabaseError(f"Database operation failed: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Transaction error: {str(e)}")
        raise

def get_task_completion_stats(db: Session) -> Dict[str, int]:
    """
    Get statistics on task completion from task associations.
    
    Parameters:
    - db: Database session
    
    Returns:
    - Dictionary with task completion counts
    """
    try:
        # Get task completion counts based on task association status
        task1_completed = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == 1,
            models.discussion_task_association.c.status == 'completed'
        ).scalar() or 0
        
        task2_completed = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == 2,
            models.discussion_task_association.c.status == 'completed'
        ).scalar() or 0
        
        task3_completed = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == 3,
            models.discussion_task_association.c.status == 'completed'
        ).scalar() or 0
        
        return {
            "task1_completed": task1_completed,
            "task2_completed": task2_completed,
            "task3_completed": task3_completed,
            "total_tasks_completed": task1_completed + task2_completed + task3_completed
        }
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_task_completion_stats: {str(e)}")
        raise DatabaseError(f"Failed to retrieve task completion stats: {str(e)}")

def get_task_progression_stats(db: Session) -> Dict[str, int]:
    """
    Calculate task progression statistics based on task statuses.
    
    Parameters:
    - db: Database session
    
    Returns:
    - Dictionary with task progression statistics
    """
    try:
        # Get all discussions
        discussions = db.query(models.Discussion.id).all()
        discussion_ids = [d.id for d in discussions]
        
        stuck_in_task1 = 0
        stuck_in_task2 = 0
        reached_task3 = 0
        fully_completed = 0
        
        for discussion_id in discussion_ids:
            # Get task statuses for this discussion
            task_statuses = db.query(
                models.discussion_task_association.c.task_number,
                models.discussion_task_association.c.status
            ).filter(
                models.discussion_task_association.c.discussion_id == discussion_id
            ).all()
            
            # Create a status dict for easier lookup
            status_dict = {task.task_number: task.status for task in task_statuses}
            
            # Check progression state
            task1_status = status_dict.get(1, 'locked')
            task2_status = status_dict.get(2, 'locked')
            task3_status = status_dict.get(3, 'locked')
            
            if task1_status != 'completed' and task2_status == 'locked' and task3_status == 'locked':
                stuck_in_task1 += 1
            elif task1_status == 'completed' and task2_status != 'completed' and task3_status == 'locked':
                stuck_in_task2 += 1
            elif task1_status == 'completed' and task2_status == 'completed' and task3_status != 'completed':
                reached_task3 += 1
            elif task1_status == 'completed' and task2_status == 'completed' and task3_status == 'completed':
                fully_completed += 1
        
        return {
            "stuck_in_task1": stuck_in_task1,
            "stuck_in_task2": stuck_in_task2,
            "reached_task3": reached_task3,
            "fully_completed": fully_completed
        }
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_task_progression_stats: {str(e)}")
        raise DatabaseError(f"Failed to retrieve task progression stats: {str(e)}")

def get_batches_breakdown(db: Session, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get a breakdown of batches by discussion count.
    
    Parameters:
    - db: Database session
    - limit: Maximum number of batches to return (default: 5)
    
    Returns:
    - List of dictionaries with batch information
    """
    try:
        batches = db.query(models.BatchUpload).all()
        
        # Create batch breakdown data
        batches_breakdown = []
        for batch in batches:
            # Count discussions in this batch
            discussion_count = db.query(func.count(models.Discussion.id)).filter(
                models.Discussion.batch_id == batch.id
            ).scalar() or 0
            
            # Get task completion stats for this batch
            task1_completed = db.query(func.count()).filter(
                models.discussion_task_association.c.task_number == 1,
                models.discussion_task_association.c.status == 'completed',
                models.discussion_task_association.c.discussion_id.in_(
                    db.query(models.Discussion.id).filter(models.Discussion.batch_id == batch.id)
                )
            ).scalar() or 0
            
            task2_completed = db.query(func.count()).filter(
                models.discussion_task_association.c.task_number == 2,
                models.discussion_task_association.c.status == 'completed',
                models.discussion_task_association.c.discussion_id.in_(
                    db.query(models.Discussion.id).filter(models.Discussion.batch_id == batch.id)
                )
            ).scalar() or 0
            
            task3_completed = db.query(func.count()).filter(
                models.discussion_task_association.c.task_number == 3,
                models.discussion_task_association.c.status == 'completed',
                models.discussion_task_association.c.discussion_id.in_(
                    db.query(models.Discussion.id).filter(models.Discussion.batch_id == batch.id)
                )
            ).scalar() or 0
            
            batches_breakdown.append({
                "id": batch.id,
                "name": batch.name,
                "description": batch.description,
                "created_at": batch.created_at,
                "discussions": discussion_count,
                "task1_completed": task1_completed,
                "task2_completed": task2_completed,
                "task3_completed": task3_completed,
                "total_tasks_completed": task1_completed + task2_completed + task3_completed
            })
        
        # Sort by discussion count descending
        batches_breakdown = sorted(batches_breakdown, key=lambda x: x["discussions"], reverse=True)
        
        # Limit to requested number of batches
        batches_breakdown = batches_breakdown[:limit]
        
        return batches_breakdown
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_batches_breakdown: {str(e)}")
        raise DatabaseError(f"Failed to retrieve batches breakdown: {str(e)}")

def get_trainer_breakdown(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get a breakdown of trainers (annotators) by annotation count.
    
    Parameters:
    - db: Database session
    - limit: Maximum number of trainers to return (default: 10)
    
    Returns:
    - List of dictionaries with trainer information
    """
    try:
        # Get trainer (annotator) breakdown
        trainer_breakdown = []
        annotators = db.query(models.Annotation.user_id, func.count(models.Annotation.id).label('count'))\
            .group_by(models.Annotation.user_id)\
            .order_by(desc('count'))\
            .limit(limit)\
            .all()
        
        for annotator in annotators:
            # Get task breakdown for this annotator
            task1_count = db.query(func.count(models.Annotation.id)).filter(
                models.Annotation.user_id == annotator.user_id,
                models.Annotation.task_id == 1
            ).scalar() or 0
            
            task2_count = db.query(func.count(models.Annotation.id)).filter(
                models.Annotation.user_id == annotator.user_id,
                models.Annotation.task_id == 2
            ).scalar() or 0
            
            task3_count = db.query(func.count(models.Annotation.id)).filter(
                models.Annotation.user_id == annotator.user_id,
                models.Annotation.task_id == 3
            ).scalar() or 0
            
            # Get unique discussions this annotator has worked on
            unique_discussions = db.query(func.count(distinct(models.Annotation.discussion_id))).filter(
                models.Annotation.user_id == annotator.user_id
            ).scalar() or 0
            
            trainer_breakdown.append({
                "trainer_id": annotator.user_id,
                "total_annotations": annotator.count,
                "task1_count": task1_count,
                "task2_count": task2_count,
                "task3_count": task3_count,
                "unique_discussions": unique_discussions
            })
        
        return trainer_breakdown
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_trainer_breakdown: {str(e)}")
        raise DatabaseError(f"Failed to retrieve trainer breakdown: {str(e)}")

def get_system_summary(db: Session) -> Dict[str, Any]:
    """
    Get overall system statistics
    
    Parameters:
    - db: Database session
    
    Returns:
    - Dictionary with system statistics
    """
    try:
        logger.info("Generating system summary")
        
        # Get discussion counts
        total_discussions = db.query(func.count(models.Discussion.id)).scalar() or 0
        
        # Get task completion counts
        task_stats = get_task_completion_stats(db)
        
        # Get annotation counts
        total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 0
        
        # Get unique annotator count
        unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).scalar() or 0
        
        # Get batches data
        batches = db.query(models.BatchUpload).all()
        total_batches = len(batches)
        
        # Get batches breakdown
        batches_breakdown = get_batches_breakdown(db, limit=5)
        
        # Get trainer breakdown
        trainer_breakdown = get_trainer_breakdown(db, limit=10)
        
        # Get task progression stats
        task_progression = get_task_progression_stats(db)
        
        # Get consensus annotation count
        consensus_annotations = db.query(func.count(models.ConsensusAnnotation.id)).scalar() or 0
        
        # Calculate completion percentage
        completion_percentage = 0
        if total_discussions > 0:
            total_possible_tasks = total_discussions * 3  # Assuming 3 tasks per discussion
            completion_percentage = (task_stats["total_tasks_completed"] / total_possible_tasks) * 100
        
        result = {
            "total_discussions": total_discussions,
            "task1_completed": task_stats["task1_completed"],
            "task2_completed": task_stats["task2_completed"],
            "task3_completed": task_stats["task3_completed"],
            "total_tasks_completed": task_stats["total_tasks_completed"],
            "completion_percentage": round(completion_percentage, 2),
            "total_annotations": total_annotations,
            "unique_annotators": unique_annotators,
            "total_batches": total_batches,
            "batchesBreakdown": batches_breakdown,
            "trainerBreakdown": trainer_breakdown,
            "taskProgression": task_progression,
            "consensus_annotations": consensus_annotations
        }
        
        logger.info("Successfully generated system summary")
        return result
    except DatabaseError as e:
        # Re-raise database errors
        raise
    except Exception as e:
        # Log error and return empty stats
        logger.error(f"Error generating system summary: {str(e)}")
        return {
            "total_discussions": 0,
            "task1_completed": 0,
            "task2_completed": 0,
            "task3_completed": 0,
            "total_tasks_completed": 0,
            "completion_percentage": 0,
            "total_annotations": 0,
            "unique_annotators": 0,
            "total_batches": 0,
            "batchesBreakdown": [],
            "trainerBreakdown": [],
            "taskProgression": {
                "stuck_in_task1": 0,
                "stuck_in_task2": 0,
                "reached_task3": 0,
                "fully_completed": 0
            },
            "consensus_annotations": 0,
            "error": str(e)
        }

def get_user_summary(db: Session, user_id: str) -> Dict[str, Any]:
    """
    Get summary statistics for a specific user
    
    Parameters:
    - db: Database session
    - user_id: The ID of the user to get statistics for
    
    Returns:
    - Dictionary with user statistics
    """
    if not user_id:
        logger.warning("Empty user_id provided for user summary")
        raise ValidationError("User ID cannot be empty")
        
    try:
        logger.info(f"Generating summary for user: {user_id}")
        
        # Get annotation counts for this user
        user_annotations = db.query(func.count(models.Annotation.id)).filter(
            models.Annotation.user_id == user_id
        ).scalar() or 0
        
        # Get task completion counts for this user
        task1_completed = db.query(func.count(models.Annotation.id)).filter(
            models.Annotation.user_id == user_id,
            models.Annotation.task_id == 1
        ).scalar() or 0
        
        task2_completed = db.query(func.count(models.Annotation.id)).filter(
            models.Annotation.user_id == user_id,
            models.Annotation.task_id == 2
        ).scalar() or 0
        
        task3_completed = db.query(func.count(models.Annotation.id)).filter(
            models.Annotation.user_id == user_id,
            models.Annotation.task_id == 3
        ).scalar() or 0
        
        # Get count of unique discussions annotated
        unique_discussions = db.query(func.count(distinct(models.Annotation.discussion_id))).filter(
            models.Annotation.user_id == user_id
        ).scalar() or 0
        
        # Get recent annotations (last 5)
        recent_annotations = db.query(models.Annotation).filter(
            models.Annotation.user_id == user_id
        ).order_by(models.Annotation.timestamp.desc()).limit(5).all()
        
        recent_activity = []
        for annotation in recent_annotations:
            # Get discussion title
            discussion = db.query(models.Discussion).filter(
                models.Discussion.id == annotation.discussion_id
            ).first()
            
            discussion_title = discussion.title if discussion else "Unknown Discussion"
            
            recent_activity.append({
                "discussion_id": annotation.discussion_id,
                "discussion_title": discussion_title,
                "task_id": annotation.task_id,
                "timestamp": annotation.timestamp
            })
        
        # Calculate overall system contribution percentage
        total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 1  # Avoid division by zero
        contribution_percentage = (user_annotations / total_annotations) * 100
        
        result = {
            "user_id": user_id,
            "total_annotations": user_annotations,
            "task1_completed": task1_completed,
            "task2_completed": task2_completed,
            "task3_completed": task3_completed,
            "total_tasks_completed": task1_completed + task2_completed + task3_completed,
            "unique_discussions": unique_discussions,
            "contribution_percentage": round(contribution_percentage, 2),
            "recent_activity": recent_activity
        }
        
        logger.info(f"Successfully generated summary for user: {user_id}")
        return result
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_user_summary for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to retrieve user summary: {str(e)}")
    except Exception as e:
        logger.error(f"Error generating user summary for user {user_id}: {str(e)}")
        return {
            "user_id": user_id,
            "total_annotations": 0,
            "task1_completed": 0,
            "task2_completed": 0,
            "task3_completed": 0,
            "total_tasks_completed": 0,
            "unique_discussions": 0,
            "contribution_percentage": 0,
            "recent_activity": [],
            "error": str(e)
        }

def get_task_summary(db: Session, task_id: int) -> Dict[str, Any]:
    """
    Get summary statistics for a specific task
    
    Parameters:
    - db: Database session
    - task_id: The ID of the task to get statistics for (1, 2, or 3)
    
    Returns:
    - Dictionary with task statistics
    """
    if task_id not in [1, 2, 3]:
        logger.warning(f"Invalid task_id provided for task summary: {task_id}")
        raise ValidationError(f"Task ID must be 1, 2, or 3, got {task_id}")
        
    try:
        logger.info(f"Generating summary for task: {task_id}")
        
        # Get annotation counts for this task
        task_annotations = db.query(func.count(models.Annotation.id)).filter(
            models.Annotation.task_id == task_id
        ).scalar() or 0
        
        # Get count of locked, unlocked, and completed tasks
        locked_count = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == task_id,
            models.discussion_task_association.c.status == 'locked'
        ).scalar() or 0
        
        unlocked_count = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == task_id,
            models.discussion_task_association.c.status == 'unlocked'
        ).scalar() or 0
        
        completed_count = db.query(func.count()).filter(
            models.discussion_task_association.c.task_number == task_id,
            models.discussion_task_association.c.status == 'completed'
        ).scalar() or 0
        
        # Get count of unique discussions with this task
        total_discussions_with_task = locked_count + unlocked_count + completed_count
        
        # Get count of unique annotators for this task
        unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).filter(
            models.Annotation.task_id == task_id
        ).scalar() or 0
        
        # Get top annotators for this task
        top_annotators = db.query(
            models.Annotation.user_id, 
            func.count(models.Annotation.id).label('count')
        ).filter(
            models.Annotation.task_id == task_id
        ).group_by(
            models.Annotation.user_id
        ).order_by(
            desc('count')
        ).limit(5).all()
        
        annotator_breakdown = []
        for annotator in top_annotators:
            annotator_breakdown.append({
                "user_id": annotator.user_id,
                "annotation_count": annotator.count
            })
        
        result = {
            "task_id": task_id,
            "total_annotations": task_annotations,
            "total_discussions": total_discussions_with_task,
            "locked_count": locked_count,
            "unlocked_count": unlocked_count,
            "completed_count": completed_count,
            "completion_percentage": round((completed_count / total_discussions_with_task) * 100, 2) if total_discussions_with_task > 0 else 0,
            "unique_annotators": unique_annotators,
            "top_annotators": annotator_breakdown
        }
        
        logger.info(f"Successfully generated summary for task: {task_id}")
        return result
    except exc.SQLAlchemyError as e:
        logger.error(f"Database error in get_task_summary for task {task_id}: {str(e)}")
        raise DatabaseError(f"Failed to retrieve task summary: {str(e)}")
    except Exception as e:
        logger.error(f"Error generating task summary for task {task_id}: {str(e)}")
        return {
            "task_id": task_id,
            "total_annotations": 0,
            "total_discussions": 0,
            "locked_count": 0,
            "unlocked_count": 0,
            "completed_count": 0,
            "completion_percentage": 0,
            "unique_annotators": 0,
            "top_annotators": [],
            "error": str(e)
        }