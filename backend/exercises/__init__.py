"""Exercise analyzers package.

Each exercise lives in its own module and shares common utilities
from ``base`` (AngleSmoother, FeedbackStabilizer, calculate_angle).
"""

from .squat import SquatAnalyzer
from .pushup import PushupAnalyzer

# ── Registry / factory ────────────────────────────────────────────────────
ANALYZER_REGISTRY: dict[str, type] = {
    "squat": SquatAnalyzer,
    "pushup": PushupAnalyzer,
}


def get_analyzer(exercise: str):
    """Return an analyzer instance for the given exercise name.

    Falls back to SquatAnalyzer for unrecognised names.
    """
    cls = ANALYZER_REGISTRY.get(exercise.lower().strip(), SquatAnalyzer)
    return cls()


__all__ = [
    "SquatAnalyzer",
    "PushupAnalyzer",
    "ANALYZER_REGISTRY",
    "get_analyzer",
]
