import logging
import math
import time
from collections import deque

from .base import AngleSmoother, FeedbackStabilizer, calculate_angle

logger = logging.getLogger(__name__)


class SquatAnalyzer:
    # ---- Thresholds (class-level constants) --------------------------------
    # Knee-angle thresholds with hysteresis band
    KNEE_STANDING_ANGLE   = 155   # Above this = fully standing (reset)
    KNEE_LOCKOUT_ANGLE    = 145   # Must pass this on the way up to confirm lockout
    KNEE_DEEP_ANGLE       = 100   # Below this = deep enough to *maybe* count
    KNEE_BOTTOM_ANGLE     = 95    # Below this = definitely at the bottom

    # Back angle
    BACK_WARNING_ANGLE    = 55    # Torso getting too horizontal – warn early
    BACK_BAD_ANGLE        = 42    # Torso too horizontal – error (slightly more forgiving)

    # Forward knee travel: knee X beyond ankle X as fraction of shin length
    KNEE_OVER_TOE_RATIO   = 0.45

    # Minimum visibility score (0-1) for the side being used
    MIN_VISIBILITY        = 0.50

    # Minimum time (seconds) between two counted reps
    MIN_REP_INTERVAL      = 0.8

    # How many consecutive "deep" frames are required before counting
    MIN_DEEP_FRAMES       = 2

    # Smoothing factor for EMA (0-1).  Higher = more responsive.
    SMOOTH_ALPHA          = 0.55

    # Side-stickiness: minimum frames before switching detected side
    SIDE_STICKY_FRAMES    = 5

    # ---- Feedback debounce: consecutive frames required to emit a warning ---
    WARN_FRAMES_BACK      = 6   # "Keep chest up" needs 6 bad frames in a row
    WARN_FRAMES_KNEE_TOE  = 8   # "Sit back more" needs 8 bad frames
    WARN_FRAMES_DEEPER    = 8   # "Squat deeper" needs 8 frames

    # Minimum time (seconds) a feedback message stays on screen before changing
    FEEDBACK_HOLD_TIME    = 2.5

    # Priority order for warnings (lower index = higher priority).
    # When multiple warnings fire, only the highest-priority one is shown.
    # Once shown, it stays until resolved (counter drops to 0).
    WARN_PRIORITY = ["Keep chest up!", "Sit back more",
                     "Chest up a bit more", "Squat deeper"]

    def __init__(self):
        self.stage = "up"        # "up" | "descending" | "bottom" | "ascending"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Squatting"

        # Smoothers
        self._knee_smooth = AngleSmoother(self.SMOOTH_ALPHA)
        self._hip_smooth  = AngleSmoother(self.SMOOTH_ALPHA)

        # Trajectory / history
        self.hip_history = deque(maxlen=30)

        # Rep-gating state
        self._last_rep_time: float = 0.0
        self._deep_frame_count: int = 0

        # Per-rep form tracking – accumulate issues across the whole rep
        self._rep_form_issues: list[str] = []
        self._rep_had_good_depth: bool = False

        # Sticky side detection – avoids oscillating between left/right
        self._current_side: str | None = None
        self._side_frame_count: int = 0

        # ---- Debounce counters for each form warning ----
        self._back_warn_frames: int = 0
        self._knee_toe_warn_frames: int = 0
        self._deeper_warn_frames: int = 0

        # ---- Feedback stabilization (shared logic from base) ----
        self._stabilizer = FeedbackStabilizer(
            warn_priority=self.WARN_PRIORITY,
            rep_completion_msgs={
                "Good rep!", "Deeper! Hips below knees.", "Check form",
                "Good depth! Drive up!",
            },
            candidate_threshold=5,
            feedback_hold_time=self.FEEDBACK_HOLD_TIME,
            initial_feedback="Start Squatting",
        )

    def reset(self):
        """Resets the analyzer state for a new set."""
        self.stage = "up"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Squatting"
        self.hip_history.clear()
        self._knee_smooth.reset()
        self._hip_smooth.reset()
        self._last_rep_time = 0.0
        self._deep_frame_count = 0
        self._rep_form_issues = []
        self._rep_had_good_depth = False
        self._current_side = None
        self._side_frame_count = 0
        self._back_warn_frames = 0
        self._knee_toe_warn_frames = 0
        self._deeper_warn_frames = 0
        self._stabilizer.reset("Start Squatting")

    # ------------------------------------------------------------------
    # Main analysis (called by server for every frame)
    # ------------------------------------------------------------------
    def get_analysis(self, lm_list):
        """
        Returns structured analysis data without drawing on image.
        Used by the server to send data to the mobile app.
        """
        if len(lm_list) < 33:
            return None

        # ---- Pick the more-visible side (with stickiness) ----------------
        left_visibility = (lm_list[11][3] + lm_list[23][3] + lm_list[25][3] + lm_list[27][3]) / 4
        right_visibility = (lm_list[12][3] + lm_list[24][3] + lm_list[26][3] + lm_list[28][3]) / 4

        preferred_side = "right" if right_visibility >= left_visibility else "left"

        # Sticky side: only switch if the other side has been dominant for
        # several consecutive frames to prevent jitter.
        if self._current_side is None:
            self._current_side = preferred_side
            self._side_frame_count = 0
        elif preferred_side != self._current_side:
            self._side_frame_count += 1
            if self._side_frame_count >= self.SIDE_STICKY_FRAMES:
                self._current_side = preferred_side
                self._side_frame_count = 0
        else:
            self._side_frame_count = 0

        side_used = self._current_side

        if side_used == "right":
            shoulder = lm_list[12][1:3]
            hip      = lm_list[24][1:3]
            knee     = lm_list[26][1:3]
            ankle    = lm_list[28][1:3]
            side_vis = right_visibility
        else:
            shoulder = lm_list[11][1:3]
            hip      = lm_list[23][1:3]
            knee     = lm_list[25][1:3]
            ankle    = lm_list[27][1:3]
            side_vis = left_visibility

        self.hip_history.append(hip)

        # ---- Visibility gate ------------------------------------------
        low_confidence = side_vis < self.MIN_VISIBILITY

        # ---- Calculate & smooth angles ---------------------------------
        raw_knee = calculate_angle(hip, knee, ankle)
        raw_hip  = calculate_angle(shoulder, hip, knee)
        knee_angle = self._knee_smooth.update(raw_knee)
        hip_angle  = self._hip_smooth.update(raw_hip)

        # Angle-based depth (more reliable than pixel comparison)
        is_deep_enough = knee_angle <= self.KNEE_DEEP_ANGLE

        hip_y  = hip[1]
        knee_y = knee[1]

        now = time.monotonic()

        # ---- Real-time form checks (every frame, with debounce) --------
        feedback_list: list[str] = []
        frame_good_form = True

        # Only run form checks when actively squatting (not standing idle)
        actively_squatting = self.stage in ("descending", "bottom", "ascending")

        # Back angle checks (two tiers) – only during active squat
        if actively_squatting:
            if hip_angle < self.BACK_BAD_ANGLE:
                self._back_warn_frames += 1
            elif hip_angle < self.BACK_WARNING_ANGLE:
                self._back_warn_frames += 1
            else:
                self._back_warn_frames = max(0, self._back_warn_frames - 2)  # decay faster than buildup

            if self._back_warn_frames >= self.WARN_FRAMES_BACK:
                if hip_angle < self.BACK_BAD_ANGLE:
                    feedback_list.append("Keep chest up!")
                    frame_good_form = False
                else:
                    feedback_list.append("Chest up a bit more")
        else:
            self._back_warn_frames = max(0, self._back_warn_frames - 1)

        # Forward knee travel (side view) – use ratio of shin length
        if self.stage in ("descending", "bottom"):
            knee_x, ankle_x = knee[0], ankle[0]
            shin_len = max(math.hypot(knee[0] - ankle[0], knee[1] - ankle[1]), 1)
            forward_travel = abs(knee_x - ankle_x)
            travel_ratio = forward_travel / shin_len

            if travel_ratio > self.KNEE_OVER_TOE_RATIO:
                if (side_used == "right" and knee_x > ankle_x) or \
                   (side_used == "left" and knee_x < ankle_x):
                    self._knee_toe_warn_frames += 1
                else:
                    self._knee_toe_warn_frames = max(0, self._knee_toe_warn_frames - 1)
            else:
                self._knee_toe_warn_frames = max(0, self._knee_toe_warn_frames - 2)

            if self._knee_toe_warn_frames >= self.WARN_FRAMES_KNEE_TOE:
                feedback_list.append("Sit back more")
                frame_good_form = False
        else:
            self._knee_toe_warn_frames = max(0, self._knee_toe_warn_frames - 1)

        # ---- State machine with 4 stages & hysteresis ------------------
        if self.stage == "up":
            if knee_angle < self.KNEE_LOCKOUT_ANGLE:
                # Started descending
                self.stage = "descending"
                self._rep_form_issues = []
                self._rep_had_good_depth = False
                self._deep_frame_count = 0
                # Reset warning counters for the new rep
                self._back_warn_frames = 0
                self._knee_toe_warn_frames = 0
                self._deeper_warn_frames = 0

        elif self.stage == "descending":
            # Accumulate form issues while going down
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if knee_angle <= self.KNEE_DEEP_ANGLE:
                self._deep_frame_count += 1
                self._deeper_warn_frames = 0  # they're deep enough, reset
            else:
                self._deep_frame_count = max(0, self._deep_frame_count - 1)
                # Track how long they've been in a "not deep enough" zone
                if knee_angle < self.KNEE_LOCKOUT_ANGLE:
                    self._deeper_warn_frames += 1

            if is_deep_enough:
                self._rep_had_good_depth = True

            # Only show "Squat deeper" if they've been hovering above depth for a while
            if self._deeper_warn_frames >= self.WARN_FRAMES_DEEPER and not is_deep_enough:
                if "Squat deeper" not in feedback_list:
                    feedback_list.append("Squat deeper")

            if self._deep_frame_count >= self.MIN_DEEP_FRAMES:
                self.stage = "bottom"
                self.feedback = "Good depth! Drive up!"

            # If they pop back up without going deep enough
            if knee_angle > self.KNEE_STANDING_ANGLE:
                self.stage = "up"
                self._deep_frame_count = 0
                self._deeper_warn_frames = 0

        elif self.stage == "bottom":
            # Still at the bottom – keep tracking form
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if is_deep_enough:
                self._rep_had_good_depth = True

            if knee_angle > self.KNEE_DEEP_ANGLE + 10:
                # They've started coming up (reduced hysteresis for faster detection)
                self.stage = "ascending"

        elif self.stage == "ascending":
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if knee_angle >= self.KNEE_LOCKOUT_ANGLE:
                # ---- Rep completed! ------------------------------------
                time_since_last = now - self._last_rep_time

                if time_since_last >= self.MIN_REP_INTERVAL and not low_confidence:
                    self.counter += 1
                    self._last_rep_time = now

                    # "Squat deeper" is guidance during descent, not a form error.
                    # If they followed through and achieved good depth, exclude it.
                    actual_form_issues = [
                        issue for issue in self._rep_form_issues
                        if issue != "Squat deeper" or not self._rep_had_good_depth
                    ]

                    rep_is_valid = (
                        len(actual_form_issues) == 0
                        and self._rep_had_good_depth
                    )

                    # Debug logging to diagnose rep validation
                    logger.info(f"REP #{self.counter} COMPLETE: "
                               f"raw_issues={self._rep_form_issues}, "
                               f"filtered_issues={actual_form_issues}, "
                               f"had_good_depth={self._rep_had_good_depth}, "
                               f"valid={rep_is_valid}")

                    if rep_is_valid:
                        self.valid_reps += 1
                        self.feedback = "Good rep!"
                    else:
                        self.invalid_reps += 1
                        if not self._rep_had_good_depth:
                            self.feedback = "Deeper! Hips below knees."
                        elif actual_form_issues:
                            self.feedback = actual_form_issues[0]
                        else:
                            self.feedback = "Check form"

                self.stage = "up"
                self._deep_frame_count = 0

        # ---- Build final feedback with stabilizer ---------------------
        warn_counters = {
            "Keep chest up!": self._back_warn_frames,
            "Chest up a bit more": self._back_warn_frames,
            "Sit back more": self._knee_toe_warn_frames,
            "Squat deeper": self._deeper_warn_frames,
        }

        stable_feedback, stable_level = self._stabilizer.update(
            feedback_list=feedback_list,
            warn_counters=warn_counters,
            frame_good_form=frame_good_form,
            default_feedback=self.feedback,
            now=now,
        )

        return {
            "knee_angle": int(knee_angle),
            "hip_angle": int(hip_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": stable_feedback,
            "feedback_level": stable_level,
            "is_good_form": frame_good_form,
            "depth_status": "Good" if is_deep_enough else "High",
            "target_depth_y": knee_y,
            "current_depth_y": hip_y,
            "hip_trajectory": list(self.hip_history),
            "side_detected": side_used,
        }
