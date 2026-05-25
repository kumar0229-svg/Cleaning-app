import os
from logging.config import fileConfig
from sqlalchemy import create_engine
from alembic import context

# Import the Base metadata
from database.db import Base

# this is the Alembic Config object
config = context.config

# Setup Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata
target_metadata = Base.metadata

# Read URL directly — bypasses configparser so % in passwords is safe
def get_sqlalchemy_url():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        db_url = "sqlite:///./maco.db"
    return db_url

_DB_URL = get_sqlalchemy_url()


def run_migrations_offline() -> None:
    context.configure(
        url=_DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_DB_URL)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
