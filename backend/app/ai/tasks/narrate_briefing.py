"""LLM Task: narrate_briefing (natural-language morning & evening briefings, INV-08).

Turns deterministic SQL briefing facts into a warm, conversational assistant message in Turkish
or English. Every number and scheduled time is verified by ``validate_briefing_grounding``; if
the LLM fails, exceeds budget, or fails grounding, the caller falls back to
``narrate_briefing_fallback`` so scheduled briefings are never lost or ungrounded.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.prompt import json_section
from app.ai.runner import RunnerDeps, TaskDefinition, run_task
from app.core.context import WorkspaceContext
from app.core.logging import get_logger
from app.core.narrator import narrate_briefing_fallback, validate_briefing_grounding
from app.integrations.llm.base import LLMMessage
from app.integrations.llm.fake import fake_implementation

TASK = "narrate_briefing"
BriefingKind = Literal["morning", "evening"]
_log = get_logger("app.ai.tasks.narrate_briefing")


class NarrateBriefingInput(BaseModel):
    briefing_kind: BriefingKind
    locale: Literal["tr", "en"]
    local_date: str
    facts: dict[str, Any]


class NarrateBriefingOutput(BaseModel):
    text: str = Field(
        min_length=1,
        max_length=900,
        description="Warm, natural-language briefing message grounded strictly in facts",
    )


def build_messages(task_input: NarrateBriefingInput) -> list[LLMMessage]:
    body = "\n\n".join(
        [
            json_section(
                "briefing_context",
                {
                    "briefing_kind": task_input.briefing_kind,
                    "locale": task_input.locale,
                    "local_date": task_input.local_date,
                },
            ),
            json_section("briefing_facts", task_input.facts),
        ]
    )
    return [LLMMessage("user", body)]


def post_validate(
    task_input: NarrateBriefingInput,
    output: NarrateBriefingOutput,
) -> list[str]:
    """Ensure every number and clock time in the narrated briefing is grounded in facts."""
    return validate_briefing_grounding(output.text, task_input.facts)


def snapshot(task_input: NarrateBriefingInput) -> dict[str, Any]:
    return task_input.model_dump(mode="json")


NARRATE_BRIEFING: TaskDefinition[NarrateBriefingInput, NarrateBriefingOutput] = TaskDefinition(
    name=TASK,
    output_schema=NarrateBriefingOutput,
    max_output_tokens=350,
    timeout_s=15.0,
    build_messages=build_messages,
    post_validate=post_validate,
    snapshot=snapshot,
)


@fake_implementation(TASK)
def _fake_narrate_briefing(
    task_input: NarrateBriefingInput,
    _schema: type[BaseModel],
) -> NarrateBriefingOutput:
    """Deterministic, natural-sounding fallback for tests and demo mode (INV-14)."""
    text = narrate_briefing_fallback(
        task_input.briefing_kind,
        task_input.facts,
        user_locale=task_input.locale,
    )
    return NarrateBriefingOutput(text=text)


def narrate_briefing_text(
    deps: RunnerDeps,
    ctx: WorkspaceContext,
    *,
    briefing_kind: BriefingKind,
    locale: Literal["tr", "en"],
    local_date: str,
    facts: dict[str, Any],
) -> str:
    """Run ``NARRATE_BRIEFING`` outside any DB transaction; fall back safely on any error."""
    task_input = NarrateBriefingInput(
        briefing_kind=briefing_kind,
        locale=locale,
        local_date=local_date,
        facts=facts,
    )
    try:
        outcome = run_task(deps, ctx, NARRATE_BRIEFING, task_input)
        if outcome.ok and outcome.output is not None and outcome.output.text.strip():
            return outcome.output.text.strip()
        _log.warning(
            "briefing_narration_fallback",
            briefing_kind=briefing_kind,
            locale=locale,
            error_code=outcome.error_code,
        )
    except Exception:
        _log.warning(
            "briefing_narration_exception_fallback",
            briefing_kind=briefing_kind,
            locale=locale,
            exc_info=True,
        )
    return narrate_briefing_fallback(briefing_kind, facts, user_locale=locale)
