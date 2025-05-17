
"""
Utility functions for making HTTP requests to GitHub API
"""

import requests
import os
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

def get_github_headers() -> Dict[str, str]:
    """Get headers for GitHub API requests with token if available"""
    headers = {
        "Accept": "application/vnd.github.v3+json"
    }
    
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"token {github_token}"
        
    return headers

def get_repository_info(owner: str, repo: str) -> Optional[Dict[str, Any]]:
    """Get basic information about a GitHub repository"""
    headers = get_github_headers()
    url = f"https://api.github.com/repos/{owner}/{repo}"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None

def get_repository_releases(owner: str, repo: str) -> List[Dict[str, Any]]:
    """Get releases for a GitHub repository"""
    headers = get_github_headers()
    url = f"https://api.github.com/repos/{owner}/{repo}/releases?per_page=100"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception:
        return []

def get_repository_tags(owner: str, repo: str) -> List[Dict[str, Any]]:
    """Get tags for a GitHub repository (fallback if no releases)"""
    headers = get_github_headers()
    url = f"https://api.github.com/repos/{owner}/{repo}/tags"
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception:
        return []

def find_release_for_date(
    owner: str, 
    repo: str, 
    target_date: datetime
) -> Tuple[Optional[Dict[str, Any]], bool]:
    """
    Find the most appropriate release for a given date
    
    Args:
        owner: Repository owner
        repo: Repository name
        target_date: Target date to find release for
        
    Returns:
        tuple: (release info, is_before_date)
        - release info: Dict with tag, url, date or None if not found
        - is_before_date: True if found release is before target_date
    """
    releases = get_repository_releases(owner, repo)
    
    if not releases:
        # Try tags as fallback
        tags = get_repository_tags(owner, repo)
        if tags:
            return {
                "tag": tags[0]["name"],
                "url": f"https://github.com/{owner}/{repo}/archive/refs/tags/{tags[0]['name']}.tar.gz",
                "date": None
            }, False
        
        # If no tags either, return master/main branch
        return {
            "tag": "main",
            "url": f"https://github.com/{owner}/{repo}/archive/refs/heads/main.tar.gz",
            "date": None
        }, False
    
    # Find releases before target date
    releases_before = []
    all_releases = []
    
    for release in releases:
        if not release.get("published_at"):
            continue
            
        try:
            release_date = datetime.fromisoformat(
                release["published_at"].replace('Z', '+00:00')
            )
            
            release_info = {
                "tag": release["tag_name"],
                "date": release["published_at"],
                "url": f"https://github.com/{owner}/{repo}/archive/refs/tags/{release['tag_name']}.tar.gz"
            }
            
            all_releases.append(release_info)
            
            if release_date <= target_date:
                releases_before.append(release_info)
        except:
            continue
    
    # Return latest release before discussion
    if releases_before:
        releases_before.sort(key=lambda x: x["date"], reverse=True)
        return releases_before[0], True
        
    # Fallback: latest release overall
    if all_releases:
        all_releases.sort(key=lambda x: x["date"], reverse=True)
        return all_releases[0], False
        
    # If no releases found, default to main branch
    return {
        "tag": "main",
        "url": f"https://github.com/{owner}/{repo}/archive/refs/heads/main.tar.gz",
        "date": None
    }, False
