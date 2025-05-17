
"""
Utility functions for extracting and handling repository metadata
"""
import re
import requests
from datetime import datetime
from typing import Tuple, Dict, Optional, Any

def extract_repository_info_from_url(url: str) -> Tuple[str, Optional[str], Optional[str]]:
    """Extract repository owner and name from GitHub URL"""
    try:
        github_url_pattern = r"github\.com/([^/]+)/([^/]+)"
        match = re.search(github_url_pattern, url, re.IGNORECASE)
        if match:
            owner = match.group(1)
            repo = match.group(2)
            # Clean up repo name (remove any trailing parts)
            repo = repo.split('/')[0]
            return f"{owner}/{repo}", owner, repo
        return "unknown/repository", None, None
    except Exception:
        return "unknown/repository", None, None

def get_repository_language(owner: str, repo: str) -> Optional[str]:
    """Get primary language of a repository"""
    if not owner or not repo:
        return None
    
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            return data.get("language")
    except Exception:
        pass
    return None

def find_release_for_discussion(owner: str, repo: str, created_at: str) -> dict:
    """Find appropriate release for a discussion based on date"""
    if not owner or not repo or not created_at:
        return {}
    
    try:
        # Parse discussion creation date
        target_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        # Get releases
        url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=100"
        response = requests.get(url)
        
        if response.status_code != 200:
            return {}
        
        releases = response.json()
        
        if not releases:
            # Try tags as a fallback
            tags_url = f"https://api.github.com/repos/{owner}/{repo}/tags"
            tags_response = requests.get(tags_url)
            if tags_response.status_code == 200:
                tags = tags_response.json()
                if tags:
                    return {
                        "tag": tags[0]["name"],
                        "url": f"https://github.com/{owner}/{repo}/archive/refs/tags/{tags[0]['name']}.tar.gz"
                    }
            return {}
        
        # Find releases before the discussion date
        releases_before = []
        for release in releases:
            if not release.get("published_at"):
                continue
                
            release_date = datetime.fromisoformat(release["published_at"].replace('Z', '+00:00'))
            
            if release_date < target_date:
                releases_before.append({
                    "tag": release["tag_name"],
                    "date": release["published_at"],
                    "url": f"https://github.com/{owner}/{repo}/archive/refs/tags/{release['tag_name']}.tar.gz"
                })
        
        # Return latest release before discussion
        if releases_before:
            releases_before.sort(key=lambda x: x["date"], reverse=True)
            return releases_before[0]
            
        # Fallback: latest release overall
        latest = releases[0]
        return {
            "tag": latest["tag_name"],
            "date": latest.get("published_at"),
            "url": f"https://github.com/{owner}/{repo}/archive/refs/tags/{latest['tag_name']}.tar.gz"
        }
    except Exception:
        # If any error occurs, return default
        return {}
