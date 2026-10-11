from sqlalchemy import Column, Integer, String, Text
from database.db import Base

class ImpactAssessmentItem(Base):
    __tablename__ = "impact_assessment_items"

    id                     = Column(Integer, primary_key=True, index=True)
    impact_assessment_id   = Column(Integer, index=True)
    record_type            = Column(String)   # PROTOCOL | REPORT | CCV | DEHT
    record_id              = Column(Integer)
    record_label           = Column(String)
    record_status_snapshot = Column(String)
    impact_note            = Column(Text)
    recommendation         = Column(Text)
