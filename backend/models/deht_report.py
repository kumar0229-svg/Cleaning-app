from sqlalchemy import Column, Integer, String, Text
from database.db import Base

class DEHTReport(Base):
    __tablename__ = "deht_reports"

    report_id        = Column(Integer, primary_key=True, index=True, autoincrement=True)
    archive_id       = Column(Integer, nullable=True)   # links to ProtocolArchive (DEHT-PROTO-*)
    facility_id      = Column(Integer, nullable=True)
    facility_name    = Column(String,  nullable=True)
    product_id       = Column(Integer, nullable=True)
    product_name     = Column(String,  nullable=True)
    results_data     = Column(Text,    nullable=True)   # JSON: runs with hold-time entries
    submitted_by     = Column(String,  nullable=True)
    submitted_at     = Column(String,  nullable=True)   # ISO timestamp
    created_at       = Column(String,  nullable=True)
    last_modified_by = Column(String,  nullable=True)
    last_modified_at = Column(String,  nullable=True)
    status           = Column(String,  default="Draft") # Draft / Submitted / Approved
    approved_by      = Column(String,  nullable=True)
    approved_at      = Column(String,  nullable=True)
