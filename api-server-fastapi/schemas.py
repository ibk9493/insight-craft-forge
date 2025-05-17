
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

class DiscussionBase(BaseModel):
    title: str
    url: str
    repository: str
    created_at: str
    # Add fields for repository metadata
    repository_language: Optional[str] = None
    release_tag: Optional[str] = None
    release_url: Optional[str] = None
    release_date: Optional[str] = None

class DiscussionCreate(DiscussionBase):
    id: str

class TaskState(BaseModel):
    status: str
    annotators: int
    userAnnotated: Optional[bool] = None

class Discussion(DiscussionBase):
    id: str
    tasks: Dict[str, TaskState]

    class Config:
        orm_mode = True
        
# Improved schema for frontend-to-backend compatibility
class GitHubDiscussionTaskState(BaseModel):
    status: str = Field(default="locked")
    annotators: int = Field(default=0)

class GitHubDiscussionTasks(BaseModel):
    task1: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="locked", annotators=0))
    task2: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="locked", annotators=0))
    task3: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="locked", annotators=0))

class GitHubDiscussion(BaseModel):
    id: Optional[str] = None  # Now optional, will be generated if not provided
    title: Optional[str] = None  # Now optional, will be generated if not provided
    url: str
    repository: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now().isoformat())
    # Metadata fields
    repositoryLanguage: Optional[str] = None
    releaseTag: Optional[str] = None
    releaseUrl: Optional[str] = None
    releaseDate: Optional[str] = None
    tasks: Optional[GitHubDiscussionTasks] = None

class AnnotationBase(BaseModel):
    discussion_id: str
    user_id: str
    task_id: int
    data: Dict[str, Any]

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(BaseModel):
    data: Dict[str, Any]

class AnnotationOverride(AnnotationBase):
    timestamp: Optional[datetime] = None

class PodLeadAnnotationOverride(BaseModel):
    discussion_id: str
    annotator_id: str  # The ID of the annotator whose annotation is being overridden
    task_id: int
    data: Dict[str, Any]

class Annotation(AnnotationBase):
    timestamp: datetime

    class Config:
        orm_mode = True

class ConsensusBase(BaseModel):
    discussion_id: str
    task_id: int
    data: Dict[str, Any]

class ConsensusCreate(ConsensusBase):
    pass

class ConsensusOverride(ConsensusBase):
    pass

class Consensus(ConsensusBase):
    timestamp: datetime

    class Config:
        orm_mode = True

class AuthorizedUserBase(BaseModel):
    email: str
    role: str

class AuthorizedUserCreate(AuthorizedUserBase):
    pass

class AuthorizedUser(AuthorizedUserBase):
    id: int

    class Config:
        orm_mode = True

class GoogleToken(BaseModel):
    token: str

class TaskStatusUpdate(BaseModel):
    discussion_id: str
    task_id: int
    status: str

class DiscussionUpload(BaseModel):
    discussions: List[GitHubDiscussion]

# Adding the missing UploadResult schema class
class UploadResult(BaseModel):
    success: bool
    message: str
    discussions_added: int
    errors: Optional[List[str]] = None

# Adding the TaskManagementResult schema class that might be needed
class TaskManagementResult(BaseModel):
    success: bool
    message: str
    discussion: Optional[Discussion] = None
