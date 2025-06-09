from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
import json

# Base class for UserSignup
class UserSignup(BaseModel):
    email: str
    password: str

# Base class for GoogleToken
# class GoogleToken(BaseModel): # Defined later, remove duplicate
#     token: str
class Task3ConsensusData(BaseModel):
    """Optional: Explicit schema for Task 3 consensus data"""
    classify: Optional[str] = None
    short_answer_list: Optional[List[str]] = None
    longAnswer_text: Optional[str] = None
    supporting_docs_available: Optional[bool] = None
    
    model_config = {
        "from_attributes": True
    }
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
        "from_attributes": True,
        "populate_by_name": True
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
    # New fields from importable json
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    knowledge: Optional[str] = None
    code: Optional[str] = None

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
    annotations: Optional[Dict[str, Any]] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True
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

# Schemas for Annotation (General Purpose)
class AnnotationBase(BaseModel):
    discussion_id: str
    user_id: str # In this context, this is the user who created the annotation
    task_id: int
    data: Dict[str, Any]

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationUpdate(BaseModel):
    data: Dict[str, Any]

class Annotation(AnnotationBase):
    id: int
    timestamp: datetime
    pod_lead_email: Optional[str] = None 
    model_config = {
        "from_attributes": True,
        "populate_by_name": True
    }

# --- START: Schemas for ConsensusAnnotation ---
class ConsensusAnnotationData(BaseModel):
    relevance: bool
    relevance_text: Optional[str] = None
    learning: bool
    learning_text: Optional[str] = None
    clarity: bool
    clarity_text: Optional[str] = None
    grounded: bool
    grounded_text: Optional[str] = None
    stars: int = Field(..., ge=0, le=5) # Example: stars between 0 and 5
    comment: Optional[str] = None
    # _last_updated: Optional[datetime] = None

    model_config = {
        "from_attributes": True,
         "json_schema_extra": { # Renamed from schema_extra for Pydantic v2
            "example": {
                "relevance": True,
                "relevance_text": "This is highly relevant.",
                "learning": True,
                "learning_text": "Learned a new approach.",
                "clarity": False,
                "clarity_text": "The explanation was a bit vague.",
                "grounded": True,
                "grounded_text": "References provided are solid.",
                "stars": 4,
                "comment": "Overall good, but clarity could be improved."
            }
        }
    }

class ConsensusAnnotationBase(BaseModel):
    discussion_id: str
    # 'user_id' from payload will be mapped to 'annotator_id'
    annotator_id: str = Field(alias="user_id")
    task_id: int
    data: Dict[str, Any]

class PaginatedDiscussionResponse(BaseModel):
    items: List[Discussion]
    total: int
    page: int
    per_page: int
    pages: int

class TrainerBreakdown(BaseModel):
    trainer_id: int
    trainer_email: str  # Add this field
    total_annotations: int
    task1_count: int
    task2_count: int
    task3_count: int

class ConsensusAnnotationCreate(ConsensusAnnotationBase):
    pass

class ConsensusAnnotationResponse(ConsensusAnnotationBase):
    id: int
    # This 'user_id' is the ID of the user who saved/updated the consensus (from auth token)
    user_id: str
    # 'annotator_id' is inherited from ConsensusAnnotationBase and comes from payload's 'user_id'
    timestamp: datetime
    # The 'data' field inherited from ConsensusAnnotationBase will be used.
    # The service layer will ensure 'data._last_updated' is populated before sending response.

    model_config = {
        "from_attributes": True,
        "populate_by_name": True # Ensures aliases are handled if needed for response too
    }
# --- END: Schemas for ConsensusAnnotation ---


# Schema for annotation override by pod lead
class PodLeadAnnotationOverride(BaseModel):
    pod_lead_id: str
    annotator_id: str # This refers to the original annotator whose work is being overridden
    discussion_id: str
    task_id: int
    data: Dict[str, Any] # TBA: Should this be ConsensusAnnotationData or a generic Dict?

# Schema for annotation override by admin
class AnnotationOverride(BaseModel):
    discussion_id: str
    user_id: str # TBA: The user whose annotation is being overridden or the admin performing it?
    task_id: int
    data: Dict[str, Any] # Again, consider specific data schema?

# Schema for consensus override
class ConsensusOverride(BaseModel):
    discussion_id: str
    task_id: int
    data: Dict[str, Any] # TBA: Consider specific data schema, perhaps ConsensusAnnotationData

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
    # New fields from json
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    knowledge: Optional[str] = None
    code: Optional[str] = None
    lang: Optional[str] = None

    @validator('created_at')
    def validate_created_at(cls, v):
        if isinstance(v, datetime): # Allow datetime objects directly
            return v.isoformat() + 'Z' # Convert to ISO string format expected
        try:
            # Try parsing the date to validate format
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except (ValueError, TypeError):
            raise ValueError('created_at must be a valid ISO format date string')

    model_config = { # Replaces class Config for Pydantic v2
        "json_encoders": {
            datetime: lambda dt: dt.isoformat()
        }
    }

class DiscussionUpload(BaseModel):
    discussions: List[GitHubDiscussion]
    batch_name: Optional[str] = None
    batch_description: Optional[str] = None

    # Custom JSON serializer for the entire model
    def model_dump_json(self, **kwargs): # Pydantic v2 method
        return json.dumps(self.model_dump(), default=str, **kwargs) # Use model_dump()

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

class BulkTaskStatusUpdate(BaseModel):
    discussion_ids: List[str]
    task_id: int
    status: str

class BulkTaskManagementResult(BaseModel):
    results: List[TaskManagementResult]

# Schema for returning user details by ID
class UserResponse(BaseModel):
    id: str # Keep as string to match frontend User interface
    email: str
    username: str # Will be populated with email
    role: str

    model_config = {
        "from_attributes": True
    }

class UserPublicResponse(BaseModel):
    id: str
    username: str

    model_config = {
        "from_attributes": True
    }

# Discussion Schemas
class FilterOptionsResponse(BaseModel):
    repository_languages: List[str]
    release_tags: List[str]
    batches: List[Dict[str, Any]]
    date_range: Dict[str, Optional[str]]
    
    model_config = {
        "from_attributes": True
    }

class TeamMemberSummary(BaseModel):
    user_id: str
    email: str
    total_annotations: int
    agreement_rate: float
    status: str
    last_activity: Optional[str] = None

class TeamPerformanceSummary(BaseModel):
    total_annotations: int
    average_agreement_rate: float
    users_needing_attention: List[TeamMemberSummary]
    team_size: int

class WorkflowStatus(BaseModel):
    discussions_ready_for_review: int
    pending_consensus: int

class PodLeadSummaryResponse(BaseModel):
    team_members: List[TeamMemberSummary]
    team_performance: TeamPerformanceSummary
    workflow_status: WorkflowStatus
    generated_at: str

    model_config = {
        "from_attributes": True
    }

class TeamPerformanceResponse(BaseModel):
    team_members: List[TeamMemberSummary]
    performance_summary: Dict[str, Any]
    top_performers: List[TeamMemberSummary]
    attention_needed: List[TeamMemberSummary]

    model_config = {
        "from_attributes": True
    }

class DiscussionForReview(BaseModel):
    discussion_id: str
    title: str
    priority: str
    issues: List[str]
    url: str
    repository: str

class DiscussionsForReviewResponse(BaseModel):
    items: List[DiscussionForReview]
    total: int
    page: int
    per_page: int
    pages: int

    model_config = {
        "from_attributes": True
    }
