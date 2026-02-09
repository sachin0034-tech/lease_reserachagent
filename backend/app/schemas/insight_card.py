"""
Pydantic schemas for Insight Cards. All fields are required so the LLM is forced to provide values.
Optional: baseline_pct, current_trend_pct, source_url for per-card metrics and clickable sources.
"""
from typing import Literal

from pydantic import BaseModel, Field


class InsightCard(BaseModel):
    """Single insight card for lease negotiation validation."""

    title: str = Field(..., min_length=1, description="Card title e.g. Income shifts")
    impact: Literal["positive", "neutral", "negative"] = Field(
        ...,
        description="Impact classification for negotiation position",
    )
    confidence_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Confidence score 0-100; use 0 if no data",
    )
    source: str = Field(
        ...,
        min_length=1,
        description="Where this data comes from (e.g. CoStar, Census, user upload). Use 'Not available' if none.",
    )
    insight: str | None = Field(
        default=None,
        description="One-sentence summary: what's the insight (the finding). Must be distinct from data_evidence.",
    )
    data_evidence: str = Field(
        ...,
        min_length=1,
        description="From where: raw stats, numbers, or quote from the source. Use 'No data' if none. Do not repeat the insight summary here.",
    )
    why_it_matters: str = Field(
        ...,
        min_length=1,
        description="Strategic reasoning for negotiation leverage",
    )
    baseline_pct: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Baseline metric as percentage 0-100 when applicable (e.g. historical rent level). Omit if N/A.",
    )
    current_trend_pct: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Current or trend metric as percentage 0-100 when applicable (e.g. current market level). Omit if N/A.",
    )
    source_url: str | None = Field(
        default=None,
        description="Full URL to the source (e.g. Census page, report link). Empty or omit if not available.",
    )


class InsightCardBatch(BaseModel):
    """Exactly 5 cards per batch (or fewer for last batch). LLM must fill all slots."""

    cards: list[InsightCard] = Field(..., min_length=1, max_length=5)


# Ordered list of all card topics for rent validation (batches of 5)
# Aligned with rent validation data points: tenant = negotiate lower/fair rent, landlord = higher rent
CARD_TOPICS = [
    "Income shifts (local income, higher/lower vs expected)",
    "Traffic counts (current vs future, higher/lower)",
    "Rent averages (same property, area, historical)",
    "Rent forecast (today vs future, up or down)",
    "Nearby infrastructure developments (effect on rents)",
    "Co-tenancy mix (e.g. anchor tenant commitment, category clustering)",
    "Demographics & consumer buying capacity",
    "Footfall",
    "Local vacancy (new projects, tenant leverage to request lower rent)",
    "Tenant business category trends (e.g. apparel growth in area)",
    "Tenant / landlord risk (RAW FACTS ONLY: brand, cash, payment history, disputes, loans)",
    "Upcoming building maintenance (e.g. HVAC)",
    "Market activity & trends (area and tenant category)",
    "Sales comps (portfolio vs this lease, comp brands, avg lease term, competitors in property)",
    "Portfolio data (user-provided only)",
    "NOI vs cashflow & avg occupancy (landlord: NOI to run building, occupancy level)",
]
