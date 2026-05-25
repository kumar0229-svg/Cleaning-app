import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SQLITE_URL   = f"sqlite:///{os.path.join(_BACKEND_DIR, 'maco.db')}"

# Use DATABASE_URL from env if set (PostgreSQL), otherwise fall back to SQLite
DATABASE_URL = os.environ.get("DATABASE_URL", _SQLITE_URL)
_is_sqlite   = DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

    # WAL mode: allows concurrent reads during writes, prevents write-lock errors
    # under multi-user load. Applied once per new connection.
    @event.listens_for(engine, "connect")
    def _set_sqlite_wal(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA synchronous=NORMAL")  # safe with WAL; faster than FULL
        dbapi_conn.execute("PRAGMA foreign_keys=ON")     # enforce FK constraints

else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=30,
        pool_timeout=30,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
