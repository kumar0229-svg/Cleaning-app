from sqlalchemy import Column, Integer, String, Text
from database.db import Base

class ImpactAssessment(Base):
    __tablename__ = "impact_assessments"

    id                = Column(Integer, primary_key=True, index=True)
    product_id        = Column(Integer)
    product_name      = Column(String)
    qms_reference     = Column(String)
    change_category   = Column(String)
    change_description = Column(Text)
    created_by        = Column(String)
    created_at        = Column(String)   # ISO timestamp
