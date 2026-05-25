from database.db import Base
from sqlalchemy import Column, Integer, String

class EquipmentCategory(Base):
    __tablename__ = "equipment_category"
    category_id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String, unique=True, nullable=False)
