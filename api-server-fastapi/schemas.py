
from pydantic import BaseModel
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

class DiscussionBase(BaseModel):
    title: str
    url: str
    repository: str
    created_at: str

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
    discussions: List[Dict[str, Any]]

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
