from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import text
from jose import jwt, JWTError
import bcrypt as _bcrypt
import uuid
import json
import os
import time
import datetime
import logging
import requests as http_requests

# ── File logging ────────────────────────────────────────────────────
_LOG_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(_LOG_DIR, exist_ok=True)
_log_file = os.path.join(_LOG_DIR, f"app_{datetime.date.today().isoformat()}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(_log_file, encoding="utf-8"),
        logging.StreamHandler(),          # keep terminal output too
    ]
)
logger = logging.getLogger("cleaning_app")

# Load .env file from the backend directory
_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

# ── Security ────────────────────────────────────────────────────────
JWT_SECRET    = os.environ.get("JWT_SECRET", "change-this-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_H  = 8
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.environ.get("OLLAMA_MODEL", "llama3.2")

def call_ollama(prompt: str) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    resp = http_requests.post(url, json=payload, timeout=(10, 300))
    resp.raise_for_status()
    return resp.json()["response"]

from models.user import User
from database.db import Base, engine, SessionLocal, _is_sqlite
from models.facility import Facility
from models.equipment import Equipment
from models.product import Product
from models.product_equipment import ProductEquipment
from models.maco_result import MacoResult
from models.maco_run import MacoRun
from models.audit_log import AuditLog
from models.system_config import SystemConfig
from models.equipment_category import EquipmentCategory
from models.protocol_archive import ProtocolArchive
from models.sampling_plan_entry import SamplingPlanEntry
from models.product_synthesis_step import ProductSynthesisStep
from models.product_step_equipment import ProductStepEquipment
from models.cleaning_report import CleaningValidationReport
from models.ccv import ContinuousCleaningVerification
from models.lifecycle_verification import LifeCycleVerification
from roles_config import ROLES_CAN_VIEW, ROLES_CAN_EDIT, ROLES_CAN_DELETE, ROLES_CAN_VIEW_AUDIT, ROLES_CAN_MANAGE_USERS, ROLES_CAN_MANAGE_POLICY

app = FastAPI(title="Cleaning Carryover Limit Estimator")

# ===================================================
# CORS
# ===================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================================================
# INTEGRITY CHECK
# ===================================================
def _integrity_check():
    db = SessionLocal()
    issues = []
    try:
        # ProductEquipment rows pointing to non-existent products
        orphan_pe_products = db.execute(text(
            "SELECT pe.product_id FROM product_equipment pe "
            "LEFT JOIN products p ON pe.product_id = p.product_id "
            "WHERE p.product_id IS NULL"
        )).fetchall()
        if orphan_pe_products:
            ids = [r[0] for r in orphan_pe_products]
            issues.append(f"ProductEquipment rows with missing product_id: {ids}")

        # ProductEquipment rows pointing to non-existent equipment
        orphan_pe_equip = db.execute(text(
            "SELECT pe.equipment_id FROM product_equipment pe "
            "LEFT JOIN equipment e ON pe.equipment_id = e.equipment_id "
            "WHERE e.equipment_id IS NULL"
        )).fetchall()
        if orphan_pe_equip:
            ids = [r[0] for r in orphan_pe_equip]
            issues.append(f"ProductEquipment rows with missing equipment_id: {ids}")

        # Equipment rows pointing to non-existent facilities
        orphan_equip = db.execute(text(
            "SELECT e.equipment_id FROM equipment e "
            "LEFT JOIN facilities f ON e.facility_id = f.facility_id "
            "WHERE f.facility_id IS NULL"
        )).fetchall()
        if orphan_equip:
            ids = [r[0] for r in orphan_equip]
            issues.append(f"Equipment rows with missing facility_id: {ids}")

        # Products pointing to non-existent facilities
        orphan_products = db.execute(text(
            "SELECT p.product_id FROM products p "
            "LEFT JOIN facilities f ON p.facility_id = f.facility_id "
            "WHERE f.facility_id IS NULL"
        )).fetchall()
        if orphan_products:
            ids = [r[0] for r in orphan_products]
            issues.append(f"Product rows with missing facility_id: {ids}")

    except Exception as e:
        logger.error(f"Integrity check failed to run: {e}")
        return
    finally:
        db.close()

    if issues:
        logger.warning("Data inconsistencies detected:")
        for issue in issues:
            logger.warning(f"  {issue}")
    else:
        logger.info("Integrity check OK — no data inconsistencies found.")


# ===================================================
# STARTUP
# ===================================================
@app.on_event("startup")
def startup():
    # Backup DB before any migrations run (SQLite only)
    if _is_sqlite:
        try:
            import backup_db
            backup_db.run_backup()
        except Exception as _e:
            logger.warning(f"Startup backup failed: {_e}")

    Base.metadata.create_all(bind=engine)

    # SQLite-only ALTER TABLE migrations (columns already declared in models for fresh installs)
    _sqlite_migrations = [
        "ALTER TABLE products ADD COLUMN is_archived INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN archived_by TEXT",
        "ALTER TABLE products ADD COLUMN archived_at TEXT",
        "ALTER TABLE products ADD COLUMN solubility_usp INTEGER",
        "ALTER TABLE products ADD COLUMN soluble_solvent TEXT",
        "ALTER TABLE users ADD COLUMN is_archived INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN archived_by TEXT",
        "ALTER TABLE users ADD COLUMN archived_at TEXT",
        "ALTER TABLE users ADD COLUMN force_password_reset INTEGER DEFAULT 0",
        "ALTER TABLE equipment ADD COLUMN category_id INTEGER",
        "ALTER TABLE products ADD COLUMN product_category TEXT",
        "ALTER TABLE products ADD COLUMN product_attribute TEXT",
        "ALTER TABLE products ADD COLUMN cas_number TEXT",
        "ALTER TABLE products ADD COLUMN chemical_number TEXT",
        "ALTER TABLE products ADD COLUMN final_product_id INTEGER",
    ]
    # Performance indexes — standard SQL, run on both SQLite and PostgreSQL
    _index_migrations = [
        "CREATE INDEX IF NOT EXISTS idx_products_facility    ON products(facility_id)",
        "CREATE INDEX IF NOT EXISTS idx_products_archived    ON products(is_archived)",
        "CREATE INDEX IF NOT EXISTS idx_products_name        ON products(product_name)",
        "CREATE INDEX IF NOT EXISTS idx_pe_product           ON product_equipment(product_id)",
        "CREATE INDEX IF NOT EXISTS idx_pe_equipment         ON product_equipment(equipment_id)",
        "CREATE INDEX IF NOT EXISTS idx_equipment_facility   ON equipment(facility_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_entity         ON audit_log(entity_type, entity_id)",
    ]
    migrations = (_sqlite_migrations if _is_sqlite else []) + _index_migrations
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass

    # Column additions that must run on both SQLite and PostgreSQL
    _new_columns = [
        ("cleaning_validation_reports", "status",      "TEXT DEFAULT 'Submitted'"),
        ("cleaning_validation_reports", "approved_by", "TEXT"),
        ("cleaning_validation_reports", "approved_at", "TEXT"),
        ("products", "product_category",       "TEXT"),
        ("products", "product_attribute",      "TEXT"),
        ("products", "cas_number",             "TEXT"),
        ("products", "chemical_number",        "TEXT"),
        ("products", "final_product_id",       "INTEGER"),
        ("products", "therapeutic_category",   "TEXT"),
        ("products", "route_of_administration","TEXT"),
        ("product_step_equipment", "usage_sequence",   "INTEGER"),
        ("product_step_equipment", "is_test_compound", "INTEGER"),
        ("product_step_equipment", "swab_area_sqin",              "INTEGER DEFAULT 9"),
        ("product_step_equipment", "rinse_sample_area_sqin",     "REAL DEFAULT 9"),
        ("product_step_equipment", "optional_equipment_ids",     "TEXT"),
        ("product_step_equipment", "optional_swab_areas",        "TEXT"),
        ("product_step_equipment", "optional_rinse_sample_areas","TEXT"),
        ("product_synthesis_steps", "analytical_method", "TEXT"),
        ("product_synthesis_steps", "lod_ppm",           "FLOAT"),
        ("product_synthesis_steps", "loq_ppm",           "FLOAT"),
    ]
    with engine.connect() as conn:
        for table, col, col_def in _new_columns:
            try:
                if _is_sqlite:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}"))
                else:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_def}"))
                conn.commit()
            except Exception:
                pass

    # One-time migration: hash any plain-text passwords
    db = SessionLocal()
    try:
        for u in db.query(User).all():
            if u.password and not u.password.startswith("$2"):
                u.password = hash_password(u.password)
        db.commit()
    finally:
        db.close()

    # Seed default policy if not present
    db = SessionLocal()
    try:
        if not db.query(SystemConfig).filter(SystemConfig.config_key == "maco_policy").first():
            db.add(SystemConfig(config_key="maco_policy", config_value="all_min",
                                updated_by="system", updated_at=datetime.datetime.utcnow().isoformat()))
            db.commit()
    finally:
        db.close()

    db = SessionLocal()
    try:
        if not db.query(SystemConfig).filter(SystemConfig.config_key == "verification_interval_years").first():
            db.add(SystemConfig(config_key="verification_interval_years", config_value="3",
                                updated_by="system", updated_at=datetime.datetime.utcnow().isoformat()))
            db.commit()
    finally:
        db.close()

    # Seed default equipment categories (idempotent)
    _DEFAULT_CATEGORIES = [
        "Reactor",
        "Agitated Nutsche Filter Drier",
        "Sifter",
        "Multi Mill",
    ]
    db = SessionLocal()
    try:
        for name in _DEFAULT_CATEGORIES:
            if not db.query(EquipmentCategory).filter(EquipmentCategory.category_name == name).first():
                db.add(EquipmentCategory(category_name=name))
        db.commit()
    finally:
        db.close()

    # Data integrity check — log warnings for any FK inconsistencies
    _integrity_check()

# ===================================================
# DB SESSION
# ===================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ===================================================
# AUTH — JWT Bearer
# ===================================================
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload  = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.username == username).first()
    if not user or user.is_archived:
        raise HTTPException(status_code=401, detail="User not found or account disabled")
    return user

# ===================================================
# ROLE CHECK
# ===================================================
def check_role(user_role, allowed_roles):
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access Denied")

# ===================================================
# AUDIT FUNCTION
# ===================================================
def log_audit(db, event_type, entity_type, entity_id,
              field_name, old_value, new_value, user):
    log = AuditLog(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id),
        field_name=field_name,
        old_value=str(old_value),
        new_value=str(new_value),
        performed_by=user
    )
    db.add(log)
    db.commit()

