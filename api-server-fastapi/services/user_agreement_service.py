# services/user_agreement_service.py

from sqlalchemy.orm import Session
from typing import Dict, List, Any, Optional
from collections import defaultdict, Counter
from datetime import datetime
import logging
import models
import schemas
from services import consensus_service

logger = logging.getLogger(__name__)


async def analyze_user_agreement(
    db: Session, 
    user_id: str, 
    task_filter: Optional[int] = None, 
    include_details: bool = False
) -> Dict[str, Any]:
    """
    Core function to analyze user's annotation agreement with consensus.
    
    Args:
        db: Database session
        user_id: ID of user to analyze
        task_filter: Optional filter for specific task (1, 2, or 3)
        include_details: Whether to include detailed breakdown per annotation
        
    Returns:
        Dictionary containing comprehensive agreement analysis
    """
    logger.info(f"Analyzing agreement for user {user_id}, task filter: {task_filter}")
    
    # Get all user annotations
    user_annotations_query = db.query(models.Annotation).filter(
        models.Annotation.user_id == user_id
    )
    
    if task_filter:
        user_annotations_query = user_annotations_query.filter(
            models.Annotation.task_id == task_filter
        )
    
    user_annotations = user_annotations_query.all()
    
    if not user_annotations:
        return {
            "user_id": user_id,
            "total_annotations": 0,
            "message": "No annotations found for this user",
            "summary": {},
            "recommendations": []
        }
    
    # Initialize counters
    agreement_stats = {
        "total_annotations": len(user_annotations),
        "annotations_with_consensus": 0,
        "perfect_agreements": 0,
        "partial_agreements": 0,
        "disagreements": 0,
        "no_consensus_available": 0,
        "agreement_rate": 0.0,
        "task_breakdown": {},
        "field_agreement_breakdown": defaultdict(lambda: {"agree": 0, "disagree": 0})
    }
    
    detailed_results = [] if include_details else None
    
    # Process each annotation
    for annotation in user_annotations:
        task_id = annotation.task_id
        discussion_id = annotation.discussion_id
        
        # Initialize task breakdown if needed
        if task_id not in agreement_stats["task_breakdown"]:
            agreement_stats["task_breakdown"][task_id] = {
                "total": 0,
                "with_consensus": 0,
                "agreements": 0,
                "disagreements": 0,
                "agreement_rate": 0.0
            }
        
        agreement_stats["task_breakdown"][task_id]["total"] += 1
        
        # Get consensus for this discussion/task
        consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
            db, discussion_id, task_id
        )
        
        if not consensus:
            agreement_stats["no_consensus_available"] += 1
            continue
        
        agreement_stats["annotations_with_consensus"] += 1
        agreement_stats["task_breakdown"][task_id]["with_consensus"] += 1
        
        # Compare user annotation with consensus
        comparison = compare_annotation_with_consensus(
            annotation.data, 
            consensus.data, 
            task_id
        )
        
        # Update counters based on comparison
        if comparison["agreement_type"] == "perfect":
            agreement_stats["perfect_agreements"] += 1
            agreement_stats["task_breakdown"][task_id]["agreements"] += 1
        elif comparison["agreement_type"] == "partial":
            agreement_stats["partial_agreements"] += 1
            agreement_stats["task_breakdown"][task_id]["agreements"] += 1
        else:  # disagreement
            agreement_stats["disagreements"] += 1
            agreement_stats["task_breakdown"][task_id]["disagreements"] += 1
        
        # Update field-level agreement stats
        for field, field_result in comparison["field_comparisons"].items():
            if field_result["agrees"]:
                agreement_stats["field_agreement_breakdown"][field]["agree"] += 1
            else:
                agreement_stats["field_agreement_breakdown"][field]["disagree"] += 1
        
        # Add to detailed results if requested
        if include_details:
            detailed_results.append({
                "discussion_id": discussion_id,
                "task_id": task_id,
                "agreement_type": comparison["agreement_type"],
                "agreement_score": comparison["agreement_score"],
                "field_comparisons": comparison["field_comparisons"],
                "user_annotation_timestamp": annotation.timestamp.isoformat() if annotation.timestamp else None,
                "consensus_timestamp": consensus.timestamp.isoformat() if consensus.timestamp else None
            })
    
    # Calculate overall agreement rate
    if agreement_stats["annotations_with_consensus"] > 0:
        total_agreements = agreement_stats["perfect_agreements"] + agreement_stats["partial_agreements"]
        agreement_stats["agreement_rate"] = round(
            (total_agreements / agreement_stats["annotations_with_consensus"]) * 100, 2
        )
    
    # Calculate task-level agreement rates
    for task_id, task_stats in agreement_stats["task_breakdown"].items():
        if task_stats["with_consensus"] > 0:
            task_stats["agreement_rate"] = round(
                (task_stats["agreements"] / task_stats["with_consensus"]) * 100, 2
            )
    
    # Convert field breakdown to regular dict for JSON serialization
    agreement_stats["field_agreement_breakdown"] = dict(agreement_stats["field_agreement_breakdown"])
    
    result = {
        "user_id": user_id,
        "analysis_timestamp": datetime.utcnow().isoformat(),
        "summary": agreement_stats,
        "recommendations": generate_user_recommendations(agreement_stats)
    }
    
    if include_details:
        result["detailed_annotations"] = detailed_results
    
    return result


