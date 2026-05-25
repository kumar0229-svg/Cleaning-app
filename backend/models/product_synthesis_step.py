from database.db import Base
from sqlalchemy import Column, Integer, String, Float

class ProductSynthesisStep(Base):
    __tablename__ = "product_synthesis_steps"
    step_id          = Column(Integer, primary_key=True, index=True)
    product_id       = Column(Integer, index=True)
    step_number      = Column(Integer)
    step_name        = Column(String, nullable=True)
    iupac_name       = Column(String, nullable=True)
    soluble_solvent  = Column(String, nullable=True)
    solubility_usp   = Column(Integer, nullable=True)
    analytical_method = Column(String, nullable=True)
    lod_ppm          = Column(Float, nullable=True)
    loq_ppm          = Column(Float, nullable=True)
