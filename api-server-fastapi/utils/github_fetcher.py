"""
Asynchronous GitHub data fetcher for missing discussion metadata.
Based on the logic from script.py but optimized for async operations.
"""
import aiohttp
import asyncio
import re
import os
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)

class GitHubFetcher:
    """Async GitHub API client for fetching discussion metadata"""
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize GitHub fetcher with optional token.
        
        Args:
            token: GitHub personal access token for higher rate limits
        """
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.base_url = "https://api.github.com"
        self.headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"
    
    async def parse_discussion_url(self, url: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Parse a GitHub discussion URL to extract owner, repo, and discussion number.
        
        Args:
            url: GitHub discussion URL
        
        Returns:
            tuple: (owner, repo, discussion_number, error_message)
        """
        try:
            pattern = r'https://github\.com/([^/]+)/([^/]+)/discussions/(\d+)'
            match = re.match(pattern, url)
            
            if not match:
                return None, None, None, "Invalid GitHub discussion URL format"
            
            return match.groups()[0], match.groups()[1], match.groups()[2], None
        except Exception as e:
            return None, None, None, f"Exception when parsing URL: {str(e)}"
    
    async def get_discussion_date(self, owner: str, repo: str, discussion_number: str) -> Tuple[Optional[datetime], Optional[str]]:
        """
        Extract the date a GitHub discussion was posted using the GitHub API.
        
        Args:
            owner: Repository owner
            repo: Repository name
            discussion_number: Discussion number
        
        Returns:
            tuple: (discussion_date, error_message)
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/discussions/{discussion_number}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        error_msg = error_data.get('message', 'No error message provided')
                        logger.error(f"Error fetching discussion: {response.status} - {error_msg}")
                        return None, error_msg
                    
                    data = await response.json()
                    created_at = data.get("created_at")
                    
                    if not created_at:
                        return None, "Could not find discussion creation date"
                    
                    # Parse ISO format date
                    discussion_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    # Remove timezone info to make it compatible with database storage
                    discussion_date = discussion_date.replace(tzinfo=None)
                    return discussion_date, None
        
        except Exception as e:
            error_msg = f"Exception when fetching discussion: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    async def get_repo_language(self, owner: str, repo: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Get the primary programming language of a GitHub repository.
        
        Args:
            owner: Repository owner
            repo: Repository name
        
        Returns:
            tuple: (primary_language, error_message)
        """
        url = f"{self.base_url}/repos/{owner}/{repo}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        error_msg = error_data.get('message', 'No error message provided')
                        logger.error(f"Error fetching repository info: {response.status} - {error_msg}")
                        return None, error_msg
                    
                    data = await response.json()
                    primary_language = data.get("language")
                    
                    if not primary_language:
                        return None, "Could not determine primary language"
                    
                    return primary_language, None
        
        except Exception as e:
            error_msg = f"Exception when fetching repository language: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

    async def get_release_for_discussion(self, owner: str, repo: str, target_date: datetime) -> Tuple[Optional[Dict[str, Any]], Optional[str], bool]:
        """
        Get the appropriate release for a discussion:
        1. First try to get the latest release before the discussion date
        2. If none exist, fallback to the latest release overall
        
        Args:
            owner: Repository owner
            repo: Repository name
            target_date: The discussion date
        
        Returns:
            tuple: (release_info, error_message, is_before_discussion)
        """
        url = f"{self.base_url}/repos/{owner}/{repo}/releases?per_page=100"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=self.headers) as response:
                    if response.status != 200:
                        error_data = await response.json()
                        error_msg = error_data.get('message', 'No error message provided')
                        logger.error(f"Error fetching releases: {response.status} - {error_msg}")
                        return None, error_msg, False
                    
                    releases = await response.json()
                    
                    if not releases:
                        return None, "No releases found for this repository", False
                    
                    # Process all releases and categorize them
                    all_releases = []
                    releases_before = []
                    
                    for release in releases:
                        release_date_str = release.get("published_at")
                        if not release_date_str:
                            continue
                        
                        release_date = datetime.fromisoformat(release_date_str.replace('Z', '+00:00'))
                        # Remove timezone info to make it compatible with database storage
                        release_date = release_date.replace(tzinfo=None)
                        
                        release_info = {
                            'tag': release.get('tag_name'),
                            'name': release.get('name'),
                            'date': release_date,
                            'date_str': release_date_str,
                            'url': release.get('html_url')
                        }
                        
                        all_releases.append(release_info)
                        
                        # Also keep track of releases before the discussion date
                        if release_date < target_date:
                            releases_before.append(release_info)
                    
                    # First try: latest release before the discussion date
                    if releases_before:
                        # Sort by date (most recent first)
                        releases_before.sort(key=lambda x: x['date'], reverse=True)
                        return releases_before[0], None, True
                    
                    # Fallback: latest release overall, regardless of date
                    if all_releases:
                        # Sort by date (most recent first)
                        all_releases.sort(key=lambda x: x['date'], reverse=True)
                        latest_release = all_releases[0]
                        # Check if it's before or after the discussion
                        is_before = latest_release['date'] < target_date
                        return latest_release, None, is_before
                    
                    return None, "No valid releases found with dates", False
        
        except Exception as e:
            error_msg = f"Exception when fetching releases: {str(e)}"
            logger.error(error_msg)
            return None, error_msg, False

    async def fetch_missing_metadata(self, discussion_url: str, existing_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch missing GitHub metadata for a discussion.
        
        Args:
            discussion_url: GitHub discussion URL
            existing_data: Dictionary with existing discussion data
        
        Returns:
            Dictionary with fetched metadata (empty if URL is invalid or errors occur)
        """
        logger.info(f"Fetching missing metadata for: {discussion_url}")
        metadata = {}
        
        # Parse the discussion URL
        owner, repo, discussion_number, url_error = await self.parse_discussion_url(discussion_url)
        
        if url_error:
            logger.warning(f"URL parsing error for {discussion_url}: {url_error}")
            return metadata
        
        # Fetch repository language if missing
        if not existing_data.get('repository_language'):
            language, lang_error = await self.get_repo_language(owner, repo)
            if language:
                metadata['repository_language'] = language
                logger.info(f"Fetched language: {language}")
            elif lang_error:
                logger.warning(f"Could not fetch language: {lang_error}")
        
        # Fetch discussion date for release matching if we need release info
        discussion_date = None
        if not existing_data.get('release_tag') or not existing_data.get('release_url'):
            # Try to parse existing created_at date first
            if existing_data.get('created_at'):
                try:
                    discussion_date = datetime.fromisoformat(existing_data['created_at'].replace('Z', '+00:00'))
                    discussion_date = discussion_date.replace(tzinfo=None)
                except Exception:
                    pass
            
            # If we couldn't parse existing date, fetch it from GitHub
            if not discussion_date:
                discussion_date, date_error = await self.get_discussion_date(owner, repo, discussion_number)
                if date_error:
                    logger.warning(f"Could not fetch discussion date: {date_error}")
        
        # Fetch release information if missing and we have a discussion date
        if discussion_date and (not existing_data.get('release_tag') or not existing_data.get('release_url')):
            release, release_error, is_before = await self.get_release_for_discussion(owner, repo, discussion_date)
            if release:
                if not existing_data.get('release_tag'):
                    metadata['release_tag'] = release['tag']
                if not existing_data.get('release_url'):
                    metadata['release_url'] = release['url']
                if not existing_data.get('release_date'):
                    metadata['release_date'] = release['date'].strftime('%Y-%m-%d %H:%M:%S') if release.get('date') else None
                logger.info(f"Fetched release: {release['tag']}")
            elif release_error:
                logger.warning(f"Could not fetch release info: {release_error}")
        
        return metadata

# Global fetcher instance
_github_fetcher = None

def get_github_fetcher() -> GitHubFetcher:
    """Get or create a global GitHub fetcher instance"""
    global _github_fetcher
    if _github_fetcher is None:
        _github_fetcher = GitHubFetcher()
    return _github_fetcher

async def fetch_github_metadata_async(discussion_url: str, existing_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convenience function to fetch GitHub metadata asynchronously.
    
    Args:
        discussion_url: GitHub discussion URL
        existing_data: Dictionary with existing discussion data
    
    Returns:
        Dictionary with fetched metadata
    """
    fetcher = get_github_fetcher()
    return await fetcher.fetch_missing_metadata(discussion_url, existing_data) 