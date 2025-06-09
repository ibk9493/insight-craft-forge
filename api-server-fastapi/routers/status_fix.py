# Add this to your main FastAPI app or create a new router

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import logging
from services.status_fix_service import handle_status_fix_request
from database import get_db  # Your database dependency

logger = logging.getLogger(__name__)

# Create router for status fix endpoints
status_fix_router = APIRouter(prefix="/api/admin/workflow", tags=["workflow-management"])

@status_fix_router.post("/fix-statuses")
async def fix_discussion_statuses(
    dry_run: bool = Query(True, description="If true, only analyze without applying changes"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Fix status inconsistencies across all discussions according to enhanced workflow logic.
    
    This endpoint analyzes all discussions and corrects any status inconsistencies based on:
    - Current annotation counts vs required annotators
    - Consensus annotation existence
    - Previous task completion status
    - Workflow progression rules
    
    Parameters:
    - dry_run: If true (default), only analyzes and returns proposed changes without applying them
    
    Returns:
    - Analysis results and status updates (proposed or applied)
    
    Example responses:
    
    **Dry Run (dry_run=true):**
    ```json
    {
        "success": true,
        "dry_run": true,
        "message": "Analysis complete. 15 discussions would be updated.",
        "updated_discussions": 15,
        "total_discussions_analyzed": 500,
        "status_updates": [
            {
                "discussion_id": "repo_owner_123",
                "discussion_title": "How to fix bug X",
                "task_id": 2,
                "current_status": "locked",
                "correct_status": "unlocked",
                "reason": "Previous task (completed) allows progression",
                "applied": false
            }
        ],
        "summary": {
            "status_changes": {
                "locked -> unlocked": 8,
                "unlocked -> ready_for_consensus": 5,
                "ready_for_consensus -> consensus_created": 2
            },
            "fixes_applied": {
                "Previous task allows progression": 8,
                "Has sufficient annotations for consensus": 5,
                "Consensus annotation exists": 2
            }
        }
    }
    ```
    
    **Apply Changes (dry_run=false):**
    ```json
    {
        "success": true,
        "dry_run": false,
        "message": "Status fixes applied successfully. 15 discussions updated.",
        "updated_discussions": 15,
        "status_updates": [...],
        "summary": {...}
    }
    ```
    """
    try:
        logger.info(f"Status fix endpoint called with dry_run={dry_run}")
        
        # Validate permission (add your authentication/authorization logic here)
        # if not user_has_admin_permission(current_user):
        #     raise HTTPException(status_code=403, detail="Admin permission required")
        
        result = handle_status_fix_request(db, dry_run)
        
        if not result.get("success", False):
            raise HTTPException(
                status_code=500, 
                detail=f"Status fix operation failed: {result.get('error', 'Unknown error')}"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status fix endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@status_fix_router.get("/status-fix/preview")
async def preview_status_fixes(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Preview what status fixes would be applied without making changes.
    This is equivalent to calling /fix-statuses with dry_run=true.
    """
    return await fix_discussion_statuses(dry_run=True, db=db)

@status_fix_router.post("/status-fix/apply")
async def apply_status_fixes(
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Apply status fixes to all discussions.
    This is equivalent to calling /fix-statuses with dry_run=false.
    
    ⚠️ **Warning**: This will modify discussion statuses in the database.
    """
    return await fix_discussion_statuses(dry_run=False, db=db)

# Add this router to your main FastAPI app
# app.include_router(status_fix_router)

# Example usage in your main app file:
"""
from fastapi import FastAPI
from routers.status_fix import status_fix_router

app = FastAPI()

"""