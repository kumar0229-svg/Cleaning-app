from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from database.db import Base

class MacoResult(Base):
    __tablename__ = "maco_results"

    result_id = Column(Integer, primary_key=True, index=True)
    calc_id = Column(String, index=True)

    product_from = Column(String)
    product_to = Column(String)
    equipment_id = Column(String)

    method = Column(String)
    maco_ug = Column(Float)
    limit_ugcm2 = Column(Float)

    is_governing = Column(Boolean)
    calculated_by = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())