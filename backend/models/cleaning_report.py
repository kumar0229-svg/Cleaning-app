from sqlalchemy import Column, Integer, String, Text, ForeignKey
from database.db import Base

class CleaningValidationReport(Base):
    __tablename__ = "cleaning_validation_reports"

    report_id          = Column(Integer, primary_key=True, index=True)
    archive_id         = Column(Integer, ForeignKey("protocol_archive.archive_id"))
    facility_id        = Column(Integer)
    facility_name      = Column(String)
    product_id         = Column(Integer)
    product_name       = Column(String)
    results_data       = Column(Text)           # JSON blob: runs, equipment_results, training, sop
    submitted_by       = Column(String)
    submitted_at       = Column(String)         # ISO timestamp
    last_modified_by   = Column(String, nullable=True)
    last_modified_at   = Column(String, nullable=True)  # ISO timestamp
    created_at         = Column(String)
    status             = Column(String, default="Submitted")  # Submitted / Approved
    approved_by        = Column(String, nullable=True)
    approved_at        = Column(String, nullable=True)
