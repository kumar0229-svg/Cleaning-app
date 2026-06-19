from sqlalchemy import Column, Integer, String, Boolean
from database.db import Base

class User(Base):
    __tablename__ = "users"

    user_id     = Column(Integer, primary_key=True, index=True)
    username    = Column(String, unique=True)
    password    = Column(String)
    role        = Column(String)
    is_archived = Column(Boolean, default=False)
    archived_by = Column(String, nullable=True)
    archived_at = Column(String, nullable=True)
    force_password_reset = Column(Boolean, default=False)

    # Password aging & lockout
    password_changed_at = Column(String, nullable=True)   # ISO timestamp
    failed_attempts     = Column(Integer, default=0)
    locked_until        = Column(String, nullable=True)   # ISO timestamp

    # Single-session enforcement
    session_token = Column(String, nullable=True)   # UUID + expiry embedded, rotated on every login
