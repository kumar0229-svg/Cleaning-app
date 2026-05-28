from sqlalchemy import Column, Integer, String
from database.db import Base

class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id           = Column(Integer, primary_key=True, index=True)
    username     = Column(String, nullable=False)
    requested_at = Column(String, nullable=False)
    status       = Column(String, default="pending")   # pending / approved / rejected
    handled_by   = Column(String, nullable=True)
    handled_at   = Column(String, nullable=True)
