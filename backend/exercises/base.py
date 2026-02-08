"""
Shared utilities for exercise analyzers.

Extracted from individual analyzers to avoid duplication and provide a
consistent foundation for all exercise types.
"""

import os
import sys
import time

# ── Make the parent (backend/) importable so exercises can reach geometry.py ──
_parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _parent not in sys.path:
    sys.path.insert(0, _parent)

from geometry import calculate_angle  # noqa: F401  – re-exported for exercises


# ---------------------------------------------------------------------------
# Smoothing helper – exponential moving average
# ---------------------------------------------------------------------------
class AngleSmoother:
    """Exponential moving average for a single angle value."""

    def __init__(self, alpha: float = 0.35):
        self.alpha = alpha   # higher = more responsive, lower = smoother
        self.value = None

    def update(self, raw: float) -> float:
        if self.value is None:
            self.value = raw
        else:
            self.value = self.alpha * raw + (1 - self.alpha) * self.value
        return self.value

    def reset(self):
        self.value = None


# ---------------------------------------------------------------------------
# Feedback stabilization – shared warning-lock + candidate logic
# ---------------------------------------------------------------------------
class FeedbackStabilizer:
    """Encapsulates the priority-based, debounced feedback system.

    Used by exercise analyzers to prevent jittery feedback by requiring
    consistent candidate frames before promoting a new message, and by
    locking active warnings until they are resolved.
    """

    def __init__(
        self,
        warn_priority: list[str],
        rep_completion_msgs: set[str],
        candidate_threshold: int = 5,
        feedback_hold_time: float = 2.5,
        initial_feedback: str = "",
    ):
        self.warn_priority = warn_priority
        self.rep_completion_msgs = rep_completion_msgs
        self.candidate_threshold = candidate_threshold
        self.feedback_hold_time = feedback_hold_time

        # State
        self.stable_feedback: str = initial_feedback
        self.stable_feedback_level: str = "success"
        self.stable_feedback_time: float = 0.0
        self.candidate_feedback: str = ""
        self.candidate_count: int = 0
        self.active_warning: str | None = None

    def reset(self, initial_feedback: str = ""):
        self.stable_feedback = initial_feedback
        self.stable_feedback_level = "success"
        self.stable_feedback_time = 0.0
        self.candidate_feedback = ""
        self.candidate_count = 0
        self.active_warning = None

    def update(
        self,
        feedback_list: list[str],
        warn_counters: dict[str, int],
        frame_good_form: bool,
        default_feedback: str,
        now: float,
    ) -> tuple[str, str]:
        """Process one frame's worth of feedback signals.

        Returns ``(feedback_text, feedback_level)`` suitable for sending
        to the front-end.
        """
        # ── Check if the currently-locked warning has been resolved ──
        if self.active_warning is not None:
            counter_val = warn_counters.get(self.active_warning, 0)
            if counter_val == 0:
                self.active_warning = None  # resolved → release

        # ── Pick which warning to show using priority order ──
        chosen_warning: str | None = None
        if feedback_list:
            if self.active_warning and self.active_warning in feedback_list:
                # Locked warning is still active → keep it
                chosen_warning = self.active_warning
            else:
                # Pick the highest-priority warning from the list
                for w in self.warn_priority:
                    if w in feedback_list:
                        chosen_warning = w
                        break
                if chosen_warning is None:
                    chosen_warning = feedback_list[0]
                self.active_warning = chosen_warning

        # ── Determine desired feedback and level ──
        if chosen_warning:
            desired_feedback = chosen_warning
            desired_level = "error" if not frame_good_form else "warning"
        else:
            desired_feedback = default_feedback
            desired_level = "success"
            self.active_warning = None  # no warnings → clear lock

        # ── Stabilization: rep-completion messages bypass the candidate gate ──
        is_priority = desired_feedback in self.rep_completion_msgs

        if desired_feedback == self.candidate_feedback:
            self.candidate_count += 1
        else:
            self.candidate_feedback = desired_feedback
            self.candidate_count = 1

        time_since_stable = now - self.stable_feedback_time
        should_update = (
            is_priority
            or self.candidate_count >= self.candidate_threshold
            or (time_since_stable >= self.feedback_hold_time and self.candidate_count >= 2)
        )

        if should_update and desired_feedback != self.stable_feedback:
            self.stable_feedback = desired_feedback
            self.stable_feedback_level = desired_level
            self.stable_feedback_time = now

        return self.stable_feedback, self.stable_feedback_level
