from database.db import Base
from sqlalchemy import Column, Integer, String

class SamplingPlanEntry(Base):
    __tablename__ = "sampling_plan_entry"
    entry_id             = Column(Integer, primary_key=True, index=True)
    category_id          = Column(Integer, nullable=False)
    sample_number        = Column(String, unique=True, nullable=False)  # e.g. S-0001, never reused
    location_description = Column(String, nullable=False)
    sequence             = Column(Integer, default=0)
