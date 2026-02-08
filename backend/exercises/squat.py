import cv2
import math
import time
from collections import deque

from .base import AngleSmoother, calculate_angle


class SquatAnalyzer:
    # ---- Thresholds (class-level constants) --------------------------------
    # Knee-angle thresholds with hysteresis band
    KNEE_STANDING_ANGLE   = 155   # Above this = fully standing (reset)
    KNEE_LOCKOUT_ANGLE    = 145   # Must pass this on the way up to confirm lockout
    KNEE_DEEP_ANGLE       = 100   # Below this = deep enough to *maybe* count
    KNEE_BOTTOM_ANGLE     = 95    # Below this = definitely at the bottom

    # Back angle
    BACK_WARNING_ANGLE    = 55    # Torso getting too horizontal – warn early
    BACK_BAD_ANGLE        = 45    # Torso too horizontal – error

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

        # ---- Feedback stabilization ----
        self._stable_feedback: str = "Start Squatting"
        self._stable_feedback_level: str = "success"
        self._stable_feedback_time: float = 0.0
        self._candidate_feedback: str = ""
        self._candidate_count: int = 0
        self._candidate_threshold: int = 5  # frames of same message to promote

        # Active-warning lock: once a warning is shown, it stays until resolved
        self._active_warning: str | None = None

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
        self._stable_feedback = "Start Squatting"
        self._stable_feedback_level = "success"
        self._stable_feedback_time = 0.0
        self._candidate_feedback = ""
        self._candidate_count = 0
        self._active_warning = None

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

        # ---- Build final feedback with warning-lock logic -----------------
        # Map warnings to their debounce counters so we can check "resolved"
        _warn_counter = {
            "Keep chest up!": self._back_warn_frames,
            "Chest up a bit more": self._back_warn_frames,
            "Sit back more": self._knee_toe_warn_frames,
            "Squat deeper": self._deeper_warn_frames,
        }

        # If the currently-locked warning is still in the feedback list, keep it.
        # If it has been resolved (counter dropped to 0), release the lock.
        if self._active_warning is not None:
            counter_val = _warn_counter.get(self._active_warning, 0)
            if counter_val == 0:
                self._active_warning = None  # resolved → release

        # Pick which warning to show using priority order
        chosen_warning: str | None = None
        if feedback_list:
            if self._active_warning and self._active_warning in feedback_list:
                # Locked warning is still active → keep it
                chosen_warning = self._active_warning
            else:
                # Pick the highest-priority warning from the list
                for w in self.WARN_PRIORITY:
                    if w in feedback_list:
                        chosen_warning = w
                        break
                if chosen_warning is None:
                    chosen_warning = feedback_list[0]
                self._active_warning = chosen_warning

        # Determine desired feedback and level
        if chosen_warning:
            desired_feedback = chosen_warning
            desired_level = 'error' if not frame_good_form else 'warning'
        else:
            desired_feedback = self.feedback
            desired_level = 'success'
            self._active_warning = None  # no warnings → clear lock

        # Stabilization: rep-completion messages update immediately;
        # warnings need N consistent candidate frames OR the hold time to expire.
        rep_completion_msgs = {"Good rep!", "Deeper! Hips below knees.", "Check form",
                               "Good depth! Drive up!"}
        is_priority = desired_feedback in rep_completion_msgs

        if desired_feedback == self._candidate_feedback:
            self._candidate_count += 1
        else:
            self._candidate_feedback = desired_feedback
            self._candidate_count = 1

        time_since_stable = now - self._stable_feedback_time
        should_update = (
            is_priority
            or self._candidate_count >= self._candidate_threshold
            or (time_since_stable >= self.FEEDBACK_HOLD_TIME
                and self._candidate_count >= 2)
        )

        if should_update and desired_feedback != self._stable_feedback:
            self._stable_feedback = desired_feedback
            self._stable_feedback_level = desired_level
            self._stable_feedback_time = now

        return {
            "knee_angle": int(knee_angle),
            "hip_angle": int(hip_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": self._stable_feedback,
            "feedback_level": self._stable_feedback_level,
            "is_good_form": frame_good_form,
            "depth_status": "Good" if is_deep_enough else "High",
            "target_depth_y": knee_y,
            "current_depth_y": hip_y,
            "hip_trajectory": list(self.hip_history),
            "side_detected": side_used,
        }

    # ------------------------------------------------------------------
    # Legacy local-webcam method
    # ------------------------------------------------------------------
    def analyze(self, img, lm_list):
        """Original method for local webcam testing with drawing."""
        if len(lm_list) != 0:
            left_v = lm_list[23][3] + lm_list[25][3] + lm_list[27][3]
            right_v = lm_list[24][3] + lm_list[26][3] + lm_list[28][3]

            if right_v >= left_v:
                hip, knee, ankle = lm_list[24][1:3], lm_list[26][1:3], lm_list[28][1:3]
            else:
                hip, knee, ankle = lm_list[23][1:3], lm_list[25][1:3], lm_list[27][1:3]

            angle_knee = calculate_angle(hip, knee, ankle)

            cv2.putText(img, str(int(angle_knee)), (knee[0] + 10, knee[1]),
                        cv2.FONT_HERSHEY_PLAIN, 2, (255, 255, 255), 2)

            if angle_knee > 150:
                self.stage = "up"
            if angle_knee < 90 and self.stage == "up":
                self.stage = "down"
                self.counter += 1
                print("Squat count:", self.counter)

            return img
