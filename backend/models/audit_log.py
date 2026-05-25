from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database.db import Base

class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id = Column(Integer, primary_key=True, index=True)

    event_type = Column(String)     # CREATE / UPDATE / DELETE
    entity_type = Column(String)    # FACILITY
    entity_id = Column(String)      # facility_id

    field_name = Column(String)     # facility_name
    old_value = Column(Text)
    new_value = Column(Text)

    performed_by = Column(String)   # username (later from AD)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())