from database.db import Base
from sqlalchemy import Column, Integer, String, Boolean

class Facility(Base):
    __tablename__ = "facilities"
    facility_id = Column(Integer, primary_key=True, index=True)
    facility_name = Column(String)
