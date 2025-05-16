
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field

# Task schemas
class TaskState(BaseModel):
    status: str
    annotators: int
    user_annotated: Optional[bool] = None

    class Config:
        orm_mode = True

# Discussion schemas
class DiscussionBase(BaseModel):
    title: str
    url: str
    repository: str
    created_at: str

class DiscussionCreate(DiscussionBase):
    id: str

class TasksDict(BaseModel):
    task1: Optional[TaskState] = None
    task2: Optional[TaskState] = None 
    task3: Optional[TaskState] = None

class Discussion(DiscussionBase):
    id: str
    tasks: TasksDict

    class Config:
        orm_mode = True

# Annotation schemas
class AnnotationBase(BaseModel):
    discussion_id: str
    user_id: str
    task_id: int
    data: Dict[str, Any]

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(BaseModel):
    data: Dict[str, Any]

class Annotation(AnnotationBase):
    timestamp: datetime

    class Config:
        orm_mode = True

class AnnotationOverride(AnnotationBase):
    timestamp: Optional[datetime] = None

# Consensus schemas
class ConsensusOverride(BaseModel):
    discussion_id: str
    task_id: int
    data: Dict[str, Any]

# File schemas
class FileUpload(BaseModel):
    discussion_id: str
    file: bytes = Field(..., description="The file content")
    filename: str = Field(..., description="Original filename")

# Admin schemas
class GitHubDiscussionTask(BaseModel):
    status: Optional[str] = "locked"
    annotators: Optional[int] = 0

class GitHubDiscussionTasks(BaseModel):
    task1: Optional[GitHubDiscussionTask] = None
    task2: Optional[GitHubDiscussionTask] = None
    task3: Optional[GitHubDiscussionTask] = None

class GitHubDiscussion(BaseModel):
    id: str
    title: str
    url: str
    repository: Optional[str] = None
    created_at: str
    tasks: Optional[GitHubDiscussionTasks] = None

class DiscussionUpload(BaseModel):
    discussions: List[GitHubDiscussion]

class TaskStatusUpdate(BaseModel):
    discussion_id: str
    task_id: int
    status: str

class TaskManagementResult(BaseModel):
    success: bool
    message: str
    discussion: Optional[Discussion] = None

class UploadResult(BaseModel):
    success: bool
    message: str
    discussions_added: int
    errors: Optional[List[str]] = None

# Auth schemas
class GoogleToken(BaseModel):
    token: str

class AuthorizedUserBase(BaseModel):
    email: str
    role: str

class AuthorizedUserCreate(AuthorizedUserBase):
    pass

class AuthorizedUser(AuthorizedUserBase):
    id: int

    class Config:
        orm_mode = True
