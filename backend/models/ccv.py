from sqlalchemy import Column, Integer, String, Text
from database.db import Base

class ContinuousCleaningVerification(Base):
    __tablename__ = "continuous_cleaning_verifications"

    ccv_id           = Column(Integer, primary_key=True, index=True)
    archive_id       = Column(Integer)          # FK to protocol_archive (template source)
    report_id        = Column(Integer)          # FK to approved cleaning_validation_report
    facility_id      = Column(Integer)
    facility_name    = Column(String)
    product_id       = Column(Integer)
    product_name     = Column(String)
    run_number       = Column(Integer)          # sequential per product
    results_data     = Column(Text)             # JSON blob: single run + metadata
    submitted_by     = Column(String)
    submitted_at     = Column(String)
    last_modified_by = Column(String, nullable=True)
    last_modified_at = Column(String, nullable=True)
    status           = Column(String, default="Draft")  # Draft / Completed