def compare_annotation_with_consensus(user_data: dict, consensus_data: dict, task_id: int) -> Dict[str, Any]:
    """
    Compare user annotation with consensus annotation for a specific task.
    
    Args:
        user_data: User's annotation data
        consensus_data: Consensus annotation data  
        task_id: Task ID (1, 2, or 3)
        
    Returns:
        Dictionary with detailed comparison results
    """
    
    if task_id == 1:
        # Task 1: Question Quality fields
        fields_to_compare = ['relevance', 'learning', 'clarity', 'grounded']
    elif task_id == 2:
        # Task 2: Answer Quality fields  
        fields_to_compare = ['aspects', 'explanation', 'execution']
    elif task_id == 3:
        # Task 3: Rewrite fields (more complex comparison needed)
        fields_to_compare = ['classify', 'rewrite_text', 'longAnswer_text']
    else:
        fields_to_compare = []
    
    field_comparisons = {}
    agreements = 0
    total_fields = 0
    
    for field in fields_to_compare:
        user_value = user_data.get(field)
        consensus_value = consensus_data.get(field)
        
        # Skip if either value is missing
        if user_value is None or consensus_value is None:
            continue
        
        total_fields += 1
        
        # Compare values based on field type
        if field in ['relevance', 'learning', 'clarity', 'aspects', 'explanation']:
            # Boolean comparisons
            agrees = bool(user_value) == bool(consensus_value)
        elif field == 'execution':
            # Execution status comparison
            agrees = str(user_value).lower() == str(consensus_value).lower()
        elif field == 'grounded':
            # Image grounding comparison (can be True/False/N/A)
            agrees = str(user_value) == str(consensus_value)
        elif field == 'classify':
            # Classification comparison
            agrees = str(user_value).lower() == str(consensus_value).lower()
        else:
            # Text field comparison (for rewrite fields)
            agrees = compare_text_similarity(str(user_value), str(consensus_value))
        
        if agrees:
            agreements += 1
        
        field_comparisons[field] = {
            "user_value": user_value,
            "consensus_value": consensus_value,
            "agrees": agrees
        }
    
    # Calculate agreement score and type
    if total_fields == 0:
        agreement_score = 0
        agreement_type = "no_comparison"
    else:
        agreement_score = round((agreements / total_fields) * 100, 2)
        
        if agreement_score == 100:
            agreement_type = "perfect"
        elif agreement_score >= 70:
            agreement_type = "partial" 
        else:
            agreement_type = "disagreement"
    
    return {
        "agreement_score": agreement_score,
        "agreement_type": agreement_type,
        "agreements": agreements,
        "total_fields": total_fields,
        "field_comparisons": field_comparisons
    }