# ===================================================
# ROOT / HEALTH
# ===================================================
@app.get("/")
def root():
    return {"status": "API running successfully"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ===================================================
# FACILITY MASTER
# ===================================================
class FacilityRequest(BaseModel):
    facility_name: str
    password: str

@app.post("/facility/add")
def add_facility(
    req: FacilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    name = req.facility_name.strip()

    existing = db.query(Facility).filter(Facility.facility_name == name).first()
    if existing:
        return {"message": "Facility already exists", "facility_id": existing.facility_id}

    f = Facility(facility_name=name)
    db.add(f)
    db.commit()
    db.refresh(f)

    log_audit(db, "CREATE", "FACILITY", f.facility_id,
              "facility_name", "", name, current_user.username)

    return {"message": "Facility added", "facility_id": f.facility_id}

@app.get("/facility/all")
def get_facilities(db: Session = Depends(get_db)):
    return db.query(Facility).all()

# ===================================================
# DELETE FACILITY
# ===================================================
class DeleteRequest(BaseModel):
    password: str
    reason: str

@app.delete("/facility/delete/{facility_id}")
def delete_facility(
    facility_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    linked = db.query(Equipment).filter(Equipment.facility_id == facility_id).first()
    if linked:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete facility — equipment is linked. Delete equipment first."
        )

    facility = db.query(Facility).filter(Facility.facility_id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    db.delete(facility)
    db.commit()

    log_audit(db, "DELETE", "FACILITY", facility_id,
              "facility_name", facility.facility_name, "",
              current_user.username + " | Reason: " + req.reason)

    return {"message": "Facility deleted successfully"}

# ===================================================
# EQUIPMENT MASTER
# ===================================================
class EquipmentRequest(BaseModel):
    equipment_name: str
    facility_id: int
    surface_area_cm2: float
    rinse_volume_liters: float = 0.0
    category_id: Optional[int] = None
    password: str

class CategoryRequest(BaseModel):
    category_name: str
    password: str

@app.get("/equipment/categories")
def get_equipment_categories(db: Session = Depends(get_db)):
    return db.query(EquipmentCategory).order_by(EquipmentCategory.category_name).all()

@app.post("/equipment/categories/add")
def add_equipment_category(
    req: CategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    name = req.category_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty")
    existing = db.query(EquipmentCategory).filter(EquipmentCategory.category_name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    cat = EquipmentCategory(category_name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_audit(db, "CREATE", "EQUIPMENT_CATEGORY", cat.category_id,
              "category_name", "", name, current_user.username)
    return {"message": "Category added", "category_id": cat.category_id, "category_name": cat.category_name}

@app.delete("/equipment/categories/remove/{category_id}")
def delete_equipment_category(
    category_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    cat = db.query(EquipmentCategory).filter(EquipmentCategory.category_id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    in_use = db.query(Equipment).filter(Equipment.category_id == category_id).first()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — category is assigned to equipment. Reassign first."
        )
    log_audit(db, "DELETE", "EQUIPMENT_CATEGORY", category_id,
              "category_name", cat.category_name, "", current_user.username)
    db.delete(cat)
    db.commit()
    return {"message": "Category removed"}

@app.post("/equipment/add")
def add_equipment(
    req: EquipmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    fac = db.query(Facility).filter(Facility.facility_id == req.facility_id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Facility not found")

    area_cm2 = req.surface_area_cm2 * 6.4516

    e = Equipment(
        equipment_name=req.equipment_name,
        facility_id=req.facility_id,
        surface_area_cm2=area_cm2,
        rinse_volume_liters=req.rinse_volume_liters,
        category_id=req.category_id,
    )
    db.add(e)
    db.commit()
    db.refresh(e)

    log_audit(db, "CREATE", "EQUIPMENT", e.equipment_id,
              "equipment_name", "", req.equipment_name,
              current_user.username)

    return {"message": "Equipment added", "equipment_id": e.equipment_id}

def _eq_to_dict(e: Equipment, cats: dict) -> dict:
    return {
        "equipment_id": e.equipment_id,
        "equipment_name": e.equipment_name,
        "facility_id": e.facility_id,
        "surface_area_cm2": e.surface_area_cm2,
        "rinse_volume_liters": e.rinse_volume_liters,
        "category_id": e.category_id,
        "category_name": cats.get(e.category_id, "—"),
    }

@app.get("/equipment/all")
def get_equipment(db: Session = Depends(get_db)):
    equipment = db.query(Equipment).all()
    cats = {c.category_id: c.category_name for c in db.query(EquipmentCategory).all()}
    return [_eq_to_dict(e, cats) for e in equipment]

@app.get("/equipment/by_facility/{facility_id}")
def get_equipment_by_facility(facility_id: int, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.facility_id == facility_id).all()
    cats = {c.category_id: c.category_name for c in db.query(EquipmentCategory).all()}
    return [_eq_to_dict(e, cats) for e in equipment]

@app.get("/product/{product_id}/equipment")
def get_product_equipment(product_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(ProductEquipment).filter(ProductEquipment.product_id == product_id).all()
    return [r.equipment_id for r in rows]

# ===================================================
# DELETE EQUIPMENT
# ===================================================
@app.delete("/equipment/delete/{equipment_id}")
def delete_equipment(
    equipment_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    linked = db.query(ProductEquipment).filter(
        ProductEquipment.equipment_id == equipment_id
    ).first()
    if linked:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete equipment — linked to a product. Remove product link first."
        )

    equipment = db.query(Equipment).filter(Equipment.equipment_id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    db.delete(equipment)
    db.commit()

    log_audit(db, "DELETE", "EQUIPMENT", equipment_id,
              "equipment_name", equipment.equipment_name, "",
              current_user.username + " | Reason: " + req.reason)

    return {"message": "Equipment deleted successfully"}

# ===================================================
# PRODUCT MASTER
# ===================================================
_DEFAULT_ATC = [
    "A — Alimentary tract and metabolism",
    "B — Blood and blood forming organs",
    "C — Cardiovascular system",
    "D — Dermatologicals",
    "G — Genito-urinary system and sex hormones",
    "H — Systemic hormonal preparations, excl. sex hormones and insulins",
    "J — Antiinfectives for systemic use",
    "L — Antineoplastic and immunomodulating agents",
    "M — Musculo-skeletal system",
    "N — Nervous system",
    "P — Antiparasitic products, insecticides and repellents",
    "R — Respiratory system",
    "S — Sensory organs",
    "V — Various",
]

class SynthStep(BaseModel):
    step_name:        str = ""
    iupac_name:       str = ""
    soluble_solvent:  str = ""
    solubility_usp:   Optional[int] = None
    analytical_method: str = ""
    lod_ppm:          Optional[float] = None
    loq_ppm:          Optional[float] = None

class StepEquipmentEntry(BaseModel):
    step_number:      int
    equipment_id:     int
    test_compound:    Optional[str] = None
    usage_sequence:   Optional[int] = None
    is_test_compound: Optional[int] = None  # 1 = selected for testing, 0 = not selected
    swab_area_sqin:               Optional[int] = 9
    rinse_sample_area_sqin:       Optional[int] = 9
    optional_equipment_ids:       Optional[List[int]] = []
    optional_swab_areas:          Optional[Dict[str, int]] = {}
    optional_rinse_sample_areas:  Optional[Dict[str, int]] = {}

class ProductRequest(BaseModel):
    product_name: str
    facility_id: int
    min_therapeutic_dose_mg: float
    max_daily_dose_mg: float
    pde_mg_day: float
    min_yield_kg: float = 0.0
    max_batch_size_kg: float = 0.0
    lod_ppm: float = 0.0
    loq_ppm: float = 0.0
    analytical_method: str = ""
    solubility_usp: Optional[int] = None
    soluble_solvent: str = ""
    product_category: Optional[str] = None
    therapeutic_category: Optional[str] = None
    route_of_administration: Optional[str] = None
    cas_number: Optional[str] = None
    chemical_number: Optional[str] = None
    final_product_id: Optional[int] = None
    synthesis_steps:    List[SynthStep] = []
    step_equipment_map: List[StepEquipmentEntry] = []
    equipment_ids: List[int]
    password: str

@app.post("/product/add")
def add_product(
    req: ProductRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    duplicate = db.query(Product).filter(
        Product.facility_id == req.facility_id,
        Product.product_name == req.product_name.strip(),
        (Product.is_archived == False) | (Product.is_archived == None)
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=400,
            detail=f"Product '{req.product_name}' already exists in this facility ❌"
        )

    p = Product(
        product_name=req.product_name,
        facility_id=req.facility_id,
        min_therapeutic_dose_mg=req.min_therapeutic_dose_mg,
        max_daily_dose_mg=req.max_daily_dose_mg,
        pde_mg_day=req.pde_mg_day,
        min_yield_kg=req.min_yield_kg,
        max_batch_size_kg=req.max_batch_size_kg,
        lod_ppm=req.lod_ppm,
        loq_ppm=req.loq_ppm,
        analytical_method=req.analytical_method,
        solubility_usp=req.solubility_usp,
        soluble_solvent=req.soluble_solvent,
        product_category=req.product_category,
        therapeutic_category=req.therapeutic_category,
        route_of_administration=req.route_of_administration,
        cas_number=req.cas_number,
        chemical_number=req.chemical_number,
        final_product_id=req.final_product_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    for eq in req.equipment_ids:
        db.add(ProductEquipment(product_id=p.product_id, equipment_id=eq))

    for i, step in enumerate(req.synthesis_steps):
        if step.step_name or step.iupac_name:
            db.add(ProductSynthesisStep(
                product_id=p.product_id,
                step_number=i + 1,
                step_name=step.step_name or None,
                iupac_name=step.iupac_name or None,
                soluble_solvent=step.soluble_solvent or None,
                solubility_usp=step.solubility_usp,
                analytical_method=step.analytical_method or None,
                lod_ppm=step.lod_ppm,
                loq_ppm=step.loq_ppm,
            ))

    for entry in req.step_equipment_map:
        db.add(ProductStepEquipment(
            product_id=p.product_id,
            step_number=entry.step_number,
            equipment_id=entry.equipment_id,
            test_compound=entry.test_compound,
            usage_sequence=entry.usage_sequence,
            is_test_compound=entry.is_test_compound,
            swab_area_sqin=entry.swab_area_sqin if entry.swab_area_sqin is not None else 9,
            rinse_sample_area_sqin=entry.rinse_sample_area_sqin if entry.rinse_sample_area_sqin is not None else 9,
            optional_equipment_ids=json.dumps(entry.optional_equipment_ids or []),
            optional_swab_areas=json.dumps(entry.optional_swab_areas or {}),
            optional_rinse_sample_areas=json.dumps(entry.optional_rinse_sample_areas or {}),
        ))
    db.commit()

    log_audit(db, "CREATE", "PRODUCT", p.product_id,
              "product_name", "", req.product_name,
              current_user.username)

    return {"message": "Product added", "product_id": p.product_id}

@app.get("/product/all")
def get_products(facility_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Product).filter((Product.is_archived == False) | (Product.is_archived == None))
    if facility_id:
        q = q.filter(Product.facility_id == facility_id)
    return q.order_by(Product.product_name).all()

@app.get("/product/archived")
def get_archived_products(db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.is_archived == True).all()

@app.get("/product/atc-categories")
def get_atc_categories(db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "atc_custom_categories").first()
    custom = json.loads(config.config_value) if config else []
    return {"default": _DEFAULT_ATC, "custom": custom}

class AtcCategoryRequest(BaseModel):
    category: str

@app.post("/product/atc-categories")
def add_atc_category(
    req: AtcCategoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["ADMIN"])
    config = db.query(SystemConfig).filter(SystemConfig.config_key == "atc_custom_categories").first()
    current = json.loads(config.config_value) if config else []
    if req.category in current:
        return {"message": "Already exists", "categories": current}
    current.append(req.category)
    if config:
        config.config_value = json.dumps(current)
        config.updated_by   = current_user.username
        config.updated_at   = datetime.datetime.utcnow().isoformat()
    else:
        db.add(SystemConfig(
            config_key="atc_custom_categories",
            config_value=json.dumps(current),
            updated_by=current_user.username,
            updated_at=datetime.datetime.utcnow().isoformat()
        ))
    db.commit()
    return {"message": "Category added", "categories": current}

@app.get("/product/{product_id}/synthesis-steps")
def get_synthesis_steps(product_id: int, db: Session = Depends(get_db)):
    steps = (db.query(ProductSynthesisStep)
               .filter(ProductSynthesisStep.product_id == product_id)
               .order_by(ProductSynthesisStep.step_number)
               .all())
    return [
        {
            "step_id":        s.step_id,
            "step_number":    s.step_number,
            "step_name":      s.step_name,
            "iupac_name":     s.iupac_name,
            "soluble_solvent":  s.soluble_solvent,
            "solubility_usp":   s.solubility_usp,
            "analytical_method": s.analytical_method,
            "lod_ppm":          s.lod_ppm,
            "loq_ppm":          s.loq_ppm,
        }
        for s in steps
    ]

@app.get("/product/{product_id}/step-equipment")
def get_step_equipment(product_id: int, db: Session = Depends(get_db)):
    entries = (db.query(ProductStepEquipment)
                 .filter(ProductStepEquipment.product_id == product_id)
                 .order_by(ProductStepEquipment.step_number)
                 .all())
    return [
        {
            "id":             e.id,
            "step_number":    e.step_number,
            "equipment_id":   e.equipment_id,
            "test_compound":  e.test_compound,
            "usage_sequence":   e.usage_sequence,
            "is_test_compound": e.is_test_compound,
            "swab_area_sqin":              e.swab_area_sqin if e.swab_area_sqin is not None else 9,
            "rinse_sample_area_sqin":      e.rinse_sample_area_sqin if e.rinse_sample_area_sqin is not None else 9,
            "optional_equipment_ids":      json.loads(e.optional_equipment_ids or "[]"),
            "optional_swab_areas":         json.loads(e.optional_swab_areas or "{}"),
            "optional_rinse_sample_areas": json.loads(e.optional_rinse_sample_areas or "{}"),
        }
        for e in entries
    ]

class ArchiveRequest(BaseModel):
    password: str
    reason: str

@app.post("/product/restore/{product_id}")
def restore_product(
    product_id: int,
    req: ArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.is_archived:
        raise HTTPException(status_code=400, detail="Product is not archived")

    product.is_archived = False
    product.archived_by = None
    product.archived_at = None
    db.commit()

    log_audit(db, "UPDATE", "PRODUCT", product_id,
              "is_archived", "True", "False",
              current_user.username + " | Reason: " + req.reason)

    return {"message": "Product restored successfully"}

class ProductLinkRequest(BaseModel):
    final_product_id: Optional[int] = None
    password: str
    reason: str

@app.patch("/product/{product_id}/link")
def link_product(
    product_id: int,
    req: ProductLinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    actor = current_user.username + " | Reason: " + req.reason
    old_val = product.final_product_id
    new_val = req.final_product_id
    if str(old_val) != str(new_val):
        log_audit(db, "UPDATE", "PRODUCT", product_id, "final_product_id", str(old_val), str(new_val), actor)
    product.final_product_id = new_val
    db.commit()
    return {"message": "Product linked successfully"}

@app.post("/product/archive/{product_id}")
def archive_product(
    product_id: int,
    req: ArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.is_archived = True
    product.archived_by = current_user.username
    product.archived_at = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"

    # Remove equipment mappings so archived product is excluded from MACO
    db.query(ProductEquipment).filter(
        ProductEquipment.product_id == product_id
    ).delete()

    db.commit()

    log_audit(db, "UPDATE", "PRODUCT", product_id,
              "is_archived", "False", "True",
              current_user.username + " | Reason: " + req.reason)

    return {"message": "Product archived successfully"}

# ===================================================
# MACO CALCULATION (simple)
# ===================================================
class MacoRequest(BaseModel):
    product_from: str
    product_to: str
    equipment_id: str
    min_therapeutic_dose_mg: Optional[float] = None
    next_batch_size_kg: Optional[float] = None
    max_daily_dose_mg: Optional[float] = None
    pde_mg_day: Optional[float] = None

@app.post("/maco/calculate")
def maco(req: MacoRequest, db: Session = Depends(get_db),
         current_user: User = Depends(get_current_user)):
    maco_val = (req.min_therapeutic_dose_mg or 0) / 1000
    calc_id = str(uuid.uuid4())
    db.add(MacoResult(
        calc_id=calc_id,
        product_from=req.product_from,
        product_to=req.product_to,
        equipment_id=req.equipment_id,
        method="simplified",
        maco_ug=maco_val * 1000,
        limit_ugcm2=None,
        is_governing=True
    ))
    db.commit()
    log_audit(db, "MACO_MATRIX", "MACO_RESULT", calc_id,
              "maco_calculate", "",
              f"from={req.product_from} to={req.product_to} maco={round(maco_val * 1000, 4)}ug",
              current_user.username)
    return {"calc_id": calc_id, "maco": maco_val}

# ===================================================
# POLICY
# ===================================================
VALID_POLICIES = {
    "all_min":       "All Methods — Most Conservative (minimum of all applicable)",
    "pde_only":      "PDE / ADE Based Only (HBEL approach)",
    "dose_only":     "Dose Based Only (1/1000th therapeutic dose)",
    "10ppm_only":    "10 ppm Criterion Only",
    "pde_dose_min":  "PDE + Dose — Most Conservative",
    "pde_10ppm_min": "PDE + 10 ppm — Most Conservative",
}

def _get_policy(db: Session) -> str:
    row = db.query(SystemConfig).filter(SystemConfig.config_key == "maco_policy").first()
    return row.config_value if row else "all_min"

@app.get("/policy")
def get_policy(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    policy = _get_policy(db)
    return {
        "policy": policy,
        "description": VALID_POLICIES.get(policy, policy),
        "all_policies": [{"key": k, "label": v} for k, v in VALID_POLICIES.items()],
        "updated_by": (db.query(SystemConfig).filter(SystemConfig.config_key == "maco_policy").first() or SystemConfig()).updated_by,
        "updated_at": (db.query(SystemConfig).filter(SystemConfig.config_key == "maco_policy").first() or SystemConfig()).updated_at,
    }

class PolicyUpdateRequest(BaseModel):
    policy: str
    password: str

@app.put("/policy")
def update_policy(
    req: PolicyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_MANAGE_POLICY)
    if req.policy not in VALID_POLICIES:
        raise HTTPException(status_code=400, detail=f"Invalid policy key. Valid options: {list(VALID_POLICIES.keys())}")
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    row = db.query(SystemConfig).filter(SystemConfig.config_key == "maco_policy").first()
    old_policy = row.config_value if row else "all_min"
    if row:
        row.config_value = req.policy
        row.updated_by   = current_user.username
        row.updated_at   = datetime.datetime.utcnow().isoformat()
    else:
        db.add(SystemConfig(config_key="maco_policy", config_value=req.policy,
                            updated_by=current_user.username,
                            updated_at=datetime.datetime.utcnow().isoformat()))
    db.commit()

    log_audit(db, "UPDATE", "SYSTEM", 0, "maco_policy", old_policy, req.policy, current_user.username)
    logger.info(f"MACO policy changed from '{old_policy}' to '{req.policy}' by {current_user.username}")
    return {"message": f"Policy updated to '{req.policy}'", "description": VALID_POLICIES[req.policy]}

# ===================================================
# MATRIX — FULL MACO CALCULATION (3 methods)
# ===================================================
class MatrixRequest(BaseModel):
    source_product_id: int

@app.post("/maco/matrix")
def matrix(
    req: MatrixRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    policy = _get_policy(db)

    src = db.query(Product).filter(
        Product.product_id == req.source_product_id
    ).first()

    if not src:
        raise HTTPException(status_code=404, detail="Source product not found")

    src_category = (src.product_category or "").strip()
    is_fixed_10ppm = src_category.upper() in {"INTERMEDIATE", "KSM"}

    targets = db.query(Product).filter(
        Product.facility_id == src.facility_id,
        Product.product_id != src.product_id,
        (Product.is_archived == False) | (Product.is_archived == None)
    ).all()

    if not targets:
        return {
            "source": src.product_name,
            "data": [],
            "governing_maco": None,
            "analytical_method": src.analytical_method,
            "lod_ppm": src.lod_ppm,
            "loq_ppm": src.loq_ppm,
            "scenario": "fixed_10ppm" if is_fixed_10ppm else "maco_3method",
            "source_category": src_category,
        }

    cats = {c.category_id: c.category_name for c in db.query(EquipmentCategory).all()}

    # Build swab/rinse area maps AND classify equipment by synthesis step vs. final product
    # step_number=0 → final product step; step_number>0 → synthesis intermediate step
    src_swab_map = {}
    src_rinse_map = {}
    src_optional_eq_ids = set()
    _src_step_raw = {}  # step_number -> {test_compound, equipment_ids: set}
    for pse in db.query(ProductStepEquipment).filter(
        ProductStepEquipment.product_id == src.product_id
    ).all():
        swa = pse.swab_area_sqin or 9
        rsa = pse.rinse_sample_area_sqin or 9
        if pse.equipment_id not in src_swab_map or swa < src_swab_map[pse.equipment_id]:
            src_swab_map[pse.equipment_id] = swa
        if pse.equipment_id not in src_rinse_map or rsa < src_rinse_map[pse.equipment_id]:
            src_rinse_map[pse.equipment_id] = rsa
        # Track per-step classification
        _sn = pse.step_number if pse.step_number is not None else 0
        if _sn not in _src_step_raw:
            _src_step_raw[_sn] = {"test_compound": pse.test_compound or "", "equipment_ids": set()}
        _src_step_raw[_sn]["equipment_ids"].add(pse.equipment_id)
        # Include optional equipment and their configured areas
        opt_ids = json.loads(pse.optional_equipment_ids or "[]")
        opt_swab = json.loads(pse.optional_swab_areas or "{}")
        opt_rinse = json.loads(pse.optional_rinse_sample_areas or "{}")
        for oid in opt_ids:
            oid = int(oid)
            src_optional_eq_ids.add(oid)
            oswa = opt_swab.get(str(oid), 9) or 9
            orsa = opt_rinse.get(str(oid), 9) or 9
            if oid not in src_swab_map or oswa < src_swab_map[oid]:
                src_swab_map[oid] = oswa
            if oid not in src_rinse_map or orsa < src_rinse_map[oid]:
                src_rinse_map[oid] = orsa
            _src_step_raw[_sn]["equipment_ids"].add(oid)

    # Equipment used in the final product step (step_number=0)
    src_final_product_eq_ids = _src_step_raw.get(0, {}).get("equipment_ids", set())
    # Synthesis-step groups: ALL equipment in steps>0 (may overlap with final product step —
    # the same vessel can be used for both an intermediate and the final API)
    src_synth_step_groups = []
    for _sn in sorted(k for k in _src_step_raw if k != 0):
        _step_eq_ids = _src_step_raw[_sn]["equipment_ids"]
        if _step_eq_ids:
            src_synth_step_groups.append({
                "step_number": _sn,
                "test_compound": _src_step_raw[_sn]["test_compound"],
                "equipment_ids": _step_eq_ids,
            })
    has_synthesis_steps = bool(src_synth_step_groups)

    src_primary_eq_ids = set(
        pe.equipment_id for pe in
        db.query(ProductEquipment).filter(
            ProductEquipment.product_id == src.product_id
        ).all()
    )
    # Include ALL PSE primary step equipment (synthesis + final) in src_eq_ids.
    # ProductEquipment may not list every reactor used in intermediate steps,
    # so PSE primary IDs must be added explicitly so they appear in shared_equipment.
    _src_all_pse_primary = set()
    for _sdata in _src_step_raw.values():
        _src_all_pse_primary |= _sdata["equipment_ids"]
    src_eq_ids = list(src_primary_eq_ids | src_optional_eq_ids | _src_all_pse_primary)

    results = []
    governing_maco = None

    for tgt in targets:

        tgt_primary_eq_ids = set(
            pe.equipment_id for pe in
            db.query(ProductEquipment).filter(
                ProductEquipment.product_id == tgt.product_id
            ).all()
        )
        tgt_optional_eq_ids = set()
        _tgt_step_raw = {}
        for pse in db.query(ProductStepEquipment).filter(
            ProductStepEquipment.product_id == tgt.product_id
        ).all():
            _tsn = pse.step_number if pse.step_number is not None else 0
            if _tsn not in _tgt_step_raw:
                _tgt_step_raw[_tsn] = {"test_compound": pse.test_compound or "", "equipment_ids": set()}
            _tgt_step_raw[_tsn]["equipment_ids"].add(pse.equipment_id)
            for oid in json.loads(pse.optional_equipment_ids or "[]"):
                oid = int(oid)
                tgt_optional_eq_ids.add(oid)
                _tgt_step_raw[_tsn]["equipment_ids"].add(oid)
        # Include ALL PSE primary step equipment in tgt_eq_ids (same reason as source side).
        _tgt_all_pse_primary = set()
        for _tdata in _tgt_step_raw.values():
            _tgt_all_pse_primary |= _tdata["equipment_ids"]
        tgt_eq_ids = list(tgt_primary_eq_ids | tgt_optional_eq_ids | _tgt_all_pse_primary)

        # Determine target step groups for matrix step breakdown.
        # _tgt_final_eq = all target equipment NOT assigned to a synthesis step
        # so that e.g. Sorafenib's synthesis reactors appear in _tgt_synth_groups
        # while its final-step reactor stays in _tgt_final_eq.
        if _tgt_step_raw:
            _tgt_synth_groups = []
            _tgt_synth_all_eq = set()
            for _tsn in sorted(k for k in _tgt_step_raw if k != 0):
                _teq = _tgt_step_raw[_tsn]["equipment_ids"]
                if _teq:
                    _tgt_synth_groups.append({
                        "step_number": _tsn,
                        "test_compound": _tgt_step_raw[_tsn]["test_compound"],
                        "equipment_ids": _teq,
                    })
                    _tgt_synth_all_eq |= _teq
            # Final-step equipment = all target equipment minus synthesis-step equipment
            _tgt_final_eq = set(tgt_eq_ids) - _tgt_synth_all_eq
            if not _tgt_final_eq:
                _tgt_final_eq = set(tgt_eq_ids)  # edge case: all equipment is in synthesis steps
        else:
            _tgt_final_eq = set(tgt_eq_ids)
            _tgt_synth_groups = []
            _tgt_synth_all_eq = set()

        shared_eq_ids = list(set(src_eq_ids) & set(tgt_eq_ids))
        shared_equipment = db.query(Equipment).filter(
            Equipment.equipment_id.in_(shared_eq_ids)
        ).all() if shared_eq_ids else []

        total_rinse_vol = sum(
            e.rinse_volume_liters for e in shared_equipment
            if e.rinse_volume_liters
        )
        total_area_in2 = sum(
            e.surface_area_cm2 / 6.4516 for e in shared_equipment
        )

        loq = src.loq_ppm or 0
        rv  = total_rinse_vol
        sa  = total_area_in2

        def _status(val):
            if val is None:
                return None
            return "PASS" if val >= loq else "FAIL"

        shared_eq_list = [
            {
                "name": e.equipment_name,
                "category_id": e.category_id,
                "category_name": cats.get(e.category_id),
                "surface_area_in2": round(e.surface_area_cm2 / 6.4516, 2) if e.surface_area_cm2 else 0,
                "rinse_volume_L": round(e.rinse_volume_liters, 2) if e.rinse_volume_liters else 0,
                "swab_area_sqin": src_swab_map.get(e.equipment_id, 9),
                "rinse_sample_area_sqin": src_rinse_map.get(e.equipment_id, 9),
            }
            for e in shared_equipment
        ]

        if is_fixed_10ppm:
            # Intermediate/KSM source — fixed 10 ppm criterion, no MACO calculation
            results.append({
                "target_product": tgt.product_name,
                "shared_equipment": shared_eq_list,
                "synthesis_step_equipment": [],
                "step_matrix_rows": [],
                "scenario": "fixed_10ppm",
                "maco_pde":  None,
                "maco_dose": None,
                "maco_10ppm": None,
                "governing_maco_pair": None,
                "total_rinse_vol_L": round(rv, 2),
                "total_area_in2":    round(sa, 2),
                "rinse_limit_pde":    None,
                "rinse_limit_dose":   None,
                "rinse_limit_10ppm":  None,
                "rinse_limit_final":  10.0,
                "swab_limit_pde":     None,
                "swab_limit_dose":    None,
                "swab_limit_10ppm":   None,
                "swab_limit_final":   10.0,
                "rinse_status_pde":   None,
                "rinse_status_dose":  None,
                "rinse_status_10ppm": None,
                "rinse_status_final": _status(10.0),
                "swab_status_pde":    None,
                "swab_status_dose":   None,
                "swab_status_10ppm":  None,
                "swab_status_final":  _status(10.0),
                "loq_ppm": loq,
            })
        else:
            # API source — MACO applies to final-product-step equipment (src_final × tgt_final).
            # Synthesis steps use a fixed 10 ppm limit.
            # step_matrix_rows covers all non-(final×final) combinations for MatrixPage.
            src_final_eq = src_final_product_eq_ids if has_synthesis_steps else set(src_eq_ids)

            # Main MACO row: source final × target final equipment only
            product_shared_objs = [e for e in shared_equipment
                                   if e.equipment_id in src_final_eq
                                   and e.equipment_id in _tgt_final_eq]

            if has_synthesis_steps:
                # synthesis_step_equipment: source synthesis × ALL target (kept for ProtocolPage)
                # Only include equipment that is synthesis-ONLY (not also in the final product step).
                # Equipment used in both synthesis and final step is already covered by the MACO row.
                synthesis_step_equipment = []
                for grp in src_synth_step_groups:
                    _synth_only_ids = grp["equipment_ids"] - src_final_product_eq_ids
                    step_objs = [e for e in shared_equipment
                                 if e.equipment_id in _synth_only_ids]
                    if step_objs:
                        synthesis_step_equipment.append({
                            "step_number": grp["step_number"],
                            "test_compound": grp["test_compound"],
                            "equipment": [{
                                "name": e.equipment_name,
                                "category_id": e.category_id,
                                "category_name": cats.get(e.category_id),
                                "surface_area_in2": round(e.surface_area_cm2 / 6.4516, 2) if e.surface_area_cm2 else 0,
                                "rinse_volume_L": round(e.rinse_volume_liters, 2) if e.rinse_volume_liters else 0,
                                "swab_area_sqin": src_swab_map.get(e.equipment_id, 9),
                                "rinse_sample_area_sqin": src_rinse_map.get(e.equipment_id, 9),
                                "rinse_final": 10.0,
                                "swab_final": 10.0,
                            } for e in step_objs],
                        })
            else:
                synthesis_step_equipment = []

            # Rebuild shared_eq_list and totals from product_shared_objs (src_final × tgt_final)
            shared_eq_list = [{
                "name": e.equipment_name,
                "category_id": e.category_id,
                "category_name": cats.get(e.category_id),
                "surface_area_in2": round(e.surface_area_cm2 / 6.4516, 2) if e.surface_area_cm2 else 0,
                "rinse_volume_L": round(e.rinse_volume_liters, 2) if e.rinse_volume_liters else 0,
                "swab_area_sqin": src_swab_map.get(e.equipment_id, 9),
                "rinse_sample_area_sqin": src_rinse_map.get(e.equipment_id, 9),
            } for e in product_shared_objs]
            shared_equipment_maco = product_shared_objs
            rv = sum(e.rinse_volume_liters for e in product_shared_objs if e.rinse_volume_liters)
            sa = sum(e.surface_area_cm2 / 6.4516 for e in product_shared_objs)

            # Full 3-method MACO calculation for target products
            if tgt.max_daily_dose_mg and tgt.max_daily_dose_mg > 0 and tgt.min_yield_kg:
                maco_pde = (
                    src.pde_mg_day *
                    tgt.min_yield_kg * 1_000_000
                ) / tgt.max_daily_dose_mg
            else:
                maco_pde = None

            if tgt.max_daily_dose_mg and tgt.max_daily_dose_mg > 0 and tgt.min_yield_kg:
                maco_dose = (
                    src.min_therapeutic_dose_mg *
                    tgt.min_yield_kg * 1_000_000
                ) / (tgt.max_daily_dose_mg * 1000)
            else:
                maco_dose = None

            maco_10ppm = 10 * (tgt.min_yield_kg or 0)

            valid_macos = [m for m in [maco_pde, maco_dose, maco_10ppm] if m is not None and m > 0]
            maco_pair = min(valid_macos) if valid_macos else None

            if maco_pair is not None:
                if governing_maco is None or maco_pair < governing_maco:
                    governing_maco = maco_pair

            # Per-equipment limits — final-product equipment only, each using its own areas/volume
            def _cap10(v): return min(v, 10.0) if v is not None else None

            for i, e in enumerate(shared_equipment_maco):
                eq_rsa = src_rinse_map.get(e.equipment_id, 9)
                eq_swa = src_swab_map.get(e.equipment_id, 9)
                eq_sa  = e.surface_area_cm2 / 6.4516 if e.surface_area_cm2 else 0
                eq_rv  = e.rinse_volume_liters or 0

                r_pde_raw  = round((maco_pde   * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_pde   and eq_sa > 0 and eq_rv > 0) else None
                r_dose_raw = round((maco_dose  * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_dose  and eq_sa > 0 and eq_rv > 0) else None
                r_10pm_raw = round((maco_10ppm * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_10ppm and eq_sa > 0 and eq_rv > 0) else None
                s_pde_raw  = round((maco_pde   * eq_swa * 100) / eq_sa, 4) if (maco_pde   and eq_sa > 0) else None
                s_dose_raw = round((maco_dose  * eq_swa * 100) / eq_sa, 4) if (maco_dose  and eq_sa > 0) else None
                s_10pm_raw = round((maco_10ppm * eq_swa * 100) / eq_sa, 4) if (maco_10ppm and eq_sa > 0) else None

                r_pde  = _cap10(r_pde_raw);  r_dose = _cap10(r_dose_raw);  r_10pm = _cap10(r_10pm_raw)
                s_pde  = _cap10(s_pde_raw);  s_dose = _cap10(s_dose_raw);  s_10pm = _cap10(s_10pm_raw)

                v_r = [v for v in [r_pde, r_dose, r_10pm] if v is not None]
                v_s = [v for v in [s_pde, s_dose, s_10pm] if v is not None]
                r_fin = round(min(v_r), 4) if v_r else None
                s_fin = round(min(v_s), 4) if v_s else None

                shared_eq_list[i].update({
                    "rinse_pde": r_pde, "rinse_pde_raw": r_pde_raw,
                    "rinse_dose": r_dose, "rinse_dose_raw": r_dose_raw,
                    "rinse_10ppm": r_10pm, "rinse_10ppm_raw": r_10pm_raw,
                    "rinse_final": r_fin,
                    "swab_pde": s_pde, "swab_pde_raw": s_pde_raw,
                    "swab_dose": s_dose, "swab_dose_raw": s_dose_raw,
                    "swab_10ppm": s_10pm, "swab_10ppm_raw": s_10pm_raw,
                    "swab_final": s_fin,
                })

            # Product-level limits = minimum across final-product equipment (governing)
            all_r_pde      = [e["rinse_pde"]       for e in shared_eq_list if e.get("rinse_pde")       is not None]
            all_r_pde_raw  = [e["rinse_pde_raw"]   for e in shared_eq_list if e.get("rinse_pde_raw")   is not None]
            all_r_dose     = [e["rinse_dose"]      for e in shared_eq_list if e.get("rinse_dose")      is not None]
            all_r_dose_raw = [e["rinse_dose_raw"]  for e in shared_eq_list if e.get("rinse_dose_raw")  is not None]
            all_r_10pm     = [e["rinse_10ppm"]     for e in shared_eq_list if e.get("rinse_10ppm")     is not None]
            all_r_10pm_raw = [e["rinse_10ppm_raw"] for e in shared_eq_list if e.get("rinse_10ppm_raw") is not None]
            all_r_fin      = [e["rinse_final"]     for e in shared_eq_list if e.get("rinse_final")     is not None]
            all_s_pde      = [e["swab_pde"]        for e in shared_eq_list if e.get("swab_pde")        is not None]
            all_s_pde_raw  = [e["swab_pde_raw"]    for e in shared_eq_list if e.get("swab_pde_raw")    is not None]
            all_s_dose     = [e["swab_dose"]       for e in shared_eq_list if e.get("swab_dose")       is not None]
            all_s_dose_raw = [e["swab_dose_raw"]   for e in shared_eq_list if e.get("swab_dose_raw")   is not None]
            all_s_10pm     = [e["swab_10ppm"]      for e in shared_eq_list if e.get("swab_10ppm")      is not None]
            all_s_10pm_raw = [e["swab_10ppm_raw"]  for e in shared_eq_list if e.get("swab_10ppm_raw")  is not None]
            all_s_fin      = [e["swab_final"]      for e in shared_eq_list if e.get("swab_final")      is not None]

            rinse_pde       = round(min(all_r_pde),      4) if all_r_pde      else None
            rinse_pde_raw   = round(min(all_r_pde_raw),  4) if all_r_pde_raw  else None
            rinse_dose      = round(min(all_r_dose),     4) if all_r_dose     else None
            rinse_dose_raw  = round(min(all_r_dose_raw), 4) if all_r_dose_raw else None
            rinse_10ppm     = round(min(all_r_10pm),     4) if all_r_10pm     else None
            rinse_10ppm_raw = round(min(all_r_10pm_raw), 4) if all_r_10pm_raw else None
            rinse_final     = round(min(all_r_fin),      4) if all_r_fin      else None
            swab_pde        = round(min(all_s_pde),      4) if all_s_pde      else None
            swab_pde_raw    = round(min(all_s_pde_raw),  4) if all_s_pde_raw  else None
            swab_dose       = round(min(all_s_dose),     4) if all_s_dose     else None
            swab_dose_raw   = round(min(all_s_dose_raw), 4) if all_s_dose_raw else None
            swab_10ppm      = round(min(all_s_10pm),     4) if all_s_10pm     else None
            swab_10ppm_raw  = round(min(all_s_10pm_raw), 4) if all_s_10pm_raw else None
            swab_final      = round(min(all_s_fin),      4) if all_s_fin      else None

            # ── Build step_matrix_rows ─────────────────────────────────────
            # Covers all (src_step × tgt_step) combinations except (final×final)
            # so MatrixPage can show per-step breakdown rows.
            step_matrix_rows = []

            def _eq_info(e):
                return {
                    "name": e.equipment_name,
                    "category_id": e.category_id,
                    "category_name": cats.get(e.category_id),
                    "surface_area_in2": round(e.surface_area_cm2 / 6.4516, 2) if e.surface_area_cm2 else 0,
                    "rinse_volume_L": round(e.rinse_volume_liters, 2) if e.rinse_volume_liters else 0,
                }

            def _maco_eq_limits(e):
                eq_rsa = src_rinse_map.get(e.equipment_id, 9)
                eq_swa = src_swab_map.get(e.equipment_id, 9)
                eq_sa  = e.surface_area_cm2 / 6.4516 if e.surface_area_cm2 else 0
                eq_rv  = e.rinse_volume_liters or 0
                r_pde_raw  = round((maco_pde   * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_pde   and eq_sa > 0 and eq_rv > 0) else None
                r_dose_raw = round((maco_dose  * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_dose  and eq_sa > 0 and eq_rv > 0) else None
                r_10pm_raw = round((maco_10ppm * eq_rsa) / (eq_sa * eq_rv), 4) if (maco_10ppm and eq_sa > 0 and eq_rv > 0) else None
                s_pde_raw  = round((maco_pde   * eq_swa * 100) / eq_sa, 4) if (maco_pde   and eq_sa > 0) else None
                s_dose_raw = round((maco_dose  * eq_swa * 100) / eq_sa, 4) if (maco_dose  and eq_sa > 0) else None
                s_10pm_raw = round((maco_10ppm * eq_swa * 100) / eq_sa, 4) if (maco_10ppm and eq_sa > 0) else None
                r_pde = _cap10(r_pde_raw); r_dose = _cap10(r_dose_raw); r_10pm = _cap10(r_10pm_raw)
                s_pde = _cap10(s_pde_raw); s_dose = _cap10(s_dose_raw); s_10pm = _cap10(s_10pm_raw)
                v_r = [v for v in [r_pde, r_dose, r_10pm] if v is not None]
                v_s = [v for v in [s_pde, s_dose, s_10pm] if v is not None]
                return {
                    **_eq_info(e),
                    "rinse_final": round(min(v_r), 4) if v_r else None,
                    "swab_final":  round(min(v_s), 4) if v_s else None,
                }

            # Source final × each target SYNTHESIS step → MACO scenario
            for tgt_grp in _tgt_synth_groups:
                s_objs = [e for e in shared_equipment
                          if e.equipment_id in src_final_eq
                          and e.equipment_id in tgt_grp["equipment_ids"]]
                if not s_objs:
                    continue
                s_eqs = [_maco_eq_limits(e) for e in s_objs]
                r_fins = [e["rinse_final"] for e in s_eqs if e["rinse_final"] is not None]
                s_fins = [e["swab_final"]  for e in s_eqs if e["swab_final"]  is not None]
                r_fin_v = round(min(r_fins), 4) if r_fins else None
                s_fin_v = round(min(s_fins), 4) if s_fins else None
                step_matrix_rows.append({
                    "source_step": 0,
                    "source_step_compound": None,
                    "target_step": tgt_grp["step_number"],
                    "target_step_compound": tgt_grp["test_compound"],
                    "scenario": "maco",
                    "shared_equipment": s_eqs,
                    "maco_pde":   round(maco_pde,  4) if maco_pde  else None,
                    "maco_dose":  round(maco_dose, 4) if maco_dose else None,
                    "maco_10ppm": round(maco_10ppm, 4),
                    "rinse_limit_final": r_fin_v,
                    "swab_limit_final":  s_fin_v,
                    "rinse_status_final": _status(r_fin_v),
                    "swab_status_final":  _status(s_fin_v),
                    "total_rinse_vol_L": round(sum(e["rinse_volume_L"] for e in s_eqs), 2),
                    "total_area_in2":    round(sum(e["surface_area_in2"] for e in s_eqs), 2),
                    "loq_ppm": loq,
                })

            # Source SYNTHESIS steps × each target step (final + synthesis) → 10 ppm
            # Only synthesis-ONLY source equipment (not also used in source final step).
            if has_synthesis_steps:
                all_tgt_step_combos = [(0, None, _tgt_final_eq)] + [
                    (g["step_number"], g["test_compound"], g["equipment_ids"])
                    for g in _tgt_synth_groups
                ]
                for src_grp in src_synth_step_groups:
                    _synth_only_ids_smr = src_grp["equipment_ids"] - src_final_product_eq_ids
                    if not _synth_only_ids_smr:
                        continue  # all equipment in this synthesis step is also in final step → MACO
                    for t_step, t_compound, t_eq_ids in all_tgt_step_combos:
                        s_objs = [e for e in shared_equipment
                                  if e.equipment_id in _synth_only_ids_smr
                                  and e.equipment_id in t_eq_ids]
                        if not s_objs:
                            continue
                        s_eqs = [{**_eq_info(e), "rinse_final": 10.0, "swab_final": 10.0} for e in s_objs]
                        step_matrix_rows.append({
                            "source_step": src_grp["step_number"],
                            "source_step_compound": src_grp["test_compound"],
                            "target_step": t_step,
                            "target_step_compound": t_compound,
                            "scenario": "fixed_10ppm_synthesis",
                            "shared_equipment": s_eqs,
                            "rinse_limit_final": 10.0,
                            "swab_limit_final":  10.0,
                            "rinse_status_final": _status(10.0),
                            "swab_status_final":  _status(10.0),
                            "total_rinse_vol_L": round(sum(e["rinse_volume_L"] for e in s_eqs), 2),
                            "total_area_in2":    round(sum(e["surface_area_in2"] for e in s_eqs), 2),
                            "loq_ppm": loq,
                        })

            results.append({
                "target_product": tgt.product_name,
                "shared_equipment": shared_eq_list,
                "synthesis_step_equipment": synthesis_step_equipment,
                "step_matrix_rows": step_matrix_rows,
                "scenario": "maco_3method",
                "maco_pde":   round(maco_pde,   4) if maco_pde   else None,
                "maco_dose":  round(maco_dose,  4) if maco_dose  else None,
                "maco_10ppm": round(maco_10ppm, 4),
                "governing_maco_pair": round(maco_pair, 4) if maco_pair else None,
                "total_rinse_vol_L":   round(rv, 2),
                "total_area_in2":      round(sa, 2),
                "swab_area_sqin":           swa if not has_synthesis_steps else None,
                "rinse_sample_area_sqin":   rsa if not has_synthesis_steps else None,
                "rinse_limit_pde":        rinse_pde,    "rinse_limit_pde_raw":    rinse_pde_raw,
                "rinse_limit_dose":       rinse_dose,   "rinse_limit_dose_raw":   rinse_dose_raw,
                "rinse_limit_10ppm":      rinse_10ppm,  "rinse_limit_10ppm_raw":  rinse_10ppm_raw,
                "rinse_limit_final":      rinse_final,
                "swab_limit_pde":         swab_pde,     "swab_limit_pde_raw":     swab_pde_raw,
                "swab_limit_dose":        swab_dose,    "swab_limit_dose_raw":     swab_dose_raw,
                "swab_limit_10ppm":       swab_10ppm,   "swab_limit_10ppm_raw":   swab_10ppm_raw,
                "swab_limit_final":       swab_final,
                "rinse_status_pde":   _status(rinse_pde),
                "rinse_status_dose":  _status(rinse_dose),
                "rinse_status_10ppm": _status(rinse_10ppm),
                "rinse_status_final": _status(rinse_final),
                "swab_status_pde":    _status(swab_pde),
                "swab_status_dose":   _status(swab_dose),
                "swab_status_10ppm":  _status(swab_10ppm),
                "swab_status_final":  _status(swab_final),
                "loq_ppm": loq,
            })

    # Save run snapshot for history
    run = MacoRun(
        run_at=datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        run_by=current_user.username,
        source_product_id=src.product_id,
        source_product_name=src.product_name,
        source_pde=src.pde_mg_day,
        source_min_dose=src.min_therapeutic_dose_mg,
        source_loq=src.loq_ppm,
        source_lod=src.lod_ppm,
        source_method=src.analytical_method,
        governing_maco=round(governing_maco, 4) if governing_maco else None,
        result_json=json.dumps(results),
    )
    db.add(run)

    log_audit(db, "MACO_MATRIX", "PRODUCT", src.product_id,
              "matrix_run", "", f"governing_maco={governing_maco}",
              current_user.username)
    db.commit()

    # Build top-level synthesis_steps list (all synthesis-step equipment of the source product,
    # not limited to what's shared with any specific target — for protocol Section 5 display)
    all_synth_eq_ids = set().union(*(g["equipment_ids"] for g in src_synth_step_groups)) if src_synth_step_groups else set()
    all_synth_eq_objs = {e.equipment_id: e for e in db.query(Equipment).filter(
        Equipment.equipment_id.in_(list(all_synth_eq_ids))
    ).all()} if all_synth_eq_ids else {}

    synthesis_steps_summary = [
        {
            "step_number": grp["step_number"],
            "test_compound": grp["test_compound"],
            "equipment": [{
                "name": all_synth_eq_objs[eid].equipment_name,
                "category_id": all_synth_eq_objs[eid].category_id,
                "category_name": cats.get(all_synth_eq_objs[eid].category_id),
                "surface_area_in2": round(all_synth_eq_objs[eid].surface_area_cm2 / 6.4516, 2) if all_synth_eq_objs[eid].surface_area_cm2 else 0,
                "rinse_volume_L": round(all_synth_eq_objs[eid].rinse_volume_liters, 2) if all_synth_eq_objs[eid].rinse_volume_liters else 0,
                "swab_area_sqin": src_swab_map.get(eid, 9),
                "rinse_sample_area_sqin": src_rinse_map.get(eid, 9),
                "rinse_final": 10.0,
                "swab_final": 10.0,
            } for eid in grp["equipment_ids"]
              if eid in all_synth_eq_objs
              and eid not in src_final_product_eq_ids],  # synthesis-only equipment
        }
        for grp in src_synth_step_groups
        if (grp["equipment_ids"] - src_final_product_eq_ids)  # skip steps with no synthesis-only equipment
    ]

    return {
        "run_id": run.run_id,
        "source": src.product_name,
        "analytical_method": src.analytical_method,
        "lod_ppm": src.lod_ppm,
        "loq_ppm": src.loq_ppm,
        "governing_maco": round(governing_maco, 4) if governing_maco else None,
        "policy": policy,
        "policy_label": VALID_POLICIES.get(policy, policy),
        "scenario": "fixed_10ppm" if is_fixed_10ppm else "maco_3method",
        "source_category": src_category,
        "synthesis_steps": synthesis_steps_summary,
        "data": results
    }

# ===================================================
# MACO RUN HISTORY
# ===================================================
@app.get("/maco/runs/{product_id}")
def get_maco_runs(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    runs = db.query(MacoRun).filter(
        MacoRun.source_product_id == product_id
    ).order_by(MacoRun.run_id.desc()).limit(20).all()

    return [
        {
            "run_id": r.run_id,
            "run_at": r.run_at,
            "run_by": r.run_by,
            "source_product_name": r.source_product_name,
            "source_pde": r.source_pde,
            "source_min_dose": r.source_min_dose,
            "source_loq": r.source_loq,
            "source_lod": r.source_lod,
            "source_method": r.source_method,
            "governing_maco": r.governing_maco,
            "result_json": r.result_json,
        }
        for r in runs
    ]

# ===================================================
# VALIDATION STRATEGY
# ===================================================
_USP_LABELS = {
    1: "Very Soluble (<1 part)",
    2: "Freely Soluble (1–10 parts)",
    3: "Soluble (10–30 parts)",
    4: "Sparingly Soluble (30–100 parts)",
    5: "Slightly Soluble (100–1000 parts)",
    6: "Very Slightly Soluble (1000–10000 parts)",
    7: "Practically Insoluble (>10000 parts)",
}
_RISK_LEVELS = {
    1: "Very Low",
    2: "Low",
    3: "Low-Medium",
    4: "Medium",
    5: "High",
    6: "Very High",
    7: "Critical",
}

@app.get("/validation/strategy-data")
def get_validation_strategy_data(
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    facilities_map = {f.facility_id: f.facility_name for f in db.query(Facility).all()}

    # Active products (optionally filtered by facility)
    prod_q = db.query(Product).filter((Product.is_archived == False) | (Product.is_archived == None))
    if facility_id:
        prod_q = prod_q.filter(Product.facility_id == facility_id)
    products = prod_q.order_by(Product.product_name).all()
    product_map = {p.product_id: p for p in products}

    # ── All-products plan ──────────────────────────────────────────────
    all_products_out = [
        {
            "product_id": p.product_id,
            "product_name": p.product_name,
            "facility_id": p.facility_id,
            "facility_name": facilities_map.get(p.facility_id, "—"),
            "solubility_usp": p.solubility_usp,
            "solubility_label": _USP_LABELS.get(p.solubility_usp, "Not Specified"),
            "risk_level": _RISK_LEVELS.get(p.solubility_usp, "Unknown"),
            "soluble_solvent": p.soluble_solvent or "—",
            "min_runs": 3,
        }
        for p in products
    ]
    # Sort: products with solubility data first, then unknowns; within each group by risk desc
    all_products_out.sort(key=lambda x: (x["solubility_usp"] is None, -(x["solubility_usp"] or 0)))

    # ── Worst-case plan ────────────────────────────────────────────────
    eq_q = db.query(Equipment)
    if facility_id:
        eq_q = eq_q.filter(Equipment.facility_id == facility_id)
    equip_list = eq_q.order_by(Equipment.equipment_name).all()
    cats = {c.category_id: c.category_name for c in db.query(EquipmentCategory).all()}

    eq_ids = [e.equipment_id for e in equip_list]
    pe_rows = (
        db.query(ProductEquipment).filter(ProductEquipment.equipment_id.in_(eq_ids)).all()
        if eq_ids else []
    )
    eq_prod_map: dict = {}
    for pe in pe_rows:
        eq_prod_map.setdefault(pe.equipment_id, []).append(pe.product_id)

    active_ids = set(product_map.keys())
    worst_case_out = []

    for eq in equip_list:
        prod_ids = [pid for pid in eq_prod_map.get(eq.equipment_id, []) if pid in active_ids]
        eq_prods = [product_map[pid] for pid in prod_ids]

        # Rank: highest USP number = lowest solubility = worst case
        # Unknown solubility (None) placed last in ranking
        eq_prods_sorted = sorted(
            eq_prods,
            key=lambda p: (p.solubility_usp is None, -(p.solubility_usp or 0))
        )
        worst_prod = eq_prods_sorted[0] if eq_prods_sorted else None

        worst_case_out.append({
            "equipment_id": eq.equipment_id,
            "equipment_name": eq.equipment_name,
            "facility_id": eq.facility_id,
            "facility_name": facilities_map.get(eq.facility_id, "—"),
            "category_name": cats.get(eq.category_id, "—"),
            "surface_area_in2": round(eq.surface_area_cm2 / 6.4516, 2) if eq.surface_area_cm2 else 0,
            "product_count": len(prod_ids),
            "products": [
                {
                    "product_id": p.product_id,
                    "product_name": p.product_name,
                    "solubility_usp": p.solubility_usp,
                    "solubility_label": _USP_LABELS.get(p.solubility_usp, "Not Specified"),
                    "risk_level": _RISK_LEVELS.get(p.solubility_usp, "Unknown"),
                    "is_worst_case": worst_prod is not None and p.product_id == worst_prod.product_id,
                }
                for p in eq_prods_sorted
            ],
            "worst_case_product": {
                "product_id": worst_prod.product_id,
                "product_name": worst_prod.product_name,
                "solubility_usp": worst_prod.solubility_usp,
                "solubility_label": _USP_LABELS.get(worst_prod.solubility_usp, "Not Specified"),
                "risk_level": _RISK_LEVELS.get(worst_prod.solubility_usp, "Unknown"),
                "soluble_solvent": worst_prod.soluble_solvent or "—",
            } if worst_prod else None,
            "solubility_usp": worst_prod.solubility_usp if worst_prod else None,
            "risk_level": _RISK_LEVELS.get(
                worst_prod.solubility_usp if worst_prod else None, "No Products"
            ),
        })

    # Sort equipment: highest-risk worst-case first; no-product equipment at bottom
    worst_case_out.sort(
        key=lambda x: (x["worst_case_product"] is None, -(x["solubility_usp"] or 0))
    )

    missing_sol = sum(1 for p in all_products_out if not p["solubility_usp"])
    unique_wc = len({
        x["worst_case_product"]["product_id"]
        for x in worst_case_out if x["worst_case_product"]
    })

    return {
        "all_products": all_products_out,
        "worst_case": worst_case_out,
        "summary": {
            "total_products": len(all_products_out),
            "total_equipment": len(worst_case_out),
            "total_runs_all": len(all_products_out) * 3,
            "total_runs_worst": len(worst_case_out) * 3,
            "unique_worst_case_products": unique_wc,
            "products_missing_solubility": missing_sol,
            "equipment_no_products": sum(1 for e in worst_case_out if e["product_count"] == 0),
        },
    }

# ===================================================
# AUDIT VIEW
# ===================================================
@app.get("/audit/all")
def audit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_VIEW_AUDIT)
    return db.query(AuditLog).order_by(AuditLog.audit_id.desc()).all()

@app.get("/audit/product/{product_id}")
def audit_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_VIEW_AUDIT)
    return db.query(AuditLog).filter(
        AuditLog.entity_type == "PRODUCT",
        AuditLog.entity_id == str(product_id)
    ).order_by(AuditLog.audit_id.desc()).all()

# ===================================================
# USER MANAGEMENT
# ===================================================
class UserRequest(BaseModel):
    username: str
    password: str
    role: str
    admin_password: str

@app.post("/users/add")
def add_user(
    req: UserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_MANAGE_USERS)

    if not verify_password(req.admin_password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=req.username,
        password=hash_password(req.password),
        role=req.role,
        force_password_reset=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(db, "CREATE", "USER", new_user.user_id,
              "username", "", req.username, current_user.username)

    return {"message": "User created", "user_id": new_user.user_id}

@app.get("/users/all")
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_MANAGE_USERS)
    return db.query(User).filter(
        (User.is_archived == False) | (User.is_archived == None)
    ).all()

@app.get("/users/archived")
def get_archived_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ROLES_CAN_MANAGE_USERS)
    return db.query(User).filter(User.is_archived == True).all()

class UserArchiveRequest(BaseModel):
    password: str
    reason: str

@app.post("/users/restore/{username}")
def restore_user(
    username: str,
    req: UserArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_archived:
        raise HTTPException(status_code=400, detail="User is not archived")

    user.is_archived = False
    user.archived_by = None
    user.archived_at = None
    db.commit()

    log_audit(db, "UPDATE", "USER", user.user_id,
              "is_archived", "True", "False",
              current_user.username + " | Reason: " + req.reason)

    return {"message": f"User '{username}' restored successfully"}

# ===================================================
# RESET PASSWORD (admin resets another user's password)
# ===================================================
class ResetPasswordRequest(BaseModel):
    new_password: str
    admin_password: str

@app.post("/users/reset-password/{username}")
def reset_user_password(
    username: str,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["ADMIN"])

    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Use Change Password to update your own password")

    if not verify_password(req.admin_password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect admin password ❌")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(req.new_password)
    user.force_password_reset = True
    db.commit()

    log_audit(db, "RESET_PASSWORD", "USER", user.user_id,
              "password", "", "reset by admin", current_user.username)
    logger.info(f"Admin {current_user.username} reset password for {username}")

    return {"message": f"Password reset for '{username}'. User must change it on next login."}

# ===================================================
# CHANGE OWN PASSWORD
# ===================================================
class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

@app.post("/users/change-password")
def change_own_password(
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Force-reset path: user just authenticated via login, skip current-password check
    if not current_user.force_password_reset:
        if not req.current_password or not verify_password(req.current_password, current_user.password):
            raise HTTPException(status_code=401, detail="Current password is incorrect ❌")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    current_user.password = hash_password(req.new_password)
    current_user.force_password_reset = False
    db.commit()

    log_audit(db, "CHANGE_PASSWORD", "USER", current_user.user_id,
              "password", "", "changed by user", current_user.username)
    logger.info(f"User {current_user.username} changed their password")

    return {"message": "Password changed successfully ✅"}

@app.post("/users/archive/{username}")
def archive_user(
    username: str,
    req: UserArchiveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot archive your own account ❌")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_archived = True
    user.archived_by = current_user.username
    user.archived_at = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    db.commit()

    log_audit(db, "UPDATE", "USER", user.user_id,
              "is_archived", "False", "True",
              current_user.username + " | Reason: " + req.reason)

    return {"message": f"User '{username}' archived successfully"}

# ===================================================
# LOGIN
# ===================================================
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()

    valid = (
        user is not None and
        not user.is_archived and
        user.password is not None and
        verify_password(req.password, user.password)
    )
    if not valid:
        logger.warning(f"Failed login attempt for username: {req.username}")
        try:
            log_audit(db, "LOGIN_FAIL", "USER", req.username,
                      "login", "", "failed", req.username)
        except Exception:
            pass
        raise HTTPException(status_code=401, detail="Invalid username or password")

    logger.info(f"Login: {user.username} ({user.role})")
    log_audit(db, "LOGIN", "USER", user.user_id,
              "login", "", "success", user.username)

    token_data = {
        "sub":  user.username,
        "role": user.role,
        "exp":  datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRE_H),
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return {
        "message":              "Login successful",
        "token":                token,
        "username":             user.username,
        "role":                 user.role,
        "force_password_reset": bool(user.force_password_reset),
    }
# ===================================================
# UPDATE EQUIPMENT
# ===================================================
class EquipmentUpdateRequest(BaseModel):
    surface_area_in2: float
    rinse_volume_liters: float
    category_id: Optional[int] = None
    password: str
    reason: str

@app.put("/equipment/update/{equipment_id}")
def update_equipment(
    equipment_id: int,
    req: EquipmentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    equipment = db.query(Equipment).filter(
        Equipment.equipment_id == equipment_id
    ).first()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    old_area = round(equipment.surface_area_cm2 / 6.4516, 2)
    old_rinse = equipment.rinse_volume_liters
    old_cat = equipment.category_id

    equipment.surface_area_cm2 = req.surface_area_in2 * 6.4516
    equipment.rinse_volume_liters = req.rinse_volume_liters
    equipment.category_id = req.category_id

    db.commit()

    log_audit(db, "UPDATE", "EQUIPMENT", equipment_id,
              "surface_area/rinse_volume/category",
              f"area={old_area}in² rinse={old_rinse}L cat={old_cat}",
              f"area={req.surface_area_in2}in² rinse={req.rinse_volume_liters}L cat={req.category_id}",
              current_user.username + " | Reason: " + req.reason)

    return {"message": "Equipment updated successfully"}

# ===================================================
# UPDATE PRODUCT
# ===================================================
class ProductUpdateRequest(BaseModel):
    min_therapeutic_dose_mg: float
    max_daily_dose_mg: float
    pde_mg_day: float
    min_yield_kg: float
    max_batch_size_kg: float
    lod_ppm: float
    loq_ppm: float
    analytical_method: str
    solubility_usp: Optional[int] = None
    soluble_solvent: str = ""
    product_category: Optional[str] = None
    therapeutic_category: Optional[str] = None
    route_of_administration: Optional[str] = None
    cas_number: Optional[str] = None
    chemical_number: Optional[str] = None
    final_product_id: Optional[int] = None
    synthesis_steps:    List[SynthStep] = []
    step_equipment_map: List[StepEquipmentEntry] = []
    equipment_ids: List[int]
    password: str
    reason: str

@app.put("/product/update/{product_id}")
def update_product(
    product_id: int,
    req: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    product = db.query(Product).filter(
        Product.product_id == product_id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    actor = current_user.username + " | Reason: " + req.reason

    # Log each changed field individually for full version history
    field_map = [
        ("min_therapeutic_dose_mg", product.min_therapeutic_dose_mg, req.min_therapeutic_dose_mg),
        ("max_daily_dose_mg",       product.max_daily_dose_mg,       req.max_daily_dose_mg),
        ("pde_mg_day",              product.pde_mg_day,              req.pde_mg_day),
        ("min_yield_kg",            product.min_yield_kg,            req.min_yield_kg),
        ("max_batch_size_kg",       product.max_batch_size_kg,       req.max_batch_size_kg),
        ("lod_ppm",                 product.lod_ppm,                 req.lod_ppm),
        ("loq_ppm",                 product.loq_ppm,                 req.loq_ppm),
        ("analytical_method",       product.analytical_method,       req.analytical_method),
        ("solubility_usp",          product.solubility_usp,          req.solubility_usp),
        ("soluble_solvent",         product.soluble_solvent,         req.soluble_solvent),
        ("product_category",        product.product_category,        req.product_category),
        ("therapeutic_category",    product.therapeutic_category,    req.therapeutic_category),
        ("route_of_administration", product.route_of_administration, req.route_of_administration),
        ("cas_number",              product.cas_number,              req.cas_number),
        ("chemical_number",         product.chemical_number,         req.chemical_number),
        ("final_product_id",        product.final_product_id,        req.final_product_id),
    ]
    for field, old_val, new_val in field_map:
        if str(old_val) != str(new_val):
            log_audit(db, "UPDATE", "PRODUCT", product_id,
                      field, str(old_val), str(new_val), actor)

    # Log equipment mapping changes
    old_eq_ids = sorted([
        pe.equipment_id for pe in
        db.query(ProductEquipment).filter(
            ProductEquipment.product_id == product_id
        ).all()
    ])
    new_eq_ids = sorted(req.equipment_ids)
    if old_eq_ids != new_eq_ids:
        log_audit(db, "UPDATE", "PRODUCT", product_id,
                  "equipment_ids", str(old_eq_ids), str(new_eq_ids), actor)

    # Apply updates
    product.min_therapeutic_dose_mg = req.min_therapeutic_dose_mg
    product.max_daily_dose_mg       = req.max_daily_dose_mg
    product.pde_mg_day              = req.pde_mg_day
    product.min_yield_kg            = req.min_yield_kg
    product.max_batch_size_kg       = req.max_batch_size_kg
    product.lod_ppm                 = req.lod_ppm
    product.loq_ppm                 = req.loq_ppm
    product.analytical_method       = req.analytical_method
    product.solubility_usp          = req.solubility_usp
    product.soluble_solvent         = req.soluble_solvent
    product.product_category        = req.product_category
    product.therapeutic_category    = req.therapeutic_category
    product.route_of_administration = req.route_of_administration
    product.cas_number              = req.cas_number
    product.chemical_number         = req.chemical_number
    product.final_product_id        = req.final_product_id

    db.query(ProductEquipment).filter(
        ProductEquipment.product_id == product_id
    ).delete()
    for eq in req.equipment_ids:
        db.add(ProductEquipment(product_id=product_id, equipment_id=eq))

    # Replace synthesis steps
    db.query(ProductSynthesisStep).filter(
        ProductSynthesisStep.product_id == product_id
    ).delete()
    for i, step in enumerate(req.synthesis_steps):
        if step.step_name or step.iupac_name:
            db.add(ProductSynthesisStep(
                product_id=product_id,
                step_number=i + 1,
                step_name=step.step_name or None,
                iupac_name=step.iupac_name or None,
                soluble_solvent=step.soluble_solvent or None,
                solubility_usp=step.solubility_usp,
                analytical_method=step.analytical_method or None,
                lod_ppm=step.lod_ppm,
                loq_ppm=step.loq_ppm,
            ))

    # Replace step-equipment mapping
    db.query(ProductStepEquipment).filter(
        ProductStepEquipment.product_id == product_id
    ).delete()
    for entry in req.step_equipment_map:
        db.add(ProductStepEquipment(
            product_id=product_id,
            step_number=entry.step_number,
            equipment_id=entry.equipment_id,
            test_compound=entry.test_compound,
            usage_sequence=entry.usage_sequence,
            is_test_compound=entry.is_test_compound,
            swab_area_sqin=entry.swab_area_sqin if entry.swab_area_sqin is not None else 9,
            rinse_sample_area_sqin=entry.rinse_sample_area_sqin if entry.rinse_sample_area_sqin is not None else 9,
            optional_equipment_ids=json.dumps(entry.optional_equipment_ids or []),
            optional_swab_areas=json.dumps(entry.optional_swab_areas or {}),
            optional_rinse_sample_areas=json.dumps(entry.optional_rinse_sample_areas or {}),
        ))

    db.commit()

    return {"message": "Product updated successfully"}
# ===================================================
# NLP QUERY
# ===================================================
class NLPRequest(BaseModel):
    question: str

@app.post("/nlp/query")
def nlp_query(req: NLPRequest, db: Session = Depends(get_db)):
    try:
        facilities = db.query(Facility).all()
        equipment  = db.query(Equipment).all()
        products   = db.query(Product).filter(
            (Product.is_archived == False) | (Product.is_archived == None)
        ).all()
        audits = db.query(AuditLog).order_by(AuditLog.audit_id.desc()).limit(10).all()

        # Compact context — only fields needed to answer questions
        context = {
            "facilities": [{"id": f.facility_id, "name": f.facility_name} for f in facilities],
            "equipment": [
                {"name": e.equipment_name, "facility_id": e.facility_id,
                 "surface_area_in2": round(e.surface_area_cm2 / 6.4516, 2),
                 "rinse_vol_L": e.rinse_volume_liters or 0}
                for e in equipment
            ],
            "products": [
                {"name": p.product_name, "facility_id": p.facility_id,
                 "pde_mg_day": p.pde_mg_day,
                 "min_dose_mg": p.min_therapeutic_dose_mg,
                 "max_dose_mg": p.max_daily_dose_mg,
                 "loq_ppm": p.loq_ppm,
                 "method": p.analytical_method}
                for p in products
            ],
            "recent_audit": [
                {"event": a.event_type, "entity": a.entity_type,
                 "by": a.performed_by, "when": str(a.timestamp)}
                for a in audits
            ],
        }

        db_summary = json.dumps(context, separators=(",", ":"))

        prompt = f"""You are an AI assistant for a pharmaceutical cleaning validation app.
Use ONLY the data below. Answer concisely and factually.

DATA:{db_summary}

QUESTION: {req.question}

Output ONLY a JSON object. No markdown, no explanation, no extra text.
For a simple answer use:
{{"text":"your answer here","response_type":"text","table":null,"chart":null}}
For a list of items use:
{{"text":"","response_type":"table","table":{{"columns":["Name","Value"],"rows":[["item1","val1"]]}},"chart":null}}
All row values must be strings.

JSON:"""

        raw = call_ollama(prompt).strip()

        # strip markdown fences
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        # extract first JSON object if model added trailing text
        brace = raw.find("{")
        if brace > 0:
            raw = raw[brace:]
        last = raw.rfind("}")
        if last != -1 and last < len(raw) - 1:
            raw = raw[:last + 1]

        try:
            result = json.loads(raw)
        except Exception:
            result = {"text": raw, "response_type": "text", "table": None, "chart": None}

        # clean up small-model artifacts in the text field
        text_val = result.get("text", "")
        if isinstance(text_val, str):
            text_val = text_val.strip()
            # strip regex-style delimiters:  /"value"/  →  value
            if text_val.startswith("/") and text_val.endswith("/"):
                text_val = text_val[1:-1].strip()
            # unescape stray backslash-quotes
            text_val = text_val.replace('\\"', '"').replace("\\'", "'")
            result["text"] = text_val

        # ensure required keys exist
        result.setdefault("table", None)
        result.setdefault("chart", None)
        result.setdefault("response_type", "text")

        return result

    except Exception as e:
        print(f"NLP ERROR: {e}")
        return {"text": f"Error: {str(e)}", "response_type": "text", "table": None, "chart": None}
# ===================================================
# SAMPLING PLAN
# ===================================================

def _next_sample_number(db) -> str:
    nums = []
    for e in db.query(SamplingPlanEntry).all():
        try:
            nums.append(int(e.sample_number.split("-")[1]))
        except Exception:
            pass
    return f"S-{(max(nums) + 1):04d}" if nums else "S-0001"

@app.get("/sampling/plan")
def get_sampling_plan(db: Session = Depends(get_db)):
    categories = db.query(EquipmentCategory).order_by(EquipmentCategory.category_name).all()
    return [
        {
            "category_id": cat.category_id,
            "category_name": cat.category_name,
            "entries": [
                {
                    "entry_id": e.entry_id,
                    "sample_number": e.sample_number,
                    "location_description": e.location_description,
                    "sequence": e.sequence,
                }
                for e in db.query(SamplingPlanEntry)
                          .filter(SamplingPlanEntry.category_id == cat.category_id)
                          .order_by(SamplingPlanEntry.sequence, SamplingPlanEntry.entry_id)
                          .all()
            ],
        }
        for cat in categories
    ]

class SamplingEntryRequest(BaseModel):
    category_id: int
    location_description: str
    password: str

class SamplingEntryUpdateRequest(BaseModel):
    location_description: str
    password: str
    reason: str

@app.post("/sampling/plan/entry")
def add_sampling_entry(
    req: SamplingEntryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    cat = db.query(EquipmentCategory).filter(EquipmentCategory.category_id == req.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    sample_number = _next_sample_number(db)
    seq = db.query(SamplingPlanEntry).filter(SamplingPlanEntry.category_id == req.category_id).count() + 1
    entry = SamplingPlanEntry(
        category_id=req.category_id,
        sample_number=sample_number,
        location_description=req.location_description.strip(),
        sequence=seq,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_audit(db, "CREATE", "SAMPLING_PLAN", entry.entry_id,
              "sample_number", "", sample_number, current_user.username)
    return {"entry_id": entry.entry_id, "sample_number": sample_number}

@app.put("/sampling/plan/entry/{entry_id}")
def update_sampling_entry(
    entry_id: int,
    req: SamplingEntryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    entry = db.query(SamplingPlanEntry).filter(SamplingPlanEntry.entry_id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    old_desc = entry.location_description
    entry.location_description = req.location_description.strip()
    db.commit()
    log_audit(db, "UPDATE", "SAMPLING_PLAN", entry_id,
              "location_description", old_desc, req.location_description,
              current_user.username + " | " + req.reason)
    return {"message": "Updated"}

@app.delete("/sampling/plan/entry/{entry_id}")
def delete_sampling_entry(
    entry_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    entry = db.query(SamplingPlanEntry).filter(SamplingPlanEntry.entry_id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    log_audit(db, "DELETE", "SAMPLING_PLAN", entry_id,
              "sample_number", entry.sample_number, "", current_user.username)
    db.delete(entry)
    db.commit()
    return {"message": "Deleted"}

# ===================================================
# PROTOCOL ARCHIVE
# ===================================================
class ArchiveSaveRequest(BaseModel):
    snapshot: dict
    doc_number: str
    product_id: int
    product_name: str
    facility_name: str
    status: str = "Draft"

@app.post("/protocol/archive")
def save_protocol_archive(
    req: ArchiveSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    last = (db.query(ProtocolArchive)
            .filter(ProtocolArchive.doc_number == req.doc_number)
            .order_by(ProtocolArchive.version.desc())
            .first())
    version = (last.version + 1) if last else 1
    archive = ProtocolArchive(
        doc_number=req.doc_number,
        version=version,
        product_id=req.product_id,
        product_name=req.product_name,
        facility_name=req.facility_name,
        generated_by=current_user.username,
        generated_at=datetime.datetime.utcnow().isoformat(),
        snapshot_json=json.dumps(req.snapshot, separators=(",", ":")),
        status=req.status,
    )
    db.add(archive)
    db.commit()
    db.refresh(archive)
    log_audit(db, "CREATE", "PROTOCOL_ARCHIVE", archive.archive_id,
              "doc_number", "", f"{req.doc_number} v{version}", current_user.username)
    return {"archive_id": archive.archive_id, "version": version, "doc_number": req.doc_number}

@app.get("/protocol/archives")
def list_protocol_archives(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(ProtocolArchive).order_by(ProtocolArchive.generated_at.desc()).all()
    return [
        {
            "archive_id": a.archive_id,
            "doc_number": a.doc_number,
            "version": a.version,
            "product_name": a.product_name,
            "facility_name": a.facility_name,
            "generated_by": a.generated_by,
            "generated_at": a.generated_at,
            "status": a.status,
        }
        for a in rows
    ]

@app.get("/protocol/archive/{archive_id}")
def get_protocol_archive(
    archive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    a = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == archive_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Archive not found")
    return {
        "archive_id": a.archive_id,
        "doc_number": a.doc_number,
        "version": a.version,
        "product_name": a.product_name,
        "facility_name": a.facility_name,
        "generated_by": a.generated_by,
        "generated_at": a.generated_at,
        "status": a.status,
        "snapshot": json.loads(a.snapshot_json),
    }

@app.delete("/protocol/archive/remove/{archive_id}")
def delete_protocol_archive(
    archive_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    a = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == archive_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Archive not found")
    log_audit(db, "DELETE", "PROTOCOL_ARCHIVE", archive_id,
              "doc_number", f"{a.doc_number} v{a.version}", "", current_user.username)
    db.delete(a)
    db.commit()
    return {"message": "Archive deleted"}

# ===================================================
# CLEANING VALIDATION REPORTS
# ===================================================
class ReportResultsData(BaseModel):
    runs: list = []
    training_details: Optional[str] = ""
    sop_followed: Optional[str] = ""
    start_date: Optional[str] = None
    completion_date: Optional[str] = None

class ReportCreateRequest(BaseModel):
    archive_id: int
    results_data: ReportResultsData
    password: Optional[str] = None
    is_draft: bool = False

class ReportUpdateRequest(BaseModel):
    results_data: ReportResultsData
    password: Optional[str] = None
    reason: str
    is_draft: bool = False

@app.post("/report/approved-protocols")
def get_approved_protocols(
    facility_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = (db.query(ProtocolArchive)
            .filter(ProtocolArchive.status == "Final",
                    ProtocolArchive.product_id == product_id)
            .order_by(ProtocolArchive.generated_at.desc())
            .all())
    return [
        {
            "archive_id": r.archive_id,
            "doc_number": r.doc_number,
            "version": r.version,
            "product_name": r.product_name,
            "facility_name": r.facility_name,
            "generated_by": r.generated_by,
            "generated_at": r.generated_at,
            "status": r.status,
        }
        for r in rows
    ]

@app.post("/report/create")
def create_report(
    req: ReportCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    # Full submit requires password; draft save does not
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission ❌")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password ❌")

    archive = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == req.archive_id).first()
    if not archive:
        raise HTTPException(status_code=404, detail="Protocol archive not found")
    if archive.status != "Final":
        raise HTTPException(status_code=400, detail="Protocol must be approved (status=Final)")

    # Block duplicate — only one report per protocol archive
    existing = db.query(CleaningValidationReport).filter(
        CleaningValidationReport.archive_id == req.archive_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A report already exists for this protocol (Report #{existing.report_id}, status: {existing.status or 'Submitted'}). Edit the existing report instead."
        )

    now = datetime.datetime.utcnow().isoformat()
    report = CleaningValidationReport(
        archive_id=req.archive_id,
        facility_id=int(json.loads(archive.snapshot_json).get("sourceProduct", {}).get("facility_id", 0)),
        facility_name=archive.facility_name,
        product_id=archive.product_id,
        product_name=archive.product_name,
        results_data=json.dumps(req.results_data.dict(), separators=(",", ":")),
        submitted_by=current_user.username,
        submitted_at=now,
        created_at=now,
        status="Draft" if req.is_draft else "Submitted",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    log_audit(db, "CREATE", "CLEANING_REPORT", report.report_id,
              "report_id", "", str(report.report_id), current_user.username)

    return {"report_id": report.report_id, "message": "Draft saved ✅" if req.is_draft else "Report submitted successfully ✅"}

@app.get("/report/list")
def list_reports(
    facility_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CleaningValidationReport)
    if facility_id:
        query = query.filter(CleaningValidationReport.facility_id == facility_id)
    if product_id:
        query = query.filter(CleaningValidationReport.product_id == product_id)

    rows = query.order_by(CleaningValidationReport.submitted_at.desc()).all()
    return [
        {
            "report_id": r.report_id,
            "archive_id": r.archive_id,
            "product_name": r.product_name,
            "facility_name": r.facility_name,
            "submitted_by": r.submitted_by,
            "submitted_at": r.submitted_at,
            "last_modified_by": r.last_modified_by,
            "last_modified_at": r.last_modified_at,
            "status": r.status or "Submitted",
            "approved_by": r.approved_by,
            "approved_at": r.approved_at,
        }
        for r in rows
    ]

@app.get("/report/by-archive/{archive_id}")
def get_report_by_archive(
    archive_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(CleaningValidationReport).filter(
        CleaningValidationReport.archive_id == archive_id
    ).first()
    if not report:
        return None
    return {
        "report_id": report.report_id,
        "status": report.status or "Submitted",
    }

@app.get("/report/{report_id}")
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(CleaningValidationReport).filter(CleaningValidationReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    archive = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == report.archive_id).first()

    return {
        "report_id": report.report_id,
        "archive_id": report.archive_id,
        "doc_number": archive.doc_number if archive else None,
        "product_name": report.product_name,
        "facility_name": report.facility_name,
        "submitted_by": report.submitted_by,
        "submitted_at": report.submitted_at,
        "last_modified_by": report.last_modified_by,
        "last_modified_at": report.last_modified_at,
        "results_data": json.loads(report.results_data),
        "protocol_generated_at": archive.generated_at if archive else None,
        "protocol_snapshot": json.loads(archive.snapshot_json) if archive else None,
    }

@app.post("/report/{report_id}/approve")
def approve_report(
    report_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    report = db.query(CleaningValidationReport).filter(CleaningValidationReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status == "Approved":
        raise HTTPException(status_code=400, detail="Report is already approved")
    if report.status == "Draft":
        raise HTTPException(status_code=400, detail="Cannot approve a Draft report. Submit it first ❌")

    report.status = "Approved"
    report.approved_by = current_user.username
    report.approved_at = datetime.datetime.utcnow().isoformat()
    db.commit()

    log_audit(db, "APPROVE", "CLEANING_REPORT", report_id,
              "status", "Submitted", "Approved", current_user.username)

    return {"message": "Report approved ✅", "report_id": report_id}

@app.put("/report/{report_id}")
def update_report(
    report_id: int,
    req: ReportUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])

    # Full submit requires password; draft save does not
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission ❌")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password ❌")

    report = db.query(CleaningValidationReport).filter(CleaningValidationReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status == "Approved":
        raise HTTPException(status_code=400, detail="Cannot edit an approved report ❌")

    old_data = report.results_data
    report.results_data = json.dumps(req.results_data.dict(), separators=(",", ":"))
    report.last_modified_by = current_user.username
    report.last_modified_at = datetime.datetime.utcnow().isoformat()
    if not req.is_draft:
        report.status = "Submitted"
    db.commit()

    log_audit(db, "UPDATE", "CLEANING_REPORT", report_id,
              "results_data", old_data[:100], report.results_data[:100], current_user.username)

    msg = "Draft saved ✅" if req.is_draft else "Report submitted successfully ✅"
    return {"report_id": report.report_id, "message": msg}

@app.delete("/report/{report_id}")
def delete_report(
    report_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    report = db.query(CleaningValidationReport).filter(CleaningValidationReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    log_audit(db, "DELETE", "CLEANING_REPORT", report_id,
              "report_id", str(report_id), "", current_user.username)
    db.delete(report)
    db.commit()

    return {"message": "Report deleted ✅"}

# ===================================================
# CONTINUOUS CLEANING VERIFICATION (CCV)
# ===================================================
class CCVResultsData(BaseModel):
    run: dict = {}
    training_details: Optional[str] = ""
    sop_followed: Optional[str] = ""
    completion_date: Optional[str] = None

class CCVCreateRequest(BaseModel):
    report_id: int
    archive_id: int
    results_data: CCVResultsData
    password: Optional[str] = None
    is_draft: bool = False

class CCVUpdateRequest(BaseModel):
    results_data: CCVResultsData
    password: Optional[str] = None
    reason: str
    is_draft: bool = False

@app.get("/ccv/eligible-products")
def ccv_eligible_products(
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = (db.query(CleaningValidationReport)
               .filter(CleaningValidationReport.status == "Approved"))
    if facility_id:
        query = query.filter(CleaningValidationReport.facility_id == facility_id)

    approved = query.order_by(CleaningValidationReport.product_name).all()
    seen = {}
    for r in approved:
        if r.product_id not in seen:
            seen[r.product_id] = {
                "product_id": r.product_id,
                "product_name": r.product_name,
                "facility_id": r.facility_id,
                "facility_name": r.facility_name,
            }
    return list(seen.values())

@app.get("/ccv/approved-reports")
def ccv_approved_reports(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = (db.query(CleaningValidationReport)
              .filter(CleaningValidationReport.status == "Approved",
                      CleaningValidationReport.product_id == product_id)
              .order_by(CleaningValidationReport.approved_at.desc())
              .all())
    return [
        {
            "report_id": r.report_id,
            "archive_id": r.archive_id,
            "product_name": r.product_name,
            "facility_name": r.facility_name,
            "submitted_by": r.submitted_by,
            "submitted_at": r.submitted_at,
            "approved_by": r.approved_by,
            "approved_at": r.approved_at,
        }
        for r in rows
    ]

@app.post("/ccv/create")
def create_ccv(
    req: CCVCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission ❌")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password ❌")

    report = db.query(CleaningValidationReport).filter(
        CleaningValidationReport.report_id == req.report_id,
        CleaningValidationReport.status == "Approved"
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Approved validation report not found")

    if req.is_draft:
        run_number = 0  # placeholder; assigned on submission
    else:
        completed_count = db.query(ContinuousCleaningVerification).filter(
            ContinuousCleaningVerification.product_id == report.product_id,
            ContinuousCleaningVerification.status == "Completed"
        ).count()
        run_number = completed_count + 1

    ccv = ContinuousCleaningVerification(
        archive_id=req.archive_id,
        report_id=req.report_id,
        facility_id=report.facility_id,
        facility_name=report.facility_name,
        product_id=report.product_id,
        product_name=report.product_name,
        run_number=run_number,
        results_data=json.dumps(req.results_data.dict(), separators=(",", ":")),
        submitted_by=current_user.username,
        submitted_at=datetime.datetime.utcnow().isoformat(),
        status="Draft" if req.is_draft else "Completed",
    )
    db.add(ccv)
    db.commit()
    db.refresh(ccv)

    log_audit(db, "CREATE", "CCV", ccv.ccv_id,
              "ccv_id", "", str(ccv.ccv_id), current_user.username)

    msg = "Draft saved ✅" if req.is_draft else "CCV run created ✅"
    return {"ccv_id": ccv.ccv_id, "run_number": ccv.run_number, "message": msg}

@app.get("/ccv/draft")
def get_ccv_draft(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    draft = db.query(ContinuousCleaningVerification).filter(
        ContinuousCleaningVerification.report_id == report_id,
        ContinuousCleaningVerification.status == "Draft"
    ).first()
    if not draft:
        return None
    return {
        "ccv_id": draft.ccv_id,
        "status": draft.status,
        "results_data": json.loads(draft.results_data) if draft.results_data else {},
    }

@app.get("/ccv/list")
def list_ccv(
    facility_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ContinuousCleaningVerification)
    if facility_id:
        query = query.filter(ContinuousCleaningVerification.facility_id == facility_id)
    if product_id:
        query = query.filter(ContinuousCleaningVerification.product_id == product_id)
    rows = query.order_by(ContinuousCleaningVerification.submitted_at.desc()).all()
    return [
        {
            "ccv_id": r.ccv_id,
            "run_number": r.run_number,
            "product_name": r.product_name,
            "facility_name": r.facility_name,
            "submitted_by": r.submitted_by,
            "submitted_at": r.submitted_at,
            "last_modified_by": r.last_modified_by,
            "last_modified_at": r.last_modified_at,
            "status": r.status,
            "report_id": r.report_id,
        }
        for r in rows
    ]

@app.get("/ccv/schedule")
def get_ccv_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cleaning verification schedule driven by approved validation reports."""
    interval_cfg = db.query(SystemConfig).filter(
        SystemConfig.config_key == "verification_interval_years").first()
    interval_years = int(interval_cfg.config_value) if interval_cfg else 3

    approved = (
        db.query(CleaningValidationReport)
        .filter(CleaningValidationReport.status == "Approved")
        .order_by(CleaningValidationReport.product_id,
                  CleaningValidationReport.approved_at.desc())
        .all()
    )

    by_product = {}
    for r in approved:
        if r.product_id not in by_product:
            by_product[r.product_id] = r

    # Latest completion per product
    all_completions = db.query(LifeCycleVerification).all()
    latest_completion = {}
    for lv in all_completions:
        prev = latest_completion.get(lv.product_id)
        if not prev or lv.completion_date > prev.completion_date:
            latest_completion[lv.product_id] = lv

    today = datetime.date.today()

    def add_years(d, n):
        try:
            return d.replace(year=d.year + n)
        except ValueError:
            return d.replace(year=d.year + n, day=28)

    def parse_date(s):
        return datetime.datetime.fromisoformat(s).date()

    result = []
    for product_id, report in by_product.items():
        date_str = report.approved_at or report.submitted_at
        try:
            validation_date = parse_date(date_str)
        except Exception:
            continue

        lv = latest_completion.get(product_id)
        if lv:
            try:
                base_date = datetime.date.fromisoformat(lv.completion_date)
            except Exception:
                base_date = validation_date
            completion_date = lv.completion_date
        else:
            base_date = validation_date
            completion_date = None

        next_due = add_years(base_date, interval_years)

        days_until = (next_due - today).days
        if days_until < 0:
            status = "Overdue"
        elif days_until <= 90:
            status = "Due Soon"
        else:
            status = "On Track"

        result.append({
            "product_id": product_id,
            "report_id": report.report_id,
            "product_name": report.product_name,
            "facility_name": report.facility_name,
            "validation_date": validation_date.isoformat(),
            "completion_date": completion_date,
            "next_due_date": next_due.isoformat(),
            "status": status,
            "interval_years": interval_years,
        })

    ORDER = {"Overdue": 0, "Due Soon": 1, "On Track": 2}
    result.sort(key=lambda x: (ORDER.get(x["status"], 9), x["product_name"]))
    return result


# ── Lifecycle interval config ────────────────────────────────────────
@app.get("/lifecycle/interval")
def get_lifecycle_interval(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    row = db.query(SystemConfig).filter(
        SystemConfig.config_key == "verification_interval_years").first()
    years = int(row.config_value) if row else 3
    return {"years": years, "updated_by": row.updated_by if row else None,
            "updated_at": row.updated_at if row else None}


class IntervalUpdateRequest(BaseModel):
    years: int
    password: str

@app.put("/lifecycle/interval")
def set_lifecycle_interval(
    req: IntervalUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["ADMIN"])
    if req.years < 1 or req.years > 10:
        raise HTTPException(status_code=400, detail="Interval must be between 1 and 10 years ❌")
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")
    row = db.query(SystemConfig).filter(
        SystemConfig.config_key == "verification_interval_years").first()
    if row:
        row.config_value = str(req.years)
        row.updated_by   = current_user.username
        row.updated_at   = datetime.datetime.utcnow().isoformat()
    else:
        db.add(SystemConfig(config_key="verification_interval_years",
                            config_value=str(req.years),
                            updated_by=current_user.username,
                            updated_at=datetime.datetime.utcnow().isoformat()))
    db.commit()
    return {"message": f"Verification interval updated to {req.years} year(s) ✅"}


# ── Lifecycle verification completions ────────────────────────────────
class LifeCycleVerificationRequest(BaseModel):
    product_id:      int
    report_id:       int
    completion_date: str   # YYYY-MM-DD
    password:        str

@app.post("/lifecycle/verification")
def log_lifecycle_verification(
    req: LifeCycleVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    try:
        datetime.date.fromisoformat(req.completion_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format ❌")

    report = db.query(CleaningValidationReport).filter(
        CleaningValidationReport.report_id == req.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Validation report not found")

    lv = LifeCycleVerification(
        product_id      = req.product_id,
        product_name    = report.product_name,
        facility_name   = report.facility_name,
        report_id       = req.report_id,
        completion_date = req.completion_date,
        created_by      = current_user.username,
        created_at      = datetime.datetime.utcnow().isoformat(),
    )
    db.add(lv)
    db.commit()
    db.refresh(lv)
    return {"id": lv.id, "message": "Verification completion logged ✅"}


@app.get("/lifecycle/verifications")
def list_lifecycle_verifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(LifeCycleVerification).order_by(
        LifeCycleVerification.completion_date.desc()).all()
    return [
        {
            "id":              r.id,
            "product_id":      r.product_id,
            "product_name":    r.product_name,
            "facility_name":   r.facility_name,
            "report_id":       r.report_id,
            "completion_date": r.completion_date,
            "created_by":      r.created_by,
            "created_at":      r.created_at,
        }
        for r in rows
    ]

@app.get("/ccv/{ccv_id}")
def get_ccv(
    ccv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ccv = db.query(ContinuousCleaningVerification).filter(ContinuousCleaningVerification.ccv_id == ccv_id).first()
    if not ccv:
        raise HTTPException(status_code=404, detail="CCV run not found")

    archive = db.query(ProtocolArchive).filter(ProtocolArchive.archive_id == ccv.archive_id).first()

    return {
        "ccv_id": ccv.ccv_id,
        "run_number": ccv.run_number,
        "archive_id": ccv.archive_id,
        "report_id": ccv.report_id,
        "product_name": ccv.product_name,
        "facility_name": ccv.facility_name,
        "submitted_by": ccv.submitted_by,
        "submitted_at": ccv.submitted_at,
        "last_modified_by": ccv.last_modified_by,
        "last_modified_at": ccv.last_modified_at,
        "status": ccv.status,
        "results_data": json.loads(ccv.results_data),
        "doc_number": archive.doc_number if archive else None,
        "protocol_snapshot": json.loads(archive.snapshot_json) if archive else None,
    }

@app.put("/ccv/{ccv_id}")
def update_ccv(
    ccv_id: int,
    req: CCVUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not req.is_draft:
        if not req.password:
            raise HTTPException(status_code=400, detail="Password required for submission ❌")
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password ❌")

    ccv = db.query(ContinuousCleaningVerification).filter(ContinuousCleaningVerification.ccv_id == ccv_id).first()
    if not ccv:
        raise HTTPException(status_code=404, detail="CCV run not found")

    old_data = ccv.results_data
    ccv.results_data = json.dumps(req.results_data.dict(), separators=(",", ":"))
    ccv.last_modified_by = current_user.username
    ccv.last_modified_at = datetime.datetime.utcnow().isoformat()

    if not req.is_draft and ccv.status == "Draft":
        completed_count = db.query(ContinuousCleaningVerification).filter(
            ContinuousCleaningVerification.product_id == ccv.product_id,
            ContinuousCleaningVerification.status == "Completed"
        ).count()
        ccv.run_number = completed_count + 1
        ccv.status = "Completed"

    db.commit()

    log_audit(db, "UPDATE", "CCV", ccv_id,
              "results_data", old_data[:100], ccv.results_data[:100], current_user.username)

    msg = "Draft saved ✅" if req.is_draft else "CCV run submitted ✅"
    return {"ccv_id": ccv.ccv_id, "run_number": ccv.run_number, "message": msg}

@app.delete("/ccv/{ccv_id}")
def delete_ccv(
    ccv_id: int,
    req: DeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_role(current_user.role, ["QA", "ADMIN"])
    if not verify_password(req.password, current_user.password):
        raise HTTPException(status_code=401, detail="Incorrect password ❌")

    ccv = db.query(ContinuousCleaningVerification).filter(ContinuousCleaningVerification.ccv_id == ccv_id).first()
    if not ccv:
        raise HTTPException(status_code=404, detail="CCV run not found")

    log_audit(db, "DELETE", "CCV", ccv_id,
              "ccv_id", str(ccv_id), "", current_user.username)
    db.delete(ccv)
    db.commit()
    return {"message": "CCV run deleted ✅"}


# ===================================================
# DASHBOARD SUMMARY
# ===================================================
@app.get("/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    facilities  = db.query(Facility).all()
    fac_map     = {f.facility_id: f.facility_name for f in facilities}

    products    = db.query(Product).filter(Product.is_archived == False).all()
    prod_fac    = {p.product_id: p.facility_id for p in products}

    final_protos = db.query(ProtocolArchive).filter(ProtocolArchive.status == "Final").all()

    reports          = db.query(CleaningValidationReport).all()
    reported_arc_ids = {r.archive_id for r in reports}

    # --- per-facility aggregation ---
    fac_stats = {
        f.facility_id: {
            "facility_id":     f.facility_id,
            "facility_name":   f.facility_name,
            "product_count":   0,
            "protocol_count":  0,
            "report_count":    0,
            "pending_count":   0,
        }
        for f in facilities
    }
    for p in products:
        if p.facility_id in fac_stats:
            fac_stats[p.facility_id]["product_count"] += 1

    for a in final_protos:
        fid = prod_fac.get(a.product_id)
        if fid and fid in fac_stats:
            fac_stats[fid]["protocol_count"] += 1
            if a.archive_id in reported_arc_ids:
                fac_stats[fid]["report_count"] += 1
            else:
                fac_stats[fid]["pending_count"] += 1

    # --- per-product aggregation ---
    prod_stats = {
        p.product_id: {
            "product_id":         p.product_id,
            "product_name":       p.product_name,
            "facility_id":        p.facility_id,
            "facility_name":      fac_map.get(p.facility_id, "—"),
            "protocol_count":     0,
            "report_count":       0,
            "pending_count":      0,
            "latest_protocol_at": None,
        }
        for p in products
    }
    for a in final_protos:
        pid = a.product_id
        if pid in prod_stats:
            prod_stats[pid]["protocol_count"] += 1
            at = a.generated_at or ""
            if at > (prod_stats[pid]["latest_protocol_at"] or ""):
                prod_stats[pid]["latest_protocol_at"] = at
            if a.archive_id in reported_arc_ids:
                prod_stats[pid]["report_count"] += 1
            else:
                prod_stats[pid]["pending_count"] += 1

    pending_total = sum(1 for a in final_protos if a.archive_id not in reported_arc_ids)

    return {
        "totals": {
            "facilities":         len(facilities),
            "products":           len(products),
            "approved_protocols": len(final_protos),
            "completed_reports":  len(reports),
            "pending_reports":    pending_total,
        },
        "by_facility": sorted(fac_stats.values(), key=lambda x: x["facility_name"]),
        "by_product":  sorted(prod_stats.values(),
                              key=lambda x: (x["facility_name"], x["product_name"])),
    }


class ProductInfoRequest(BaseModel):
    product_name: str

@app.post("/ai/product-info")
def ai_product_info(req: ProductInfoRequest, db: Session = Depends(get_db)):
    try:
        prompt = f"""
You are a pharmaceutical expert. Provide information about this drug/API: "{req.product_name}"

Respond ONLY with a JSON object in this exact format, no markdown:
{{
  "product_name": "official name",
  "pharmacological_class": "drug class",
  "min_therapeutic_dose_mg": <number or null>,
  "max_daily_dose_mg": <number or null>,
  "pde_mg_day": <number or null>,
  "analytical_method": "HPLC or UV or TOC or GC or null",
  "source": "reference source",
  "confidence": "high" or "medium" or "low",
  "notes": "important notes about the values"
}}

Rules:
- Use null for unknown values
- PDE in mg/day from ICH Q3C or EMA guidelines if available
- Doses in mg
- confidence high means well known drug with published data
- Return ONLY JSON, no extra text
"""

        raw = call_ollama(prompt).strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {
                "product_name": req.product_name,
                "pharmacological_class": None,
                "min_therapeutic_dose_mg": None,
                "max_daily_dose_mg": None,
                "pde_mg_day": None,
                "analytical_method": None,
                "source": None,
                "confidence": "low",
                "notes": raw
            }

        return parsed

    except Exception as e:
        print(f"AI ERROR: {e}")
        return {
            "product_name": req.product_name,
            "pharmacological_class": None,
            "min_therapeutic_dose_mg": None,
            "max_daily_dose_mg": None,
            "pde_mg_day": None,
            "analytical_method": None,
            "source": None,
            "confidence": "low",
            "notes": f"Error: {str(e)}"
        }