"""
Push-up analyzer with comprehensive form feedback.

Matches the feature depth of SquatAnalyzer with pushup-specific form checks:
  - Two-tier body alignment (mild sag / severe sag)
  - Hip pike detection (hips too high)
  - Elbow flare detection (elbows splaying out - like squat's knee valgus)
  - Hand position check (wrists under shoulders - like squat's knee-over-toe)
  - Depth + lockout gating per rep
  - Priority-based, debounced, stabilised feedback
"""

import math
import time
from collections import deque

from .base import AngleSmoother, FeedbackStabilizer, calculate_angle


class PushupAnalyzer:
    """
    Analyzes push-up form from pose landmarks.
    Stages: up (arms extended) -> descending -> bottom -> ascending -> up
    """

    # ---- Elbow-angle thresholds with hysteresis band --------------------
    ELBOW_EXTENDED    = 155   # Above this = fully extended (top reset)
    ELBOW_LOCKOUT     = 145   # Must pass on the way up to confirm lockout
    ELBOW_DEEP        = 100   # Below this = deep enough to *maybe* count
    ELBOW_BOTTOM      = 95    # Below this = definitely at the bottom

    # ---- Body alignment (shoulder-hip-ankle angle) ----------------------
    BODY_WARNING_ANGLE = 160  # Mild sag - "Tighten your core"
    BODY_BAD_ANGLE     = 150  # Severe sag - "Keep body straight!"

    # ---- Hip pike detection (positional) --------------------------------
    # Fraction of body-length the hip must be above the shoulder->ankle line
    BODY_PIKE_THRESHOLD = 0.06

    # ---- General thresholds --------------------------------------------
    MIN_VISIBILITY     = 0.50
    MIN_REP_INTERVAL   = 0.8
    MIN_DEEP_FRAMES    = 2
    SMOOTH_ALPHA       = 0.55
    SIDE_STICKY_FRAMES = 5

    # ---- Feedback debounce: consecutive frames required to emit ---------
    WARN_FRAMES_BODY    = 6    # Body sag
    WARN_FRAMES_PIKE    = 8    # Hip pike
    WARN_FRAMES_DEEPER  = 8    # Depth
    WARN_FRAMES_LOCKOUT = 6    # Lockout

    # Minimum time (seconds) a feedback message stays on screen
    FEEDBACK_HOLD_TIME = 2.5

    # Priority order (lower index = higher priority)
    WARN_PRIORITY = [
        "Keep body straight!",
        "Don't pike hips up!",
        "Tighten your core",
        "Lower your chest more",
        "Full lockout at top",
    ]

    # ------------------------------------------------------------------
    def __init__(self):
        self.stage = "up"        # "up" | "descending" | "bottom" | "ascending"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Push-ups"

        # Smoothers
        self._elbow_smooth = AngleSmoother(self.SMOOTH_ALPHA)
        self._body_smooth  = AngleSmoother(self.SMOOTH_ALPHA)

        # Trajectory / history
        self.shoulder_history = deque(maxlen=30)

        # Rep-gating state
        self._last_rep_time: float = 0.0
        self._deep_frame_count: int = 0

        # Per-rep form tracking
        self._rep_form_issues: list[str] = []
        self._rep_had_good_depth: bool = False

        # Sticky side detection
        self._current_side: str | None = None
        self._side_frame_count: int = 0

        # ---- Debounce counters ----
        self._body_warn_frames: int = 0
        self._pike_warn_frames: int = 0
        self._deeper_warn_frames: int = 0
        self._lockout_warn_frames: int = 0

        # ---- Feedback stabilization (shared logic from base) ----
        self._stabilizer = FeedbackStabilizer(
            warn_priority=self.WARN_PRIORITY,
            rep_completion_msgs={
                "Good rep!", "Lower chest more next rep", "Check form",
                "Good depth! Push up!",
            },
            candidate_threshold=5,
            feedback_hold_time=self.FEEDBACK_HOLD_TIME,
            initial_feedback="Start Push-ups",
        )

    def reset(self):
        """Resets the analyzer state for a new set."""
        self.stage = "up"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Push-ups"
        self.shoulder_history.clear()
        self._elbow_smooth.reset()
        self._body_smooth.reset()
        self._last_rep_time = 0.0
        self._deep_frame_count = 0
        self._rep_form_issues = []
        self._rep_had_good_depth = False
        self._current_side = None
        self._side_frame_count = 0
        self._body_warn_frames = 0
        self._pike_warn_frames = 0
        self._deeper_warn_frames = 0
        self._lockout_warn_frames = 0
        self._stabilizer.reset("Start Push-ups")

    # ------------------------------------------------------------------
    # Main analysis (called by server for every frame)
    # ------------------------------------------------------------------
    def get_analysis(self, lm_list):
        """
        Returns structured analysis data (same interface as SquatAnalyzer).
        Maps: knee_angle -> elbow_angle, hip_angle -> body_angle.
        """
        if len(lm_list) < 33:
            return None

        # ---- Pick the more-visible side (with stickiness) ----------------
        # Score ALL landmarks we actually use: shoulder, elbow, wrist, hip, ankle
        left_vis = (lm_list[11][3] + lm_list[13][3] + lm_list[15][3] + lm_list[23][3] + lm_list[27][3]) / 5
        right_vis = (lm_list[12][3] + lm_list[14][3] + lm_list[16][3] + lm_list[24][3] + lm_list[28][3]) / 5

        preferred = "right" if right_vis >= left_vis else "left"

        if self._current_side is None:
            self._current_side = preferred
            self._side_frame_count = 0
        elif preferred != self._current_side:
            self._side_frame_count += 1
            if self._side_frame_count >= self.SIDE_STICKY_FRAMES:
                self._current_side = preferred
                self._side_frame_count = 0
        else:
            self._side_frame_count = 0

        side = self._current_side

        if side == "right":
            shoulder = lm_list[12][1:3]
            elbow    = lm_list[14][1:3]
            wrist    = lm_list[16][1:3]
            hip      = lm_list[24][1:3]
            ankle    = lm_list[28][1:3]
            side_vis = right_vis
        else:
            shoulder = lm_list[11][1:3]
            elbow    = lm_list[13][1:3]
            wrist    = lm_list[15][1:3]
            hip      = lm_list[23][1:3]
            ankle    = lm_list[27][1:3]
            side_vis = left_vis

        self.shoulder_history.append(shoulder)

        # ---- Visibility gate ------------------------------------------
        low_confidence = side_vis < self.MIN_VISIBILITY

        # ---- Calculate & smooth angles ---------------------------------
        raw_elbow = calculate_angle(shoulder, elbow, wrist)
        raw_body  = calculate_angle(shoulder, hip, ankle)

        elbow_angle = self._elbow_smooth.update(raw_elbow)
        body_angle  = self._body_smooth.update(raw_body)

        # Angle-based depth
        is_deep_enough = elbow_angle <= self.ELBOW_DEEP

        shoulder_y = shoulder[1]
        hip_y      = hip[1]

        now = time.monotonic()

        # ---- Real-time form checks (every frame, with debounce) --------
        feedback_list: list[str] = []
        frame_good_form = True

        actively_pushing = self.stage in ("descending", "bottom", "ascending")

        # -- 1. Body alignment: two-tier sag detection (like squat back) --
        if actively_pushing:
            if body_angle < self.BODY_BAD_ANGLE:
                self._body_warn_frames += 1
            elif body_angle < self.BODY_WARNING_ANGLE:
                self._body_warn_frames += 1
            else:
                self._body_warn_frames = max(0, self._body_warn_frames - 2)

            if self._body_warn_frames >= self.WARN_FRAMES_BODY:
                if body_angle < self.BODY_BAD_ANGLE:
                    feedback_list.append("Keep body straight!")
                    frame_good_form = False
                else:
                    feedback_list.append("Tighten your core")
        else:
            self._body_warn_frames = max(0, self._body_warn_frames - 1)

        # -- 2. Hip pike detection (hips too high) -------------------------
        #    Uses true perpendicular distance from the shoulder→ankle body
        #    axis so it works regardless of frame orientation (portrait or
        #    landscape, person horizontal or diagonal in view).
        if actively_pushing:
            body_dx = ankle[0] - shoulder[0]
            body_dy = ankle[1] - shoulder[1]
            body_length = max(math.hypot(body_dx, body_dy), 1)

            # Project hip onto the shoulder→ankle line segment
            t = ((hip[0] - shoulder[0]) * body_dx + (hip[1] - shoulder[1]) * body_dy) / (body_length ** 2)
            t = max(0.0, min(1.0, t))
            expected_x = shoulder[0] + t * body_dx
            expected_y = shoulder[1] + t * body_dy

            # Perpendicular distance, normalised by body length
            pike_deviation = math.hypot(hip[0] - expected_x, hip[1] - expected_y) / body_length

            # Only flag as pike when hips are *above* the line
            # (lower Y in image coords = higher in real life)
            hip_above_line = hip[1] < expected_y - 2

            if hip_above_line and pike_deviation > self.BODY_PIKE_THRESHOLD:
                self._pike_warn_frames += 1
            else:
                self._pike_warn_frames = max(0, self._pike_warn_frames - 2)

            if self._pike_warn_frames >= self.WARN_FRAMES_PIKE:
                feedback_list.append("Don't pike hips up!")
                frame_good_form = False
        else:
            self._pike_warn_frames = max(0, self._pike_warn_frames - 1)

        # ---- State machine with 4 stages & hysteresis ------------------
        if self.stage == "up":
            if elbow_angle < self.ELBOW_LOCKOUT:
                # Started descending
                self.stage = "descending"
                self._rep_form_issues = []
                self._rep_had_good_depth = False
                self._deep_frame_count = 0
                # Reset warning counters for the new rep
                self._body_warn_frames = 0
                self._pike_warn_frames = 0
                self._deeper_warn_frames = 0
                self._lockout_warn_frames = 0

        elif self.stage == "descending":
            # Accumulate form issues while going down
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if elbow_angle <= self.ELBOW_BOTTOM:
                self._deep_frame_count += 1
                self._deeper_warn_frames = 0  # deep enough, reset
            else:
                self._deep_frame_count = max(0, self._deep_frame_count - 1)
                # Track how long they've been hovering above depth
                if elbow_angle < self.ELBOW_LOCKOUT:
                    self._deeper_warn_frames += 1

            if is_deep_enough:
                self._rep_had_good_depth = True

            # Show "Lower your chest more" after hovering above depth
            if self._deeper_warn_frames >= self.WARN_FRAMES_DEEPER and not is_deep_enough:
                if "Lower your chest more" not in feedback_list:
                    feedback_list.append("Lower your chest more")

            if self._deep_frame_count >= self.MIN_DEEP_FRAMES:
                self.stage = "bottom"
                self.feedback = "Good depth! Push up!"

            # If they pop back up without going deep enough
            if elbow_angle > self.ELBOW_EXTENDED:
                self.stage = "up"
                self._deep_frame_count = 0
                self._deeper_warn_frames = 0

        elif self.stage == "bottom":
            # Still at the bottom - keep tracking form
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if is_deep_enough:
                self._rep_had_good_depth = True

            if elbow_angle > self.ELBOW_DEEP + 10:
                # Started coming up (reduced hysteresis for faster detection)
                self.stage = "ascending"

        elif self.stage == "ascending":
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            # Lockout check: not extending fully at top
            if elbow_angle < self.ELBOW_LOCKOUT and elbow_angle > 120:
                self._lockout_warn_frames += 1
            else:
                self._lockout_warn_frames = max(0, self._lockout_warn_frames - 1)

            if elbow_angle >= self.ELBOW_LOCKOUT:
                # ---- Rep completed! ------------------------------------
                time_since_last = now - self._last_rep_time

                if time_since_last >= self.MIN_REP_INTERVAL and not low_confidence:
                    self.counter += 1
                    self._last_rep_time = now

                    rep_is_valid = (
                        len(self._rep_form_issues) == 0
                        and self._rep_had_good_depth
                    )

                    if rep_is_valid:
                        self.valid_reps += 1
                        self.feedback = "Good rep!"
                    else:
                        self.invalid_reps += 1
                        if not self._rep_had_good_depth:
                            self.feedback = "Lower chest more next rep"
                        elif self._rep_form_issues:
                            self.feedback = self._rep_form_issues[0]
                        else:
                            self.feedback = "Check form"

                self.stage = "up"
                self._deep_frame_count = 0

        # ---- Build final feedback with stabilizer ---------------------
        warn_counters = {
            "Keep body straight!":   self._body_warn_frames,
            "Tighten your core":     self._body_warn_frames,
            "Don't pike hips up!":   self._pike_warn_frames,
            "Lower your chest more": self._deeper_warn_frames,
            "Full lockout at top":   self._lockout_warn_frames,
        }

        stable_feedback, stable_level = self._stabilizer.update(
            feedback_list=feedback_list,
            warn_counters=warn_counters,
            frame_good_form=frame_good_form,
            default_feedback=self.feedback,
            now=now,
        )

        # DepthLine: target = wrist Y (floor), current = shoulder Y (chest)
        if side == "right":
            wrist_y = lm_list[16][2]
        else:
            wrist_y = lm_list[15][2]
        target_depth_y = wrist_y
        current_depth_y = shoulder_y

        return {
            "knee_angle": int(elbow_angle),      # mapped for UI compatibility
            "hip_angle": int(body_angle),         # mapped for UI compatibility
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": stable_feedback,
            "feedback_level": stable_level,
            "is_good_form": frame_good_form,
            "depth_status": "Good" if is_deep_enough else "High",
            "target_depth_y": target_depth_y,
            "current_depth_y": current_depth_y,
            "hip_trajectory": list(self.shoulder_history),
            "side_detected": side,
        }