def compare_text_similarity(text1: str, text2: str, threshold: float = 0.8) -> bool:
    """
    Simple text similarity comparison for rewrite fields.
    You could enhance this with more sophisticated NLP if needed.
    
    Args:
        text1: First text to compare
        text2: Second text to compare
        threshold: Similarity threshold (0.0 to 1.0)
        
    Returns:
        True if texts are considered similar, False otherwise
    """
    if not text1 or not text2:
        return False
    
    # Simple similarity check - you could use more advanced methods
    text1_clean = text1.lower().strip()
    text2_clean = text2.lower().strip()
    
    # Exact match
    if text1_clean == text2_clean:
        return True
    
    # Length similarity check (basic)
    if abs(len(text1_clean) - len(text2_clean)) / max(len(text1_clean), len(text2_clean)) > 0.5:
        return False
    
    # Word overlap similarity (basic)
    words1 = set(text1_clean.split())
    words2 = set(text2_clean.split())
    
    if not words1 or not words2:
        return False
    
    overlap = len(words1.intersection(words2))
    union = len(words1.union(words2))
    
    similarity = overlap / union if union > 0 else 0
    return similarity >= threshold


async def generate_disagreement_report(db: Session, user_id: str, task_filter: Optional[int]) -> Dict[str, Any]:
    """
    Generate detailed report focusing on disagreements for training purposes.
    
    Args:
        db: Database session
        user_id: ID of user to analyze
        task_filter: Optional filter for specific task
        
    Returns:
        Dictionary containing detailed disagreement analysis and recommendations
    """
    
    analysis = await analyze_user_agreement(db, user_id, task_filter, include_details=True)
    
    # Filter to only disagreements
    disagreements = [
        detail for detail in analysis.get("detailed_annotations", [])
        if detail["agreement_type"] == "disagreement"
    ]
    
    # Group disagreements by common patterns
    disagreement_patterns = defaultdict(list)
    field_error_patterns = defaultdict(int)
    
    for disagreement in disagreements:
        task_id = disagreement["task_id"]
        
        # Analyze field-level disagreements
        for field, comparison in disagreement["field_comparisons"].items():
            if not comparison["agrees"]:
                pattern_key = f"task_{task_id}_{field}"
                disagreement_patterns[pattern_key].append({
                    "discussion_id": disagreement["discussion_id"],
                    "user_value": comparison["user_value"],
                    "consensus_value": comparison["consensus_value"]
                })
                field_error_patterns[pattern_key] += 1
    
    # Generate recommendations based on patterns
    recommendations = []
    
    # Most common disagreement fields
    most_common_errors = sorted(field_error_patterns.items(), key=lambda x: x[1], reverse=True)[:5]
    
    for error_pattern, count in most_common_errors:
        parts = error_pattern.split("_")
        if len(parts) >= 3:
            task_id = parts[1]
            field = "_".join(parts[2:])  # Handle fields with underscores
            
            recommendations.append({
                "type": "field_focus",
                "message": f"Consider reviewing Task {task_id} - {field} criteria (disagreed {count} times)",
                "priority": "high" if count >= 3 else "medium"
            })
    
    return {
        "user_id": user_id,
        "report_timestamp": datetime.utcnow().isoformat(),
        "total_disagreements": len(disagreements),
        "disagreement_details": disagreements,
        "disagreement_patterns": dict(disagreement_patterns),
        "most_common_error_fields": dict(most_common_errors),
        "training_recommendations": recommendations,
        "overall_stats": analysis["summary"]
    }


