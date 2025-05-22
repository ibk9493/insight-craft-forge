"""
Background service for fetching GitHub metadata asynchronously.
"""
import asyncio
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging

from utils.github_fetcher import fetch_github_metadata_async
from database import SessionLocal
import models

logger = logging.getLogger(__name__)

class GitHubMetadataService:
    """Service for handling background GitHub metadata fetching"""
    
    def __init__(self):
        self.semaphore = asyncio.Semaphore(5)  # Limit concurrent GitHub API calls
    
    async def _fetch_and_update_discussion(self, discussion_id: str, discussion_url: str, existing_data: Dict[str, Any]):
        """
        Fetch GitHub metadata for a single discussion and update the database.
        
        Args:
            discussion_id: The discussion ID in the database
            discussion_url: GitHub discussion URL  
            existing_data: Existing discussion data
        """
        async with self.semaphore:  # Limit concurrent API calls
            try:
                logger.info(f"Starting metadata fetch for discussion {discussion_id}")
                
                # Fetch missing metadata
                metadata = await fetch_github_metadata_async(discussion_url, existing_data)
                
                if metadata:
                    # Update database with fetched metadata
                    await self._update_discussion_metadata(discussion_id, metadata)
                    logger.info(f"Updated discussion {discussion_id} with metadata: {list(metadata.keys())}")
                else:
                    logger.info(f"No additional metadata found for discussion {discussion_id}")
                    
            except Exception as e:
                logger.error(f"Error fetching metadata for discussion {discussion_id}: {str(e)}")
    
    async def _update_discussion_metadata(self, discussion_id: str, metadata: Dict[str, Any]):
        """
        Update discussion in database with fetched metadata.
        
        Args:
            discussion_id: The discussion ID
            metadata: Dictionary with metadata to update
        """
        try:
            # Use a new database session for the update
            db = SessionLocal()
            try:
                discussion = db.query(models.Discussion).filter(models.Discussion.id == discussion_id).first()
                if discussion:
                    # Update fields if metadata contains them
                    for field, value in metadata.items():
                        if hasattr(discussion, field) and value is not None:
                            setattr(discussion, field, value)
                    
                    db.commit()
                    logger.debug(f"Successfully updated discussion {discussion_id} in database")
                else:
                    logger.warning(f"Discussion {discussion_id} not found in database")
                    
            except SQLAlchemyError as e:
                db.rollback()
                logger.error(f"Database error updating discussion {discussion_id}: {str(e)}")
                raise
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error updating discussion {discussion_id}: {str(e)}")
            raise
    
    async def fetch_metadata_for_discussions(self, discussions: List[Dict[str, Any]]):
        """
        Fetch GitHub metadata for a list of discussions asynchronously.
        
        Args:
            discussions: List of discussion dictionaries with 'id', 'url', and existing data
        """
        if not discussions:
            logger.info("No discussions to process for metadata fetching")
            return
        
        logger.info(f"Starting async metadata fetch for {len(discussions)} discussions")
        
        # Create tasks for all discussions
        tasks = []
        for discussion in discussions:
            discussion_id = discussion.get('id')
            discussion_url = discussion.get('url')
            
            if not discussion_id or not discussion_url:
                logger.warning(f"Skipping discussion with missing id or url: {discussion}")
                continue
            
            # Create existing data dict from discussion
            existing_data = {
                'repository_language': discussion.get('repository_language'),
                'release_tag': discussion.get('release_tag'),
                'release_url': discussion.get('release_url'),
                'release_date': discussion.get('release_date'),
                'created_at': discussion.get('created_at')
            }
            
            task = self._fetch_and_update_discussion(discussion_id, discussion_url, existing_data)
            tasks.append(task)
        
        # Execute all tasks concurrently
        if tasks:
            try:
                await asyncio.gather(*tasks, return_exceptions=True)
                logger.info(f"Completed metadata fetch for {len(tasks)} discussions")
            except Exception as e:
                logger.error(f"Error in batch metadata fetch: {str(e)}")

# Global service instance
_github_metadata_service = None

def get_github_metadata_service() -> GitHubMetadataService:
    """Get or create a global GitHub metadata service instance"""
    global _github_metadata_service
    if _github_metadata_service is None:
        _github_metadata_service = GitHubMetadataService()
    return _github_metadata_service

def schedule_metadata_fetch(discussions: List[Dict[str, Any]]):
    """
    Schedule background metadata fetching for discussions.
    
    Args:
        discussions: List of discussion dictionaries
    """
    if not discussions:
        return
    
    logger.info(f"Scheduling background metadata fetch for {len(discussions)} discussions")
    
    # Create a new event loop for the background task
    def run_background_fetch():
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            service = get_github_metadata_service()
            loop.run_until_complete(service.fetch_metadata_for_discussions(discussions))
            
        except Exception as e:
            logger.error(f"Error in background metadata fetch: {str(e)}")
        finally:
            loop.close()
    
    # Start the background task in a new thread
    import threading
    thread = threading.Thread(target=run_background_fetch, daemon=True)
    thread.start()
    
    logger.info("Background metadata fetch thread started") 