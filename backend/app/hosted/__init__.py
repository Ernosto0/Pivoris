"""Optional hosted modules (ADR-019, ADR-029).

Core open-source packages must never import ``app.hosted``; only ``app.main``, ``app.cli``,
``app.handlers`` and ``app.api.router`` wire hosted features when enabled by configuration.
"""
