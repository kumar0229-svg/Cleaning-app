from database.db import Base
from sqlalchemy import Column, Float, Integer, String

class ProductStepEquipment(Base):
    __tablename__ = "product_step_equipment"
    id             = Column(Integer, primary_key=True, index=True)
    product_id     = Column(Integer, index=True)
    step_number    = Column(Integer)
    equipment_id   = Column(Integer)
    test_compound  = Column(String, nullable=True)
    usage_sequence   = Column(Integer, nullable=True)
    is_test_compound = Column(Integer, nullable=True)  # 1 = yes, 0 = no (nullable = not explicitly set)
    swab_area_sqin              = Column(Integer, nullable=True)  # swab area in square inches (2–9), default 9
    rinse_sample_area_sqin      = Column(Float, nullable=True)    # rinse sample area in square inches, default = equipment surface area
    optional_equipment_ids      = Column(String, nullable=True)   # JSON array of optional equipment IDs
    optional_swab_areas         = Column(String, nullable=True)   # JSON object {opt_eq_id: swab_area_sqin}
    optional_rinse_sample_areas = Column(String, nullable=True)   # JSON object {opt_eq_id: rinse_sample_area_sqin}
