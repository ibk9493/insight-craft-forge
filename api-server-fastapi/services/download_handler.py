from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
import os
import logging
from typing import Optional

# Configure logging
logger = logging.getLogger(__name__)

# Configuration for file exports
EXPORT_DIR = os.environ.get("EXPORT_DIR", "exports")

router = APIRouter(
    prefix="/downloads",
    tags=["downloads"]
)

@router.get("/{filename}")
async def download_file(filename: str):
    """
    Download an exported file by filename.

    Args:
        filename: The name of the file to download

    Returns:
        FileResponse with the requested file
    """
    file_path = os.path.join(EXPORT_DIR, filename)

    # Validate the file exists
    if not os.path.exists(file_path):
        logger.warning(f"Download requested for non-existent file: {filename}")
        raise HTTPException(
            status_code=404,
            detail=f"File '{filename}' not found. It may have expired or been deleted."
        )

    # Determine the media type based on file extension
    media_type = None
    if filename.endswith('.json'):
        media_type = 'application/json'
    elif filename.endswith('.csv'):
        media_type = 'text/csv'

    # Log the download
    logger.info(f"Serving download: {filename}")

    # Return the file as a download
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
        background=None
    )