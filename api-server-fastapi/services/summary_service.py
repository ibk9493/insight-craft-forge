
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
import models

def get_system_summary(db: Session):
    """
    Get overall system summary statistics
    """
    # Get discussion counts
    total_discussions = db.query(func.count(models.Discussion.id)).scalar() or 0
    
    # Get completion counts per task
    task1_completed = db.query(func.count(models.Discussion.id)).filter(
        models.Discussion.task1_status == "completed"
    ).scalar() or 0
    
    task2_completed = db.query(func.count(models.Discussion.id)).filter(
        models.Discussion.task2_status == "completed"
    ).scalar() or 0
    
    task3_completed = db.query(func.count(models.Discussion.id)).filter(
        models.Discussion.task3_status == "completed"
    ).scalar() or 0
    
    # Get annotation counts
    total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 0
    
    # Get unique annotator count
    unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).scalar() or 0
    
    return {
        "total_discussions": total_discussions,
        "task1_completed": task1_completed,
        "task2_completed": task2_completed,
        "task3_completed": task3_completed,
        "total_tasks_completed": task1_completed + task2_completed + task3_completed,
        "total_annotations": total_annotations,
        "unique_annotators": unique_annotators
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
