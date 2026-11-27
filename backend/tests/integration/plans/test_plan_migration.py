"""The plans migration: existing workspaces get growth/trial starting now; down and up again."""

import uuid

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text

from app.core.db import BACKEND_DIR


def test_migration_0051_backfills_existing_workspaces_and_reverses_cleanly(engine: Engine) -> None:
    schema = "plans_mig_" + uuid.uuid4().hex
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    url = engine.url.update_query_dict({"options": f"-csearch_path={schema}"})
    isolated = create_engine(url)
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option(
        "sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%")
    )
    workspace_id = uuid.uuid4()
    try:
        command.upgrade(config, "0050")
        with isolated.begin() as connection:
            assert connection.scalar(text("SELECT to_regclass('workspace_plans')")) is None
            connection.execute(
                text(
                    "INSERT INTO workspaces (id, name, slug, business_category, market, "
                    "default_locale, timezone, currency) VALUES (:id, 'Old', 'old', "
                    "'other', 'tr', 'tr', 'Europe/Istanbul', 'TRY')"
                ),
                {"id": workspace_id},
            )
        command.upgrade(config, "0051")
        with isolated.connect() as connection:
            row = connection.execute(
                text(
                    "SELECT plan, monthly_quota, quota_override, status, used, "
                    "period_end > period_start AS ok, abs(extract(epoch FROM now() - "
                    "period_start)) < 60 AS starts_now, warned_80, warned_100, warned_paused "
                    "FROM workspace_plans WHERE workspace_id = :id"
                ),
                {"id": workspace_id},
            ).one()
            assert tuple(row) == ("growth", 2500, None, "trial", 0, True, True, False, False, False)
            assert connection.scalar(text("SELECT to_regclass('reply_usage')")) is not None
        command.downgrade(config, "0050")
        with isolated.connect() as connection:
            assert connection.scalar(text("SELECT to_regclass('workspace_plans')")) is None
            assert connection.scalar(text("SELECT to_regclass('reply_usage')")) is None
        command.upgrade(config, "0051")  # and back up again
        with isolated.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM workspace_plans")) == 1
    finally:
        isolated.dispose()
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


def test_migration_0103_backfills_trial_and_demo_exempt_and_reverses_cleanly(
    engine: Engine,
) -> None:
    schema = "plans_mig_0103_" + uuid.uuid4().hex
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    url = engine.url.update_query_dict({"options": f"-csearch_path={schema}"})
    isolated = create_engine(url)
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option(
        "sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%")
    )
    ws_existing = uuid.uuid4()
    ws_missing = uuid.uuid4()
    ws_demo_existing = uuid.uuid4()
    ws_demo_missing = uuid.uuid4()
    try:
        command.upgrade(config, "0102")
        with isolated.begin() as connection:
            for wid, slug, is_demo in (
                (ws_existing, "reg-existing", False),
                (ws_missing, "reg-missing", False),
                (ws_demo_existing, "demo-existing", True),
                (ws_demo_missing, "demo-missing", True),
            ):
                connection.execute(
                    text(
                        "INSERT INTO workspaces (id, name, slug, business_category, market, "
                        "default_locale, timezone, currency, is_demo) VALUES (:id, :slug, :slug, "
                        "'other', 'tr', 'tr', 'Europe/Istanbul', 'TRY', :is_demo)"
                    ),
                    {"id": wid, "slug": slug, "is_demo": is_demo},
                )
            for wid in (ws_existing, ws_demo_existing):
                connection.execute(
                    text(
                        "INSERT INTO workspace_plans (workspace_id, plan, monthly_quota, status, "
                        "period_start, period_end, anchor_day, period_id, used, "
                        "warned_80, warned_100, warned_paused) VALUES "
                        "(:id, 'starter', 500, 'trial', now(), now() + interval '1 month', "
                        "1, gen_random_uuid(), 0, false, false, false)"
                    ),
                    {"id": wid},
                )
        command.upgrade(config, "0103")
        with isolated.connect() as connection:
            rows = {
                r[0]: r[1:]
                for r in connection.execute(
                    text(
                        "SELECT workspace_id, plan, trial_ends_at, access_until, billing_exempt "
                        "FROM workspace_plans"
                    )
                ).all()
            }
            assert set(rows) == {ws_existing, ws_missing, ws_demo_existing, ws_demo_missing}
            expected_end = rows[ws_existing][1]
            from datetime import UTC, datetime

            assert expected_end == datetime(2026, 12, 27, 0, 0, tzinfo=UTC)
            assert rows[ws_existing] == ("starter", expected_end, None, False)
            assert rows[ws_missing] == ("growth", expected_end, None, False)
            assert rows[ws_demo_existing] == ("starter", expected_end, None, True)
            assert rows[ws_demo_missing] == ("growth", expected_end, None, True)
        command.downgrade(config, "0102")
        command.upgrade(config, "0103")
        with isolated.connect() as connection:
            assert connection.scalar(text("SELECT count(*) FROM workspace_plans")) == 4
    finally:
        isolated.dispose()
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
