"""
Background service for fetching GitHub metadata asynchronously with rate limiting.
"""
import asyncio
import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
import logging

from utils.github_fetcher import fetch_github_metadata_async
from database import SessionLocal
import models

logger = logging.getLogger(__name__)

class GitHubMetadataService:
    """Service for handling background GitHub metadata fetching with rate limiting"""
    
    def __init__(self):
        self.semaphore = asyncio.Semaphore(2)  # Reduce concurrent calls from 5 to 2
        self.last_request_time = 0
        self.min_request_interval = 1.2  # Minimum 1.2 seconds between requests
        self.rate_limit_cooldown = 300  # 5 minutes cooldown after rate limit hit
        self.rate_limited_until = 0
    
    async def _rate_limit_check(self):
        """Ensure we don't exceed rate limits"""
        current_time = time.time()
        
        # Check if we're in cooldown period
        if current_time < self.rate_limited_until:
            cooldown_remaining = self.rate_limited_until - current_time
            logger.info(f"Rate limit cooldown active. Waiting {cooldown_remaining:.1f} seconds...")
            await asyncio.sleep(cooldown_remaining)
        
        # Ensure minimum interval between requests
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            logger.debug(f"Rate limiting: sleeping {sleep_time:.1f}s")
            await asyncio.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _handle_rate_limit_error(self, error_msg: str):
        """Handle rate limit errors by setting cooldown"""
        if "rate limit" in error_msg.lower():
            self.rate_limited_until = time.time() + self.rate_limit_cooldown
            logger.warning(f"Rate limit detected. Cooling down for {self.rate_limit_cooldown/60:.1f} minutes")
            return True
        return False
    
    async def _fetch_and_update_discussion(self, discussion_id: str, discussion_url: str, existing_data: Dict[str, Any], missing_fields: Dict[str, Any] = None):
        """
        Fetch GitHub metadata for a single discussion and update the database.
        
        Args:
            discussion_id: The discussion ID in the database
            discussion_url: GitHub discussion URL  
            existing_data: Existing discussion data
            missing_fields: Dict of fields that need to be fetched
        """
        async with self.semaphore:  # Limit concurrent API calls
            try:
                # Rate limiting check
                await self._rate_limit_check()
                
                logger.info(f"Starting metadata fetch for discussion {discussion_id}")
                
                # If we have missing_fields info, only fetch those
                if missing_fields:
                    logger.info(f"Fetching missing fields for {discussion_id}: {list(missing_fields.keys())}")
                
                # Fetch missing metadata
                metadata = await fetch_github_metadata_async(discussion_url, existing_data)
                
                if metadata:
                    # If we have specific missing fields, only update those
                    if missing_fields:
                        filtered_metadata = {k: v for k, v in metadata.items() if k in missing_fields}
                        if filtered_metadata:
                            await self._update_discussion_metadata(discussion_id, filtered_metadata)
                            logger.info(f"Updated discussion {discussion_id} with specific fields: {list(filtered_metadata.keys())}")
                        else:
                            logger.info(f"No matching metadata found for missing fields in discussion {discussion_id}")
                    else:
                        await self._update_discussion_metadata(discussion_id, metadata)
                        logger.info(f"Updated discussion {discussion_id} with metadata: {list(metadata.keys())}")
                else:
                    logger.info(f"No additional metadata found for discussion {discussion_id}")
                    
            except Exception as e:
                error_msg = str(e)
                
                # Handle rate limiting
                if self._handle_rate_limit_error(error_msg):
                    # Re-queue this discussion for later retry
                    logger.info(f"Re-queuing discussion {discussion_id} after rate limit cooldown")
                    # You might want to implement a retry queue here
                    return
                
                logger.error(f"Error fetching metadata for discussion {discussion_id}: {error_msg}")
    
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
                    updated_fields = []
                    for field, value in metadata.items():
                        if hasattr(discussion, field) and value is not None:
                            # Only update if the current value is None/empty
                            current_value = getattr(discussion, field)
                            if not current_value:
                                setattr(discussion, field, value)
                                updated_fields.append(field)
                    
                    if updated_fields:
                        db.commit()
                        logger.debug(f"Successfully updated discussion {discussion_id} fields: {updated_fields}")
                    else:
                        logger.debug(f"No fields needed updating for discussion {discussion_id}")
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
        Fetch GitHub metadata for a list of discussions asynchronously with rate limiting.
        
        Args:
            discussions: List of discussion dictionaries with 'id', 'url', and existing data
        """
        if not discussions:
            logger.info("No discussions to process for metadata fetching")
            return
        
        logger.info(f"Starting async metadata fetch for {len(discussions)} discussions with rate limiting")
        
        # Process discussions in smaller batches to avoid overwhelming the API
        batch_size = 10  # Process 10 discussions at a time
        
        for i in range(0, len(discussions), batch_size):
            batch = discussions[i:i + batch_size]
            logger.info(f"Processing batch {i//batch_size + 1}/{(len(discussions)-1)//batch_size + 1} ({len(batch)} discussions)")
            
            # Create tasks for current batch
            tasks = []
            for discussion in batch:
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
                
                # Get missing fields if provided
                missing_fields = discussion.get('missing_fields')
                
                task = self._fetch_and_update_discussion(discussion_id, discussion_url, existing_data, missing_fields)
                tasks.append(task)
            
            # Execute current batch
            if tasks:
                try:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    logger.info(f"Completed batch {i//batch_size + 1}")
                    
                    # Add a small delay between batches
                    if i + batch_size < len(discussions):
                        logger.debug("Pausing between batches...")
                        await asyncio.sleep(2)
                        
                except Exception as e:
                    logger.error(f"Error in batch metadata fetch: {str(e)}")
        
        logger.info(f"Completed metadata fetch for all {len(discussions)} discussions")

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
    Schedule background metadata fetching for discussions with rate limiting.
    
    Args:
        discussions: List of discussion dictionaries
    """
    if not discussions:
        return
    
    logger.info(f"Scheduling background metadata fetch for {len(discussions)} discussions with rate limiting")
    
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
    
    logger.info("Background metadata fetch thread started with rate limiting")