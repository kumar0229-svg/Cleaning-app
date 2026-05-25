from sqlalchemy import Column, Integer, String, Float, Text
from database.db import Base

class MacoRun(Base):
    __tablename__ = "maco_runs"

    run_id         = Column(Integer, primary_key=True, index=True)
    run_at         = Column(String)          # ISO timestamp
    run_by         = Column(String)
    source_product_id   = Column(Integer)
    source_product_name = Column(String)
    source_pde     = Column(Float)
    source_min_dose = Column(Float)
    source_loq     = Column(Float)
    source_lod     = Column(Float)
    source_method  = Column(String)
    governing_maco = Column(Float, nullable=True)
    result_json    = Column(Text)            # full result rows as JSON string
