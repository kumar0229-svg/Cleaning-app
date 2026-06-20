from sqlalchemy import Column, Integer, String, Float
from database.db import Base

class GenotoxicImpurity(Base):
    __tablename__ = "genotoxic_impurities"

    impurity_id       = Column(Integer, primary_key=True, index=True)
    product_id        = Column(Integer, nullable=False, index=True)
    facility_id       = Column(Integer, nullable=False, index=True)
    impurity_name     = Column(String,  nullable=False)
    pde_ug_day        = Column(Float,   nullable=False)   # PDE/ADE in μg/day
    analytical_method = Column(String,  nullable=True)
    lod_ppm           = Column(Float,   nullable=True)
    loq_ppm           = Column(Float,   nullable=True)
    # JSON array of equipment_id ints: "[1, 3, 7]"
    equipment_ids     = Column(String,  nullable=True)
    created_by        = Column(String,  nullable=True)
    created_at        = Column(String,  nullable=True)
    updated_by        = Column(String,  nullable=True)
    updated_at        = Column(String,  nullable=True)
