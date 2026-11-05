from alembic import context

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.database import Base, engine

target_metadata = Base.metadata


def run() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",  # SQLite needs batch mode for ALTER
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


run()
