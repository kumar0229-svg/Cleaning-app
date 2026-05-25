from sqlalchemy import Column, Integer
from database.db import Base

class ProductEquipment(Base):
    __tablename__ = "product_equipment"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, index=True)
    equipment_id = Column(Integer, index=True)