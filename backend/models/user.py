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