def generate_user_recommendations(stats: Dict[str, Any]) -> List[Dict[str, str]]:
    """
    Generate personalized recommendations based on user's agreement patterns.
    
    Args:
        stats: Agreement statistics dictionary
        
    Returns:
        List of recommendation dictionaries
    """
    recommendations = []
    
    overall_rate = stats["agreement_rate"]
    
    if overall_rate >= 90:
        recommendations.append({
            "type": "praise",
            "message": "Excellent work! Your annotations show very high agreement with consensus.",
            "priority": "info"
        })
    elif overall_rate >= 70:
        recommendations.append({
            "type": "improvement",
            "message": "Good agreement rate. Review disagreements to improve further.",
            "priority": "medium"
        })
    else:
        recommendations.append({
            "type": "training",
            "message": "Consider additional training - agreement rate is below target.",
            "priority": "high"
        })
    
    # Task-specific recommendations
    for task_id, task_stats in stats["task_breakdown"].items():
        if task_stats["agreement_rate"] < 60:
            recommendations.append({
                "type": "task_focus",
                "message": f"Focus on improving Task {task_id} annotations (current rate: {task_stats['agreement_rate']}%)",
                "priority": "high"
            })
    
    # Field-specific recommendations
    field_breakdown = stats["field_agreement_breakdown"]
    for field, field_stats in field_breakdown.items():
        total = field_stats["agree"] + field_stats["disagree"]
        if total >= 3:  # Only for fields with enough data
            disagree_rate = (field_stats["disagree"] / total) * 100
            if disagree_rate > 40:
                recommendations.append({
                    "type": "field_focus", 
                    "message": f"Review {field} criteria - {disagree_rate:.1f}% disagreement rate",
                    "priority": "medium"
                })
    
    return recommendations


def get_user_agreement_summary(db: Session, user_id: str) -> Dict[str, Any]:
    """
    Get a quick summary of user's agreement statistics.
    Lighter weight version for dashboard/overview purposes.
    
    Args:
        db: Database session
        user_id: ID of user to analyze
        
    Returns:
        Dictionary with summary statistics
    """
    try:
        # Get basic counts
        total_annotations = db.query(models.Annotation).filter(
            models.Annotation.user_id == user_id
        ).count()
        
        if total_annotations == 0:
            return {
                "user_id": user_id,
                "total_annotations": 0,
                "agreement_rate": 0,
                "status": "no_data"
            }
        
        # Get consensus comparison count (simplified)
        # This is a lighter version - for full analysis use analyze_user_agreement
        user_annotations = db.query(models.Annotation).filter(
            models.Annotation.user_id == user_id
        ).limit(50).all()  # Limit for performance
        
        agreements = 0
        comparisons_made = 0
        
        for annotation in user_annotations:
            consensus = consensus_service.get_consensus_annotation_by_discussion_and_task(
                db, annotation.discussion_id, annotation.task_id
            )
            
            if consensus:
                comparisons_made += 1
                comparison = compare_annotation_with_consensus(
                    annotation.data, consensus.data, annotation.task_id
                )
                if comparison["agreement_type"] in ["perfect", "partial"]:
                    agreements += 1
        
        agreement_rate = round((agreements / comparisons_made) * 100, 2) if comparisons_made > 0 else 0
        
        # Determine status
        if agreement_rate >= 85:
            status = "excellent"
        elif agreement_rate >= 70:
            status = "good"
        elif agreement_rate >= 50:
            status = "needs_improvement"
        else:
            status = "needs_training"
        
        return {
            "user_id": user_id,
            "total_annotations": total_annotations,
            "annotations_with_consensus": comparisons_made,
            "agreement_rate": agreement_rate,
            "status": status
        }
        
    except Exception as e:
        logger.error(f"Error getting user agreement summary: {str(e)}")
        return {
            "user_id": user_id,
            "total_annotations": 0,
            "agreement_rate": 0,
            "status": "error",
            "error": str(e)
        }