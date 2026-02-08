"""
Push-up analyzer with form feedback.
Uses same interface as SquatAnalyzer for compatibility with server and mobile app.
"""

import os
import sys
import time

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle

from collections import deque


class AngleSmoother:
    """Exponential moving average for a single angle value."""
    def __init__(self, alpha: float = 0.35):
        self.alpha = alpha
        self.value = None

    def update(self, raw: float) -> float:
        if self.value is None:
            self.value = raw
        else:
            self.value = self.alpha * raw + (1 - self.alpha) * self.value
        return self.value

    def reset(self):
        self.value = None


class PushupAnalyzer:
    """
    Analyzes push-up form from pose landmarks.
    Stages: up (arms extended) -> descending -> bottom -> ascending -> up
    """

    # Elbow angle thresholds
    ELBOW_EXTENDED = 150   # Above this = top position (arms extended)
    ELBOW_LOCKOUT = 145    # Must pass this on way up to count rep
    ELBOW_BOTTOM = 100     # Below this = chest low enough to count
    ELBOW_DEEP = 95        # Definitely at bottom

    # Body alignment (shoulder-hip-ankle): straight line ~170-180°
    BODY_STRAIGHT_MIN = 155   # Below = hip sagging

    # Elbow flare: ideal ~45° from body
    MIN_VISIBILITY = 0.50
    MIN_REP_INTERVAL = 0.8
    MIN_DEEP_FRAMES = 2
    SMOOTH_ALPHA = 0.55
    SIDE_STICKY_FRAMES = 5

    # Feedback debounce
    WARN_FRAMES_BODY = 6     # "Keep body straight"
    WARN_FRAMES_DEEPER = 8   # "Lower your chest"
    WARN_FRAMES_LOCKOUT = 6  # "Full lockout"
    FEEDBACK_HOLD_TIME = 2.5

    # Pushup-specific form tips (no squat language)
    WARN_PRIORITY = [
        "Engage your core!",
        "Keep body straight!",
        "Lower your chest more",
        "Full lockout at top",
    ]

    def __init__(self):
        self.stage = "up"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Push-ups"

        self._elbow_smooth = AngleSmoother(self.SMOOTH_ALPHA)
        self._body_smooth = AngleSmoother(self.SMOOTH_ALPHA)

        self.shoulder_history = deque(maxlen=30)

        self._last_rep_time: float = 0.0
        self._deep_frame_count: int = 0

        self._rep_form_issues: list[str] = []
        self._rep_had_good_depth: bool = False

        self._current_side: str | None = None
        self._side_frame_count: int = 0

        self._body_warn_frames: int = 0
        self._deeper_warn_frames: int = 0
        self._lockout_warn_frames: int = 0

        self._stable_feedback: str = "Start Push-ups"
        self._stable_feedback_level: str = "success"
        self._stable_feedback_time: float = 0.0
        self._candidate_feedback: str = ""
        self._candidate_count: int = 0
        self._active_warning: str | None = None

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
        self._deeper_warn_frames = 0
        self._lockout_warn_frames = 0
        self._stable_feedback = "Start Push-ups"
        self._stable_feedback_level = "success"
        self._stable_feedback_time = 0.0
        self._candidate_feedback = ""
        self._candidate_count = 0
        self._active_warning = None

    def get_analysis(self, lm_list):
        """
        Returns structured analysis data (same interface as SquatAnalyzer).
        Maps: knee_angle -> elbow_angle, hip_angle -> body_angle,
        target_depth_y/current_depth_y for DepthLine (chest depth).
        """
        if len(lm_list) < 33:
            return None

        # Pick more visible side
        left_vis = (lm_list[11][3] + lm_list[13][3] + lm_list[15][3] + lm_list[23][3]) / 4
        right_vis = (lm_list[12][3] + lm_list[14][3] + lm_list[16][3] + lm_list[24][3]) / 4

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
            elbow = lm_list[14][1:3]
            wrist = lm_list[16][1:3]
            hip = lm_list[24][1:3]
            ankle = lm_list[28][1:3]
            side_vis = right_vis
        else:
            shoulder = lm_list[11][1:3]
            elbow = lm_list[13][1:3]
            wrist = lm_list[15][1:3]
            hip = lm_list[23][1:3]
            ankle = lm_list[27][1:3]
            side_vis = left_vis

        self.shoulder_history.append(shoulder)

        low_confidence = side_vis < self.MIN_VISIBILITY

        # Elbow angle: shoulder-elbow-wrist. 180 = extended, 90 = bottom
        raw_elbow = calculate_angle(shoulder, elbow, wrist)
        raw_body = calculate_angle(shoulder, hip, ankle)

        elbow_angle = self._elbow_smooth.update(raw_elbow)
        body_angle = self._body_smooth.update(raw_body)

        is_deep_enough = elbow_angle <= self.ELBOW_BOTTOM

        shoulder_y = shoulder[1]
        hip_y = hip[1]

        now = time.monotonic()

        # Form checks
        feedback_list: list[str] = []
        frame_good_form = True

        actively_pushing = self.stage in ("descending", "bottom", "ascending")

        # Body alignment: hip sagging or piking (pushup-specific cues)
        if actively_pushing:
            if body_angle < self.BODY_STRAIGHT_MIN:
                self._body_warn_frames += 1
            else:
                self._body_warn_frames = max(0, self._body_warn_frames - 2)

            if self._body_warn_frames >= self.WARN_FRAMES_BODY:
                feedback_list.append("Engage your core!")
                frame_good_form = False
        else:
            self._body_warn_frames = max(0, self._body_warn_frames - 1)

        # State machine
        if self.stage == "up":
            if elbow_angle < self.ELBOW_LOCKOUT:
                self.stage = "descending"
                self._rep_form_issues = []
                self._rep_had_good_depth = False
                self._deep_frame_count = 0
                self._body_warn_frames = 0
                self._deeper_warn_frames = 0
                self._lockout_warn_frames = 0

        elif self.stage == "descending":
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if elbow_angle <= self.ELBOW_DEEP:
                self._deep_frame_count += 1
                self._deeper_warn_frames = 0
            else:
                self._deep_frame_count = max(0, self._deep_frame_count - 1)
                if elbow_angle < self.ELBOW_LOCKOUT:
                    self._deeper_warn_frames += 1

            if is_deep_enough:
                self._rep_had_good_depth = True

            if self._deeper_warn_frames >= self.WARN_FRAMES_DEEPER and not is_deep_enough:
                if "Lower your chest more" not in feedback_list:
                    feedback_list.append("Lower your chest more")

            if self._deep_frame_count >= self.MIN_DEEP_FRAMES:
                self.stage = "bottom"
                self.feedback = "Good depth! Push up!"

            if elbow_angle > self.ELBOW_EXTENDED:
                self.stage = "up"
                self._deep_frame_count = 0
                self._deeper_warn_frames = 0

        elif self.stage == "bottom":
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if is_deep_enough:
                self._rep_had_good_depth = True

            if elbow_angle > self.ELBOW_BOTTOM + 15:
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

        # Feedback stabilization (all pushup-specific tips)
        _warn_counter = {
            "Engage your core!": self._body_warn_frames,
            "Keep body straight!": self._body_warn_frames,
            "Lower your chest more": self._deeper_warn_frames,
            "Full lockout at top": self._lockout_warn_frames,
        }

        if self._active_warning is not None:
            counter_val = _warn_counter.get(self._active_warning, 0)
            if counter_val == 0:
                self._active_warning = None

        chosen_warning: str | None = None
        if feedback_list:
            if self._active_warning and self._active_warning in feedback_list:
                chosen_warning = self._active_warning
            else:
                for w in self.WARN_PRIORITY:
                    if w in feedback_list:
                        chosen_warning = w
                        break
                if chosen_warning is None:
                    chosen_warning = feedback_list[0]
                self._active_warning = chosen_warning

        if chosen_warning:
            desired_feedback = chosen_warning
            desired_level = 'error' if not frame_good_form else 'warning'
        else:
            desired_feedback = self.feedback
            desired_level = 'success'
            self._active_warning = None

        rep_completion_msgs = {
            "Good rep!", "Lower chest more next rep", "Check form",
            "Good depth! Push up!",
        }
        is_priority = desired_feedback in rep_completion_msgs

        if desired_feedback == self._candidate_feedback:
            self._candidate_count += 1
        else:
            self._candidate_feedback = desired_feedback
            self._candidate_count = 1

        time_since_stable = now - self._stable_feedback_time
        should_update = (
            is_priority
            or self._candidate_count >= 5
            or (time_since_stable >= self.FEEDBACK_HOLD_TIME and self._candidate_count >= 2)
        )

        if should_update and desired_feedback != self._stable_feedback:
            self._stable_feedback = desired_feedback
            self._stable_feedback_level = desired_level
            self._stable_feedback_time = now

        # For DepthLine: target = wrist Y (floor level, how low chest should go)
        # current = shoulder Y (chest height) - when shoulder approaches wrist, good depth
        if side == "right":
            wrist_y = lm_list[16][2]
        else:
            wrist_y = lm_list[15][2]
        target_depth_y = wrist_y
        current_depth_y = shoulder_y

        return {
            "knee_angle": int(elbow_angle),
            "hip_angle": int(body_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": self._stable_feedback,
            "feedback_level": self._stable_feedback_level,
            "is_good_form": frame_good_form,
            "depth_status": "Good" if is_deep_enough else "High",
            "target_depth_y": target_depth_y,
            "current_depth_y": current_depth_y,
            "hip_trajectory": list(self.shoulder_history),
            "side_detected": side,
        }
