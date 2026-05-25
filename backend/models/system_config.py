from sqlalchemy import Column, String
from database.db import Base

class SystemConfig(Base):
    __tablename__ = "system_config"
    config_key   = Column(String, primary_key=True)
    config_value = Column(String)
    updated_by   = Column(String, nullable=True)
    updated_at   = Column(String, nullable=True)
