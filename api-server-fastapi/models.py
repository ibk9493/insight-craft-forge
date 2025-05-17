from sqlalchemy import Column, String, Integer, Boolean, JSON, ForeignKey, DateTime, Table, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from database import Base

# Task status associations table
discussion_task_association = Table(
    'discussion_task_association',
    Base.metadata,
    Column('discussion_id', String, ForeignKey('discussions.id'), primary_key=True),
    Column('task_number', Integer, primary_key=True),
    Column('status', String, default='locked'),
    Column('annotators', Integer, default=0)
)

class Discussion(Base):
    __tablename__ = "discussions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    repository = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    
    # Add repository metadata fields
    repository_language = Column(String, nullable=True)
    release_tag = Column(String, nullable=True)
    release_url = Column(String, nullable=True)
    release_date = Column(String, nullable=True)
    
    # Relationships
    annotations = relationship("Annotation", back_populates="discussion")
    consensus_annotations = relationship("ConsensusAnnotation", back_populates="discussion")

class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    discussion_id = Column(String, ForeignKey("discussions.id"), nullable=False)
    user_id = Column(String, nullable=False)
    task_id = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    discussion = relationship("Discussion", back_populates="annotations")
    
    # Unique constraint to ensure one annotation per user per task per discussion
    __table_args__ = (
        UniqueConstraint('discussion_id', 'user_id', 'task_id', name='uix_annotation'),
    )

class ConsensusAnnotation(Base):
    __tablename__ = "consensus_annotations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    discussion_id = Column(String, ForeignKey("discussions.id"), nullable=False)
    task_id = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    discussion = relationship("Discussion", back_populates="consensus_annotations")
    
    # Unique constraint to ensure one consensus per task per discussion
    __table_args__ = (
        UniqueConstraint('discussion_id', 'task_id', name='uix_consensus'),
    )

class AuthorizedUser(Base):
    __tablename__ = "authorized_users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    role = Column(String, nullable=False)  # 'annotator', 'pod_lead', or 'admin'
