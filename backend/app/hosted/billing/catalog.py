"""Pivoris subscription catalog and Dodo product mapping (ADR-029, pricing doc §3.2, §4, §6.1).

The final billed amount is always authoritative on Dodo's hosted checkout page (tax-exclusive:
``+ KDV`` in Türkiye, ``+ tax`` globally). Display prices here match the published pricing tables
and are verified by a unit test against ``docs/product/pricing-and-unit-economics.md`` §6.1.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core.config import Settings
from app.plans.tiers import TIERS

PIVORIS_BRAND_ID = "brnd_0Nsqs1ADANpmDH0r6nHGq"
PIVORIS_COLLECTION_ID = "pdc_0Nsr46kk52vbmRaSbwjbd"

PlanSlug = Literal["starter", "growth", "pro"]
BillingInterval = Literal["monthly", "annual"]


@dataclass(frozen=True)
class CatalogEntry:
    product_key: str
    plan: PlanSlug
    interval: BillingInterval
    usd_cents: int
    try_kurus: int
    usd_display: str
    try_display: str
    usd_monthly_equivalent: str
    try_monthly_equivalent: str
    test_product_id: str
    founder: bool = False

    @property
    def ai_replies_quota(self) -> int:
        return TIERS[self.plan]


PUBLIC_CATALOG: tuple[CatalogEntry, ...] = (
    CatalogEntry(
        product_key="starter_monthly",
        plan="starter",
        interval="monthly",
        usd_cents=2900,
        try_kurus=149000,
        usd_display="$29",
        try_display="1.490 ₺",
        usd_monthly_equivalent="$29",
        try_monthly_equivalent="1.490 ₺",
        test_product_id="pdt_0NsqswkWAd0FK9oDO2f0o",
    ),
    CatalogEntry(
        product_key="starter_annual",
        plan="starter",
        interval="annual",
        usd_cents=28800,
        try_kurus=1490000,
        usd_display="$288",
        try_display="14.900 ₺",
        usd_monthly_equivalent="$24",
        try_monthly_equivalent="1.240 ₺",
        test_product_id="pdt_0NsqswqhBfAW8bwMJ3dxR",
    ),
    CatalogEntry(
        product_key="growth_monthly",
        plan="growth",
        interval="monthly",
        usd_cents=5900,
        try_kurus=249000,
        usd_display="$59",
        try_display="2.490 ₺",
        usd_monthly_equivalent="$59",
        try_monthly_equivalent="2.490 ₺",
        test_product_id="pdt_0NsqswwdrUERi0iaabEh9",
    ),
    CatalogEntry(
        product_key="growth_annual",
        plan="growth",
        interval="annual",
        usd_cents=58800,
        try_kurus=2490000,
        usd_display="$588",
        try_display="24.900 ₺",
        usd_monthly_equivalent="$49",
        try_monthly_equivalent="2.075 ₺",
        test_product_id="pdt_0Nsqsx2WkiHRSFL2R2i2b",
    ),
    CatalogEntry(
        product_key="pro_monthly",
        plan="pro",
        interval="monthly",
        usd_cents=11900,
        try_kurus=449000,
        usd_display="$119",
        try_display="4.490 ₺",
        usd_monthly_equivalent="$119",
        try_monthly_equivalent="4.490 ₺",
        test_product_id="pdt_0Nsqsx7NRkeGfrSgJx8mI",
    ),
    CatalogEntry(
        product_key="pro_annual",
        plan="pro",
        interval="annual",
        usd_cents=118800,
        try_kurus=4490000,
        usd_display="$1,188",
        try_display="44.900 ₺",
        usd_monthly_equivalent="$99",
        try_monthly_equivalent="3.740 ₺",
        test_product_id="pdt_0NsqsxDIbMNHGUrK6Vy6n",
    ),
)

FOUNDER_ENTRY = CatalogEntry(
    product_key="founder_monthly",
    plan="growth",
    interval="monthly",
    usd_cents=0,
    try_kurus=99000,
    usd_display="990 ₺",
    try_display="990 ₺",
    usd_monthly_equivalent="990 ₺",
    try_monthly_equivalent="990 ₺",
    test_product_id="pdt_0Nsr46dXafmkuoTG6cJTO",
    founder=True,
)

ALL_ENTRIES: tuple[CatalogEntry, ...] = (*PUBLIC_CATALOG, FOUNDER_ENTRY)
ENTRIES_BY_KEY: dict[str, CatalogEntry] = {entry.product_key: entry for entry in ALL_ENTRIES}


def resolve_product_map(settings: Settings) -> dict[str, str]:
    """Return ``product_key -> product_id`` for active settings (defaults to test IDs in fake)."""
    configured = settings.dodo_product_map
    if configured:
        return configured
    return {entry.product_key: entry.test_product_id for entry in ALL_ENTRIES}


def product_id_to_entry(settings: Settings) -> dict[str, CatalogEntry]:
    """Reverse lookup ``product_id -> CatalogEntry`` across configured and test IDs."""
    mapping: dict[str, CatalogEntry] = {}
    for entry in ALL_ENTRIES:
        mapping[entry.test_product_id] = entry
    for key, pid in settings.dodo_product_map.items():
        if key in ENTRIES_BY_KEY:
            mapping[pid] = ENTRIES_BY_KEY[key]
    return mapping


def entry_for_selection(
    plan: Literal["starter", "growth", "pro", "founder"],
    interval: BillingInterval,
) -> CatalogEntry | None:
    if plan == "founder":
        return FOUNDER_ENTRY if interval == "monthly" else None
    return ENTRIES_BY_KEY.get(f"{plan}_{interval}")
