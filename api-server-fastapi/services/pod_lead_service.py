
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import models
import schemas
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from services import summary_service, user_agreement_service, discussions_service, consensus_service

logger = logging.getLogger(__name__)

def get_team_members(db: Session) -> List[Dict[str, Any]]:
    """Get all annotator team members."""
    try:
        annotators = db.query(models.AuthorizedUser).filter(
            models.AuthorizedUser.role == "annotator"
        ).all()
        
        team_members = []
        for annotator in annotators:
            # Get basic user summary using existing service
            user_summary = summary_service.get_user_summary(db, annotator.email)
            
            # Get agreement summary using existing service
            try:
                agreement_summary = user_agreement_service.get_user_agreement_summary(db, annotator.email)
                agreement_rate = agreement_summary.get('agreement_rate', 0)
                status = agreement_summary.get('status', 'no_data')
            except Exception as e:
                logger.warning(f"Could not get agreement data for {annotator.email}: {str(e)}")
                agreement_rate = 0
                status = 'no_data'
            
            team_members.append({
                'user_id': annotator.email,
                'email': annotator.email,
                'total_annotations': user_summary.get('totalAnnotations', 0),
                'agreement_rate': agreement_rate,
                'status': status,
                'last_activity': None  # Could be enhanced later
            })
        
        return team_members
    except Exception as e:
        logger.error(f"Error getting team members: {str(e)}")
        return []

def get_pod_lead_summary(db: Session, pod_lead_email: str) -> Dict[str, Any]:
    """Get pod lead dashboard summary."""
    try:
        # Get team members
        team_members = get_team_members(db)
        
        # Calculate team performance metrics
        total_annotations = sum(member['total_annotations'] for member in team_members)
        
        # Calculate average agreement rate (only for members with data)
        members_with_data = [m for m in team_members if m['status'] != 'no_data']
        if members_with_data:
            avg_agreement = sum(m['agreement_rate'] for m in members_with_data) / len(members_with_data)
        else:
            avg_agreement = 0
        
        # Identify users needing attention
        users_needing_attention = [
            m for m in team_members 
            if m['status'] in ['needs_training', 'needs_improvement']
        ]
        
        # Get workflow status using existing services
        try:
            from services import general_report_service
            general_report = general_report_service.generate_general_report(db)
            discussions_ready_for_review = len(general_report.get('ready_for_consensus', []))
            pending_consensus = len(general_report.get('ready_for_task_unlock', []))
        except Exception as e:
            logger.warning(f"Could not get workflow status: {str(e)}")
            discussions_ready_for_review = 0
            pending_consensus = 0
        
        return {
            'team_members': team_members,
            'team_performance': {
                'total_annotations': total_annotations,
                'average_agreement_rate': round(avg_agreement, 2),
                'users_needing_attention': users_needing_attention,
                'team_size': len(team_members)
            },
            'workflow_status': {
                'discussions_ready_for_review': discussions_ready_for_review,
                'pending_consensus': pending_consensus
            },
            'generated_at': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating pod lead summary: {str(e)}")
        raise

def get_team_performance(db: Session) -> Dict[str, Any]:
    """Get detailed team performance metrics."""
    try:
        team_members = get_team_members(db)
        
        # Categorize team members by performance
        excellent_performers = [m for m in team_members if m['status'] == 'excellent']
        good_performers = [m for m in team_members if m['status'] == 'good']
        needs_improvement = [m for m in team_members if m['status'] == 'needs_improvement']
        needs_training = [m for m in team_members if m['status'] == 'needs_training']
        
        # Calculate overall metrics
        total_annotations = sum(m['total_annotations'] for m in team_members)
        members_with_data = [m for m in team_members if m['status'] != 'no_data']
        
        if members_with_data:
            avg_agreement = sum(m['agreement_rate'] for m in members_with_data) / len(members_with_data)
        else:
            avg_agreement = 0
        
        return {
            'team_members': team_members,
            'performance_summary': {
                'excellent_performers': len(excellent_performers),
                'good_performers': len(good_performers),
                'needs_improvement': len(needs_improvement),
                'needs_training': len(needs_training),
                'total_annotations': total_annotations,
                'average_agreement_rate': round(avg_agreement, 2)
            },
            'top_performers': excellent_performers[:5],  # Top 5
            'attention_needed': needs_improvement + needs_training
        }
    except Exception as e:
        logger.error(f"Error getting team performance: {str(e)}")
        raise

def get_discussions_for_review(db: Session, priority: Optional[str] = None, page: int = 1, per_page: int = 10) -> Dict[str, Any]:
    """Get discussions that need pod lead review."""
    try:
        # Get discussions with high disagreement or missing consensus
        all_discussions = discussions_service.get_discussions(db, limit=1000, offset=0)
        
        review_discussions = []
        
        for discussion in all_discussions:
            discussion_needs_review = False
            priority_level = 'low'
            issues = []
            
            # Check each task for issues
            for task_id in [1, 2, 3]:
                task_status = discussion.tasks[f"task{task_id}"].status
                
                if task_status == "unlocked":
                    # Get annotations for this task
                    annotations = db.query(models.Annotation).filter(
                        models.Annotation.discussion_id == discussion.id,
                        models.Annotation.task_id == task_id
                    ).all()
                    
                    if len(annotations) >= 3:  # Enough for consensus
                        # Check for consensus
                        consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
                            db, discussion.id, task_id
                        )
                        
                        if not consensus:
                            # Calculate agreement using existing logic
                            try:
                                consensus_result = consensus_service.calculate_consensus(db, discussion.id, task_id)
                                if not consensus_result.get('agreement', False):
                                    discussion_needs_review = True
                                    priority_level = 'high'
                                    issues.append(f"Task {task_id}: High disagreement, needs consensus")
                            except Exception:
                                pass
            
            # Apply priority filter if specified
            if priority and priority_level != priority:
                continue
            
            if discussion_needs_review:
                review_discussions.append({
                    'discussion_id': discussion.id,
                    'title': discussion.title,
                    'priority': priority_level,
                    'issues': issues,
                    'url': discussion.url,
                    'repository': discussion.repository
                })
        
        # Apply pagination
        offset = (page - 1) * per_page
        paginated_discussions = review_discussions[offset:offset + per_page]
        
        return {
            'items': paginated_discussions,
            'total': len(review_discussions),
            'page': page,
            'per_page': per_page,
            'pages': (len(review_discussions) + per_page - 1) // per_page
        }
    except Exception as e:
        logger.error(f"Error getting discussions for review: {str(e)}")
        raise
