from sqlalchemy import Column, Integer, String
from database.db import Base

class LifeCycleVerification(Base):
    __tablename__ = "lifecycle_verifications"

    id              = Column(Integer, primary_key=True, index=True)
    product_id      = Column(Integer)
    product_name    = Column(String)
    facility_name   = Column(String)
    report_id       = Column(Integer)
    completion_date = Column(String)   # ISO date: YYYY-MM-DD
    created_by      = Column(String)
    created_at      = Column(String)   # ISO datetime
