
from pydantic import BaseModel, Field, ConfigDict
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
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class Discussion(DiscussionBase):
    id: str
    tasks: Dict[str, TaskState]

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        populate_by_alias=True
    )
        
# Improved schema for frontend-to-backend compatibility
class GitHubDiscussionTaskState(BaseModel):
    status: str = Field(default="unlocked")  # Changed default from locked to unlocked
    annotators: int = Field(default=0)
    userAnnotated: Optional[bool] = Field(default=None, alias="userAnnotated")
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class GitHubDiscussionTasks(BaseModel):
    task1: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="unlocked", annotators=0))
    task2: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="locked", annotators=0))
    task3: Optional[GitHubDiscussionTaskState] = Field(default_factory=lambda: GitHubDiscussionTaskState(status="locked", annotators=0))
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class GitHubDiscussion(BaseModel):
    id: Optional[str] = None  # Now optional, will be generated if not provided
    title: Optional[str] = None  # Now optional, will be generated if not provided
    url: str
    repository: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now().isoformat(), alias="created_at")
    # Metadata fields
    repositoryLanguage: Optional[str] = Field(default=None, alias="repository_language")
    releaseTag: Optional[str] = Field(default=None, alias="release_tag")
    releaseUrl: Optional[str] = Field(default=None, alias="release_url")
    releaseDate: Optional[str] = Field(default=None, alias="release_date")
    tasks: Optional[GitHubDiscussionTasks] = None
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class AnnotationBase(BaseModel):
    discussion_id: str
    user_id: str
    task_id: int
    data: Dict[str, Any]
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(BaseModel):
    data: Dict[str, Any]
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class AnnotationOverride(AnnotationBase):
    timestamp: Optional[datetime] = None
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class PodLeadAnnotationOverride(BaseModel):
    discussion_id: str
    annotator_id: str  # The ID of the annotator whose annotation is being overridden
    task_id: int
    data: Dict[str, Any]
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class Annotation(AnnotationBase):
    timestamp: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        populate_by_alias=True
    )

class ConsensusBase(BaseModel):
    discussion_id: str
    task_id: int
    data: Dict[str, Any]
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class ConsensusCreate(ConsensusBase):
    pass

class ConsensusOverride(ConsensusBase):
    pass

class Consensus(ConsensusBase):
    timestamp: datetime

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        populate_by_alias=True
    )

class AuthorizedUserBase(BaseModel):
    email: str
    role: str
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class AuthorizedUserCreate(AuthorizedUserBase):
    pass

class AuthorizedUser(AuthorizedUserBase):
    id: int

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        populate_by_alias=True
    )

class GoogleToken(BaseModel):
    token: str
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

# Update the TaskStatusUpdate to match frontend field names with proper model config
class TaskStatusUpdate(BaseModel):
    discussion_id: str = Field(alias="discussionId")
    task_id: int = Field(alias="taskId")
    status: str

    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

class DiscussionUpload(BaseModel):
    discussions: List[GitHubDiscussion]
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

# Adding the missing UploadResult schema class
class UploadResult(BaseModel):
    success: bool
    message: str
    discussions_added: int = Field(alias="discussionsAdded")
    errors: Optional[List[str]] = None

    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )

# Adding the TaskManagementResult schema class that might be needed
class TaskManagementResult(BaseModel):
    success: bool
    message: str
    discussion: Optional[Discussion] = None
    
    # Add model config for proper aliasing
    model_config = ConfigDict(
        populate_by_name=True,
        populate_by_alias=True
    )
