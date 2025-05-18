
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, and_, or_, desc
import models

def get_system_summary(db: Session):
    """
    Get overall system statistics
    """
    try:
        # Get discussion counts
        total_discussions = db.query(func.count(models.Discussion.id)).scalar() or 0
        
        # Get task completion counts
        # These will need to be updated when task status tracking is fully implemented
        task1_completed = 0  # Placeholder until task1_status column is added
        task2_completed = 0  # Placeholder until task2_status column is added
        task3_completed = 0  # Placeholder until task3_status column is added
        
        # Get annotation counts
        total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 0
        
        # Get unique annotator count
        unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).scalar() or 0
        
        # Get batches data
        batches = db.query(models.BatchUpload).all()
        total_batches = len(batches)
        
        # Create batch breakdown data
        batches_breakdown = []
        for batch in batches:
            # Count discussions in this batch
            discussion_count = db.query(func.count(models.Discussion.id)).filter(
                models.Discussion.batch_id == batch.id
            ).scalar() or 0
            
            batches_breakdown.append({
                "name": batch.name,
                "discussions": discussion_count
            })
        
        # Sort by discussion count descending
        batches_breakdown = sorted(batches_breakdown, key=lambda x: x["discussions"], reverse=True)
        
        # Limit to top 5 batches
        batches_breakdown = batches_breakdown[:5]
        
        # Get trainer (annotator) breakdown
        trainer_breakdown = []
        annotators = db.query(models.Annotation.user_id, func.count(models.Annotation.id).label('count'))\
            .group_by(models.Annotation.user_id)\
            .order_by(desc('count'))\
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
            
            trainer_breakdown.append({
                "trainer_id": annotator.user_id,
                "total_annotations": annotator.count,
                "task1_count": task1_count,
                "task2_count": task2_count,
                "task3_count": task3_count
            })
        
        # Get task progression stats - placeholder values until proper schema is available
        stuck_in_task1 = 0
        stuck_in_task2 = 0
        reached_task3 = 0
        fully_completed = 0
        consensus_annotations = db.query(func.count(models.ConsensusAnnotation.id)).scalar() or 0
        
        return {
            "total_discussions": total_discussions,
            "task1_completed": task1_completed,
            "task2_completed": task2_completed,
            "task3_completed": task3_completed,
            "total_tasks_completed": task1_completed + task2_completed + task3_completed,
            "total_annotations": total_annotations,
            "unique_annotators": unique_annotators,
            "total_batches": total_batches,
            "batchesBreakdown": batches_breakdown,
            "trainerBreakdown": trainer_breakdown,
            "taskProgression": {
                "stuck_in_task1": stuck_in_task1,
                "stuck_in_task2": stuck_in_task2,
                "reached_task3": reached_task3,
                "fully_completed": fully_completed
            },
            "consensus_annotations": consensus_annotations
        }
    except Exception as e:
        # Log error and return empty stats
        print(f"Error generating system summary: {str(e)}")
        return {
            "total_discussions": 0,
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
                "stuck_in_task1": 0,
                "stuck_in_task2": 0,
                "reached_task3": 0,
                "fully_completed": 0
            },
            "consensus_annotations": 0
        }

def get_user_summary(db: Session, user_id: str):
    """
    Get summary statistics for a specific user
    """
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
    
    return {
        "user_id": user_id,
        "total_annotations": user_annotations,
        "task1_completed": task1_completed,
        "task2_completed": task2_completed,
        "task3_completed": task3_completed,
        "total_tasks_completed": task1_completed + task2_completed + task3_completed
    }
