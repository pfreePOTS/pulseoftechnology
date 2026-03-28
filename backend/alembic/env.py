import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Make the backend package importable regardless of where alembic is invoked
# from (project root, backend/, or inside Docker at /app/).
# ---------------------------------------------------------------------------
_here = Path(__file__).resolve()
# backend/alembic/env.py → parent.parent = backend/ → parent.parent.parent = project root
_project_root = _here.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

# Also try /app (Docker working directory)
if "/app" not in sys.path:
    sys.path.insert(0, "/app")

# Import settings for the DB URL and Base for autogenerate
from backend.config import settings  # noqa: E402
from backend.database import Base  # noqa: E402
import backend.models  # noqa: E402, F401 — registers all models with Base.metadata

# ---------------------------------------------------------------------------
# Alembic config object
# ---------------------------------------------------------------------------
config = context.config

# Override sqlalchemy.url from our Settings (reads DATABASE_URL env var or default)
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
