from database.db import Base
from sqlalchemy import Column, Integer, String, Float, Boolean

class Equipment(Base):
    __tablename__ = "equipment"
    equipment_id = Column(Integer, primary_key=True, index=True)
    equipment_name = Column(String)
    facility_id = Column(Integer)
    surface_area_cm2 = Column(Float)
    rinse_volume_liters = Column(Float, default=0.0)
    category_id = Column(Integer, nullable=True)
