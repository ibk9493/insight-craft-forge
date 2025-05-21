import os
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException

from models import Discussion, BatchUpload
import schemas

# Configure logging
logger = logging.getLogger(__name__)

# Configuration for file exports
EXPORT_DIR = os.environ.get("EXPORT_DIR", "exports")
EXPORT_URL_BASE = os.environ.get("EXPORT_URL_BASE", "/downloads")
EXPORT_EXPIRY_HOURS = int(os.environ.get("EXPORT_EXPIRY_HOURS", "24"))

# Ensure export directory exists
os.makedirs(EXPORT_DIR, exist_ok=True)

class ExportError(Exception):
    """Raised when export operation fails."""
    pass

def generate_export_filename(format: str, prefix: str = "export") -> str:
    """Generate a unique filename for exports."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_id = str(uuid.uuid4())[:8]
    return f"{prefix}_{timestamp}_{random_id}.{format}"

def clean_expired_exports() -> int:
    """
    Clean up expired export files.

    Returns:
        int: Number of files removed
    """
    try:
        now = datetime.now()
        expiry_time = now - timedelta(hours=EXPORT_EXPIRY_HOURS)
        removed_count = 0

        for filename in os.listdir(EXPORT_DIR):
            file_path = os.path.join(EXPORT_DIR, filename)
            if os.path.isfile(file_path):
                file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                if file_modified < expiry_time:
                    os.remove(file_path)
                    removed_count += 1
                    logger.info(f"Removed expired export file: {filename}")

        return removed_count
    except Exception as e:
        logger.error(f"Error cleaning expired exports: {str(e)}")
        return 0

def export_batch_discussions(db: Session, batch_id: int, format: str = "json") -> Dict[str, Any]:
    """
    Export all discussions for a specific batch.

    Args:
        db: Database session
        batch_id: The ID of the batch to export
        format: Export format ('json' or 'csv')

    Returns:
        Dict containing download URL and metadata
    """
    try:
        # Clean expired exports first
        clean_expired_exports()

        # Verify batch exists
        batch = db.query(BatchUpload).filter(BatchUpload.id == batch_id).first()
        if not batch:
            raise ExportError(f"Batch with ID {batch_id} not found")

        # Get all discussions for this batch
        discussions = db.query(Discussion).filter(Discussion.batch_id == batch_id).all()
        if not discussions:
            raise ExportError(f"No discussions found for batch ID {batch_id}")

        # Generate filename and path
        filename = generate_export_filename(format, f"batch_{batch_id}")
        file_path = os.path.join(EXPORT_DIR, filename)

        # Format the data
        if format.lower() == "json":
            export_data = export_discussions_as_json(db, discussions)
            with open(file_path, 'w') as f:
                json.dump(export_data, f, indent=2)
        elif format.lower() == "csv":
            export_data = export_discussions_as_csv(db, discussions)
            with open(file_path, 'w') as f:
                f.write(export_data)
        else:
            raise ExportError(f"Unsupported export format: {format}")

        # Generate download URL
        download_url = f"{EXPORT_URL_BASE}/{filename}"

        logger.info(f"Successfully exported {len(discussions)} discussions for batch {batch_id} as {format}")

        return {
            "success": True,
            "downloadUrl": download_url,
            "filename": filename,
            "format": format,
            "discussionCount": len(discussions),
            "batchId": batch_id,
            "batchName": batch.name,
            "expiresIn": f"{EXPORT_EXPIRY_HOURS} hours"
        }
    except ExportError as e:
        logger.error(f"Export error: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to export batch discussions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

def export_discussions_as_json(db: Session, discussions: List[Discussion]) -> List[Dict[str, Any]]:
    """
    Format discussions as JSON.

    Args:
        db: Database session
        discussions: List of Discussion models

    Returns:
        List of discussion dictionaries
    """
    result = []
    from services import discussions_service

    for disc in discussions:
        # Get full discussion with tasks and annotations
        full_discussion = discussions_service.get_discussion_by_id(db, disc.id)
        if full_discussion:
            # Convert to dictionary with merged schema
            discussion_dict = {
                # Original Discussion schema fields
                "id": full_discussion.id,
                "title": full_discussion.title,
                "url": full_discussion.url,
                "repository": full_discussion.repository,
                "createdAt": full_discussion.created_at,
                "repositoryLanguage": full_discussion.repository_language,
                "releaseTag": full_discussion.release_tag,
                "releaseUrl": full_discussion.release_url,
                "releaseDate": full_discussion.release_date,
                "batchId": full_discussion.batch_id,

                # Task information
                "tasks": {
                    "task1": {
                        "status": full_discussion.tasks["task1"].status,
                        "annotators": full_discussion.tasks["task1"].annotators
                    },
                    "task2": {
                        "status": full_discussion.tasks["task2"].status,
                        "annotators": full_discussion.tasks["task2"].annotators
                    },
                    "task3": {
                        "status": full_discussion.tasks["task3"].status,
                        "annotators": full_discussion.tasks["task3"].annotators
                    }
                },

                # New JSON schema fields (with defaults)
                "lang": full_discussion.repository_language,  # Map repository_language to lang
                "question": full_discussion.title,  # Map title to question
                "answer": "",  # Default empty string
                "category": "",  # Default empty string
                "knowledge": "",  # Default empty string
                "code": ""  # Default empty string
            }

            # Try to extract additional fields from annotations if available
            if hasattr(full_discussion, 'annotations') and full_discussion.annotations:
                # Look for task3 consensus annotation which might contain answer information
                task3_consensus = full_discussion.annotations.get("task3_consensus")
                if task3_consensus and task3_consensus.data:
                    # Extract answer from consensus data if available
                    if "long_answer" in task3_consensus.data:
                        discussion_dict["answer"] = task3_consensus.data["long_answer"]

                    # Extract category from consensus data if available
                    if "question_type" in task3_consensus.data:
                        discussion_dict["category"] = task3_consensus.data["question_type"]

                # Look for task2 consensus annotation which might contain code
                task2_consensus = full_discussion.annotations.get("task2_consensus")
                if task2_consensus and task2_consensus.data:
                    # Extract code from consensus data if available
                    if "code" in task2_consensus.data:
                        discussion_dict["code"] = task2_consensus.data["code"]

            # Determine knowledge type based on created_at date
            try:
                created_date = datetime.fromisoformat(full_discussion.created_at.replace('Z', '+00:00'))
                cutoff_date = datetime(2023, 1, 1)  # Arbitrary cutoff date
                discussion_dict["knowledge"] = "post-cutoff" if created_date > cutoff_date else "pre-cutoff"
            except (ValueError, TypeError):
                discussion_dict["knowledge"] = "unknown"

            result.append(discussion_dict)

    return result

def export_discussions_as_csv(db: Session, discussions: List[Discussion]) -> str:
    """
    Format discussions as CSV.

    Args:
        db: Database session
        discussions: List of Discussion models

    Returns:
        CSV string
    """
    from services import discussions_service
    import csv
    from io import StringIO

    output = StringIO()
    writer = csv.writer(output)

    # Write header with merged schema fields
    writer.writerow([
        "ID", "URL", "Title/Question", "Repository", "Created At",
        "Language", "Answer", "Category", "Knowledge", "Code",
        "Release Tag", "Release URL", "Release Date", "Batch ID",
        "Task 1 Status", "Task 1 Annotators",
        "Task 2 Status", "Task 2 Annotators",
        "Task 3 Status", "Task 3 Annotators"
    ])

    # Write data
    for disc in discussions:
        full_discussion = discussions_service.get_discussion_by_id(db, disc.id)
        if full_discussion:
            # Default values for new schema fields
            answer = ""
            category = ""
            knowledge = ""
            code = ""

            # Try to extract additional fields from annotations if available
            if hasattr(full_discussion, 'annotations') and full_discussion.annotations:
                # Look for task3 consensus annotation which might contain answer information
                task3_consensus = full_discussion.annotations.get("task3_consensus")
                if task3_consensus and task3_consensus.data:
                    # Extract answer from consensus data if available
                    if "long_answer" in task3_consensus.data:
                        answer = task3_consensus.data["long_answer"]

                    # Extract category from consensus data if available
                    if "question_type" in task3_consensus.data:
                        category = task3_consensus.data["question_type"]

                # Look for task2 consensus annotation which might contain code
                task2_consensus = full_discussion.annotations.get("task2_consensus")
                if task2_consensus and task2_consensus.data:
                    # Extract code from consensus data if available
                    if "code" in task2_consensus.data:
                        code = task2_consensus.data["code"]

            # Determine knowledge type based on created_at date
            try:
                created_date = datetime.fromisoformat(full_discussion.created_at.replace('Z', '+00:00'))
                cutoff_date = datetime(2023, 1, 1)  # Arbitrary cutoff date
                knowledge = "post-cutoff" if created_date > cutoff_date else "pre-cutoff"
            except (ValueError, TypeError):
                knowledge = "unknown"

            writer.writerow([
                full_discussion.id,
                full_discussion.url,
                full_discussion.title,  # Title/Question
                full_discussion.repository,
                full_discussion.created_at,
                full_discussion.repository_language or "",  # Language/lang
                answer,  # Answer (from consensus if available)
                category,  # Category (from consensus if available)
                knowledge,  # Knowledge type
                code,  # Code (from consensus if available)
                full_discussion.release_tag or "",
                full_discussion.release_url or "",
                full_discussion.release_date or "",
                full_discussion.batch_id or "",
                full_discussion.tasks["task1"].status,
                full_discussion.tasks["task1"].annotators,
                full_discussion.tasks["task2"].status,
                full_discussion.tasks["task2"].annotators,
                full_discussion.tasks["task3"].status,
                full_discussion.tasks["task3"].annotators
            ])

    return output.getvalue()

def export_all_discussions(db: Session, format: str = "json") -> Dict[str, Any]:
    """
    Export all discussions in the database.

    Args:
        db: Database session
        format: Export format ('json' or 'csv')

    Returns:
        Dict containing download URL and metadata
    """
    try:
        # Clean expired exports first
        clean_expired_exports()

        # Get all discussions
        discussions = db.query(Discussion).all()
        if not discussions:
            raise ExportError("No discussions found in the database")

        # Generate filename and path
        filename = generate_export_filename(format, "all_discussions")
        file_path = os.path.join(EXPORT_DIR, filename)

        # Format the data
        if format.lower() == "json":
            export_data = export_discussions_as_json(db, discussions)
            with open(file_path, 'w') as f:
                json.dump(export_data, f, indent=2)
        elif format.lower() == "csv":
            export_data = export_discussions_as_csv(db, discussions)
            with open(file_path, 'w') as f:
                f.write(export_data)
        else:
            raise ExportError(f"Unsupported export format: {format}")

        # Generate download URL
        download_url = f"{EXPORT_URL_BASE}/{filename}"

        logger.info(f"Successfully exported {len(discussions)} discussions as {format}")

        return {
            "success": True,
            "downloadUrl": download_url,
            "filename": filename,
            "format": format,
            "discussionCount": len(discussions),
            "expiresIn": f"{EXPORT_EXPIRY_HOURS} hours"
        }
    except ExportError as e:
        logger.error(f"Export error: {str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to export all discussions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")