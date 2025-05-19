
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
import json

# Base class for UserSignup
class UserSignup(BaseModel):
    email: str
    password: str

# Base class for GoogleToken
class GoogleToken(BaseModel):
    token: str

# Base class for AuthorizedUser
class AuthorizedUserBase(BaseModel):
    email: str
    role: str

class AuthorizedUserCreate(AuthorizedUserBase):
    pass

class AuthorizedUser(AuthorizedUserBase):
    id: int

    model_config = {
        "from_attributes": True,  # Replaces orm_mode=True
        "populate_by_name": True  # Helps with field aliases
    }

# Batch Upload schemas
class BatchUploadBase(BaseModel):
    name: str
    description: Optional[str] = None
    created_by: Optional[str] = None

class BatchUploadCreate(BatchUploadBase):
    pass

class BatchUpload(BatchUploadBase):
    id: int
    created_at: datetime
    discussion_count: int

    model_config = {
        "from_attributes": True,  # Replaces orm_mode=True
        "populate_by_name": True  # Helps with field aliases
    }
# Task state for discussions
class TaskState(BaseModel):
    status: str
    annotators: int
    user_annotated: Optional[bool] = None
    
    model_config ={
        "from_attributes" : True,
        "schema_extra" :{
            "example": {
                "status": "unlocked",
                "annotators": 2,
                "user_annotated": True
            }
        }
    }
# Base class for Discussion
class DiscussionBase(BaseModel):
    title: str
    url: str
    repository: str
    created_at: str
    repository_language: Optional[str] = None
    release_tag: Optional[str] = None
    release_url: Optional[str] = None
    release_date: Optional[str] = None

class DiscussionCreate(DiscussionBase):
    batch_id: Optional[int] = None

class Discussion(DiscussionBase):
    id: str
    task1_status: Optional[str] = None
    task1_annotators: Optional[int] = None
    task2_status: Optional[str] = None
    task2_annotators: Optional[int] = None
    task3_status: Optional[str] = None
    task3_annotators: Optional[int] = None
    batch_id: Optional[int] = None
    tasks: Dict[str, TaskState] = {}
    annotations: Optional[Dict[str, Any]] = None  # Added this field

    model_config = {
        "from_attributes": True,  # Replaces orm_mode=True
        "populate_by_name": True  # Helps with field aliases
    }
          
    @classmethod
    def from_orm(cls, obj):
        # Get normal attributes
        data = {}
        for key, value in obj.__dict__.items():
            if key != "_sa_instance_state":
                data[key] = value
        
        # If tasks dictionary is not present but task1_status etc are, create tasks dict
        if not obj.__dict__.get("tasks") and any(f"task{i}_status" in obj.__dict__ for i in range(1, 4)):
            data["tasks"] = {}
            for i in range(1, 4):
                status_key = f"task{i}_status"
                annotators_key = f"task{i}_annotators"
                
                if status_key in data and annotators_key in data:
                    data["tasks"][str(i)] = {
                        "status": data[status_key] or "pending",
                        "annotators": data[annotators_key] or 0,
                        "user_annotated": None
                    }
        
        return cls(**data)

# Schema for task status update
class TaskStatusUpdate(BaseModel):
    discussion_id: str
    task_id: int
    status: str

# Schemas for Annotation
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
    id: int
    timestamp: datetime

    model_config = {
        "from_attributes": True,  # Replaces orm_mode=True
        "populate_by_name": True  # Helps with field aliases
    }
# Schema for annotation override by pod lead
class PodLeadAnnotationOverride(BaseModel):
    pod_lead_id: str
    annotator_id: str
    discussion_id: str
    task_id: int
    data: Dict[str, Any]

# Schema for annotation override by admin
class AnnotationOverride(BaseModel):
    discussion_id: str
    user_id: str
    task_id: int
    data: Dict[str, Any]

# Schema for consensus override
class ConsensusOverride(BaseModel):
    discussion_id: str
    task_id: int
    data: Dict[str, Any]

# Schema for GitHub Discussion upload with batch_id
class GitHubDiscussion(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    url: str
    repository: Optional[str] = None
    created_at: str = Field(..., description="ISO format date string")
    repository_language: Optional[str] = None
    release_tag: Optional[str] = None
    release_url: Optional[str] = None
    release_date: Optional[str] = None
    tasks: Optional[Dict[str, Dict[str, Any]]] = None
    batch_id: Optional[int] = None

    @validator('created_at')
    def validate_created_at(cls, v):
        try:
            # Try parsing the date to validate format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except (ValueError, TypeError):
            raise ValueError('created_at must be a valid ISO format date string')

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class DiscussionUpload(BaseModel):
    discussions: List[GitHubDiscussion]
    batch_name: Optional[str] = None
    batch_description: Optional[str] = None

    # Custom JSON serializer for the entire model
    def json(self, **kwargs):
        return json.dumps(self.dict(), default=str, **kwargs)

# Schema for batch deletion
class BatchDelete(BaseModel):
    batch_id: int

# Schema for upload result
class UploadResult(BaseModel):
    success: bool
    message: str
    discussions_added: int
    batch_id: Optional[int] = None
    errors: Optional[List[str]] = None

# Schema for task management result
class TaskManagementResult(BaseModel):
    success: bool
    message: str
    discussion: Optional[Discussion] = None

# Schema for batch management result
class BatchManagementResult(BaseModel):
    success: bool
    message: str
    batch_id: Optional[int] = None
class UserRegistration(BaseModel):
    email: str
    password: str
    role: str

# Schema for password change
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Schema for password reset by admin
class PasswordReset(BaseModel):
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]
    
# Schema for Google Token
class GoogleToken(BaseModel):
    credential: str

# Schema for login success response
class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[Dict[str, Any]] = None
    token: Optional[str] = None
