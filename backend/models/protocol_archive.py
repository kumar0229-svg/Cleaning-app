from database.db import Base
from sqlalchemy import Column, Integer, String, Text

class ProtocolArchive(Base):
    __tablename__ = "protocol_archive"
    archive_id   = Column(Integer, primary_key=True, index=True)
    doc_number   = Column(String, index=True)
    version      = Column(Integer, nullable=False)
    product_id   = Column(Integer)
    product_name = Column(String)
    facility_name = Column(String)
    generated_by = Column(String)
    generated_at = Column(String)
    snapshot_json = Column(Text)          # frozen JSON — never changes
    status       = Column(String, default="Draft")   # Draft | Final
