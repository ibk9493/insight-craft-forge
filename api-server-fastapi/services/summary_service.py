
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct, case, and_, or_, desc
import models

def get_system_summary(db: Session):
    try:
        # Total discussions
        total_discussions = db.query(func.count(models.Discussion.id)).scalar() or 0

        # Task completion counts
        task_completion_counts = db.query(
            models.discussion_task_association.c.task_number,
            func.count(models.discussion_task_association.c.discussion_id).label('completed_count')
        ).filter(
            models.discussion_task_association.c.status == 'completed'
        ).group_by(
            models.discussion_task_association.c.task_number
        ).all()

        # Initialize counts
        task_counts = {1: 0, 2: 0, 3: 0}
        for task_number, completed_count in task_completion_counts:
            task_counts[task_number] = completed_count

        task1_completed = task_counts[1]
        task2_completed = task_counts[2]
        task3_completed = task_counts[3]

        # Total annotations
        total_annotations = db.query(func.count(models.Annotation.id)).scalar() or 0

        # Unique annotators
        unique_annotators = db.query(func.count(distinct(models.Annotation.user_id))).scalar() or 0

        # Batches data
        batches = db.query(models.BatchUpload).all()
        total_batches = len(batches)

        # Batch breakdown
        batches_breakdown = db.query(
            models.BatchUpload.name,
            func.count(models.Discussion.id).label('discussions')
        ).join(models.Discussion, models.Discussion.batch_id == models.BatchUpload.id)\
         .group_by(models.BatchUpload.name)\
         .order_by(desc('discussions'))\
         .limit(5)\
         .all()

        batches_breakdown = [{"name": name, "discussions": discussions} for name, discussions in batches_breakdown]

        # Trainer breakdown (optimized)
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

        # Task progression stats
        stuck_in_task1 = db.query(func.count(models.Discussion.id)).join(
            models.discussion_task_association,
            (models.Discussion.id == models.discussion_task_association.c.discussion_id)
        ).filter(
            models.discussion_task_association.c.task_number == 1,
            models.discussion_task_association.c.status != 'completed'
        ).scalar() or 0

        stuck_in_task2 = db.query(func.count(models.Discussion.id)).join(
            models.discussion_task_association,
            (models.Discussion.id == models.discussion_task_association.c.discussion_id)
        ).filter(
            models.discussion_task_association.c.task_number == 2,
            models.discussion_task_association.c.status != 'completed'
        ).scalar() or 0

        reached_task3 = db.query(func.count(models.Discussion.id)).join(
            models.discussion_task_association,
            (models.Discussion.id == models.discussion_task_association.c.discussion_id)
        ).filter(
            models.discussion_task_association.c.task_number == 3,
            models.discussion_task_association.c.status.in_(['unlocked', 'completed'])
        ).scalar() or 0

        fully_completed = db.query(func.count(models.Discussion.id)).join(
            models.discussion_task_association,
            (models.Discussion.id == models.discussion_task_association.c.discussion_id)
        ).filter(
            models.discussion_task_association.c.task_number == 3,
            models.discussion_task_association.c.status == 'completed'
        ).scalar() or 0

        # Consensus annotations
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
