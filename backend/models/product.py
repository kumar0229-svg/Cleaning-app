from database.db import Base
from sqlalchemy import Column, Integer, String, Float, Boolean

class Product(Base):
    __tablename__ = "products"
    product_id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, index=True)
    facility_id = Column(Integer, index=True)
    min_therapeutic_dose_mg = Column(Float)
    max_daily_dose_mg = Column(Float)
    pde_mg_day = Column(Float)
    min_yield_kg = Column(Float, default=0.0)
    max_batch_size_kg = Column(Float, default=0.0)
    lod_ppm = Column(Float, default=0.0)
    loq_ppm = Column(Float, default=0.0)
    analytical_method = Column(String, default="")
    solubility_usp = Column(Integer, nullable=True)
    soluble_solvent = Column(String, nullable=True)
    product_category = Column(String, nullable=True)
    product_attribute = Column(String, nullable=True)
    cas_number = Column(String, nullable=True)
    chemical_number = Column(String, nullable=True)
    final_product_id = Column(Integer, nullable=True)
    therapeutic_category    = Column(String, nullable=True)
    route_of_administration = Column(String, nullable=True)
    is_archived = Column(Boolean, default=False)
    archived_by = Column(String, nullable=True)
    archived_at = Column(String, nullable=True)
