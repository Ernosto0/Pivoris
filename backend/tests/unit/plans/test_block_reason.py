"""Unit tests for provider-agnostic billing admission rules and billing settings."""

import base64
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import SecretStr

from app.core.config import REQUIRED_DODO_PRODUCT_KEYS, ConfigError, Settings
from app.plans import service
from app.plans.models import WorkspacePlan

NOW = datetime(2026, 11, 27, 12, 0, tzinfo=UTC)


def _plan(
    *,
    status: str = "trial",
    trial_ends_at: datetime | None = None,
    access_until: datetime | None = None,
    billing_exempt: bool = False,
    used: int = 0,
    monthly_quota: int = 100,
) -> WorkspacePlan:
    return WorkspacePlan(
        plan="growth",
        monthly_quota=monthly_quota,
        quota_override=None,
        status=status,
        used=used,
        trial_ends_at=trial_ends_at or (NOW + timedelta(days=14)),
        access_until=access_until,
        billing_exempt=billing_exempt,
    )


def test_billing_off_never_blocks_for_billing() -> None:
    expired_trial = _plan(status="trial", trial_ends_at=NOW - timedelta(days=1))
    expired_access = _plan(status="cancelled", access_until=NOW - timedelta(days=1))
    assert service.block_reason(expired_trial, NOW, billing_on=False, is_demo=False) is None
    assert service.block_reason(expired_access, NOW, billing_on=False, is_demo=False) is None
    # Quota pause still works when billing is off.
    over_quota = _plan(status="trial", trial_ends_at=NOW - timedelta(days=1), used=110)
    assert (
        service.block_reason(over_quota, NOW, billing_on=False, is_demo=False)
        == "REPLY_QUOTA_PAUSED"
    )


def test_demo_and_exempt_workspaces_never_block_for_billing() -> None:
    expired = _plan(status="trial", trial_ends_at=NOW - timedelta(days=10))
    assert service.block_reason(expired, NOW, billing_on=True, is_demo=True) is None

    exempt = _plan(status="cancelled", access_until=NOW - timedelta(days=1), billing_exempt=True)
    assert service.block_reason(exempt, NOW, billing_on=True, is_demo=False) is None


@pytest.mark.parametrize(
    ("status", "trial_offset_s", "access_offset_s", "expected"),
    [
        ("trial", 1, None, None),
        ("trial", 0, None, "BILLING_INACTIVE"),
        ("trial", -3600, None, "BILLING_INACTIVE"),
        ("active", -86400, None, None),
        ("past_due", -86400, 3600, None),
        ("past_due", -86400, 0, "BILLING_INACTIVE"),
        ("past_due", -86400, -1, "BILLING_INACTIVE"),
        ("cancelled", -86400, 86400, None),
        ("cancelled", -86400, 0, "BILLING_INACTIVE"),
        ("cancelled", -86400, -60, "BILLING_INACTIVE"),
    ],
)
def test_block_reason_edges(
    status: str,
    trial_offset_s: int,
    access_offset_s: int | None,
    expected: str | None,
) -> None:
    row = _plan(
        status=status,
        trial_ends_at=NOW + timedelta(seconds=trial_offset_s),
        access_until=NOW + timedelta(seconds=access_offset_s)
        if access_offset_s is not None
        else None,
    )
    assert service.block_reason(row, NOW, billing_on=True, is_demo=False) == expected


def test_billing_block_reason_ignores_reply_quota() -> None:
    over_quota_active = _plan(status="active", used=500, monthly_quota=100)
    assert (
        service.billing_block_reason(over_quota_active, NOW, billing_on=True, is_demo=False) is None
    )
    assert (
        service.block_reason(over_quota_active, NOW, billing_on=True, is_demo=False)
        == "REPLY_QUOTA_PAUSED"
    )


def test_settings_default_to_none_and_redact_billing_secrets() -> None:
    valid_whsec = "whsec_" + base64.b64encode(b"0" * 32).decode("ascii")
    products = ",".join(f"{k}=pdt_{i}" for i, k in enumerate(REQUIRED_DODO_PRODUCT_KEYS))
    cfg = Settings(
        _env_file=None,
        billing_provider="dodo",
        dodo_api_key=SecretStr("dodo_secret_api_key_value"),
        dodo_webhook_secret=SecretStr(valid_whsec),
        dodo_products=products,
    )
    public = cfg.public_dict()
    assert "dodo_api_key" not in public
    assert "dodo_webhook_secret" not in public
    assert "dodo_secret_api_key_value" not in str(public)
    assert valid_whsec not in str(public)


def test_settings_reject_fake_in_production_and_incomplete_dodo_config() -> None:
    with pytest.raises(ConfigError) as prod_err:
        Settings(
            _env_file=None,
            app_env="production",
            secret_key=SecretStr("x" * 40),
            database_url="postgresql+psycopg://u:p@db:5432/prod",
            llm_provider="openai",
            openai_api_key=SecretStr("sk-test"),
            media_storage_backend="s3",
            s3_bucket="b",
            s3_region="auto",
            s3_access_key_id=SecretStr("a"),
            s3_secret_access_key=SecretStr("s"),
            meta_app_id="123",
            meta_app_secret=SecretStr("sec"),
            meta_webhook_verify_token=SecretStr("tok"),
            token_encryption_keys=SecretStr(
                "k1:" + base64.urlsafe_b64encode(b"1" * 32).decode("ascii")
            ),
            token_encryption_active_key_id="k1",
            billing_provider="fake",
        )
    assert any("BILLING_PROVIDER must not be 'fake'" in p for p in prod_err.value.problems)

    with pytest.raises(ConfigError) as dodo_err:
        Settings(
            _env_file=None,
            billing_provider="dodo",
            dodo_api_key=SecretStr(""),
            dodo_webhook_secret=SecretStr("whsec_not-valid-base64!!!"),
            dodo_products="starter_monthly=pdt_1",
        )
    joined = "\n".join(dodo_err.value.problems)
    assert "DODO_API_KEY" in joined
    assert "DODO_WEBHOOK_SECRET" in joined
    assert "DODO_PRODUCTS is missing required keys" in joined
