"""The single runtime tier table and provider-agnostic stop reason codes."""

TIERS = {"starter": 500, "growth": 2500, "pro": 7500}
STATUSES = ("trial", "active", "past_due", "cancelled")
GRACE_PERCENT = 10  # drafting continues up to this much over the quota, then pauses
WARNING_PERCENT = 80
DEFAULT_PLAN = "growth"
DEFAULT_STATUS = "trial"
PAUSED_REASON = "REPLY_QUOTA_PAUSED"  # the reason code on a conversation drafting skipped
BILLING_INACTIVE_REASON = "BILLING_INACTIVE"  # trial or paid access window has ended
