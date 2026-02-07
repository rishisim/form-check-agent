import cv2
import os
import sys
import time

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle

from collections import deque

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


class SquatAnalyzer:
    # ---- Thresholds (class-level constants) --------------------------------
    # Knee-angle thresholds with hysteresis band
    KNEE_STANDING_ANGLE   = 155   # Above this = fully standing (reset)
    KNEE_LOCKOUT_ANGLE    = 145   # Must pass this on the way up to confirm lockout
    KNEE_DEEP_ANGLE       = 100   # Below this = deep enough to *maybe* count
    KNEE_BOTTOM_ANGLE     = 95    # Below this = definitely at the bottom

    # Back angle
    BACK_BAD_ANGLE        = 45    # Torso too horizontal

    # Minimum visibility score (0-1) for the side being used
    MIN_VISIBILITY        = 0.45

    # Minimum time (seconds) between two counted reps
    MIN_REP_INTERVAL      = 0.8

    # How many consecutive "deep" frames are required before counting
    MIN_DEEP_FRAMES       = 2

    # Smoothing factor for EMA (0-1).  ~0.4 works well at 5 FPS.
    SMOOTH_ALPHA          = 0.4

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

        # ---- Pick the more-visible side --------------------------------
        left_visibility = (lm_list[11][3] + lm_list[23][3] + lm_list[25][3] + lm_list[27][3]) / 4
        right_visibility = (lm_list[12][3] + lm_list[24][3] + lm_list[26][3] + lm_list[28][3]) / 4

        if right_visibility >= left_visibility:
            shoulder = lm_list[12][1:3]
            hip      = lm_list[24][1:3]
            knee     = lm_list[26][1:3]
            ankle    = lm_list[28][1:3]
            side_vis = right_visibility
            side_used = "right"
        else:
            shoulder = lm_list[11][1:3]
            hip      = lm_list[23][1:3]
            knee     = lm_list[25][1:3]
            ankle    = lm_list[27][1:3]
            side_vis = left_visibility
            side_used = "left"

        self.hip_history.append(hip)

        # ---- Visibility gate ------------------------------------------
        low_confidence = side_vis < self.MIN_VISIBILITY

        # ---- Calculate & smooth angles ---------------------------------
        raw_knee = calculate_angle(hip, knee, ankle)
        raw_hip  = calculate_angle(shoulder, hip, knee)
        knee_angle = self._knee_smooth.update(raw_knee)
        hip_angle  = self._hip_smooth.update(raw_hip)

        hip_y  = hip[1]
        knee_y = knee[1]
        is_deep_enough = hip_y >= (knee_y - 10)  # small tolerance (10 px)

        now = time.monotonic()

        # ---- Real-time form checks (every frame) ----------------------
        feedback_list: list[str] = []
        frame_good_form = True

        if hip_angle < self.BACK_BAD_ANGLE:
            feedback_list.append("Keep chest up!")
            frame_good_form = False

        # ---- State machine with 4 stages & hysteresis ------------------
        if self.stage == "up":
            if knee_angle < self.KNEE_LOCKOUT_ANGLE:
                # Started descending
                self.stage = "descending"
                self._rep_form_issues = []
                self._rep_had_good_depth = False
                self._deep_frame_count = 0

            if knee_angle < 140 and knee_angle > 100:
                feedback_list.append("Squat deeper")

        elif self.stage == "descending":
            # Accumulate form issues while going down
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if knee_angle <= self.KNEE_DEEP_ANGLE:
                self._deep_frame_count += 1
            else:
                self._deep_frame_count = max(0, self._deep_frame_count - 1)

            if is_deep_enough:
                self._rep_had_good_depth = True

            if self._deep_frame_count >= self.MIN_DEEP_FRAMES:
                self.stage = "bottom"
                self.feedback = "Good depth! Drive up!"

            # If they pop back up without going deep enough
            if knee_angle > self.KNEE_STANDING_ANGLE:
                self.stage = "up"
                self._deep_frame_count = 0

        elif self.stage == "bottom":
            # Still at the bottom – keep tracking form
            if not frame_good_form:
                for issue in feedback_list:
                    if issue not in self._rep_form_issues:
                        self._rep_form_issues.append(issue)

            if is_deep_enough:
                self._rep_had_good_depth = True

            if knee_angle > self.KNEE_DEEP_ANGLE + 15:
                # They've started coming up
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
                            self.feedback = "Deeper! Hips below knees."
                        elif self._rep_form_issues:
                            self.feedback = self._rep_form_issues[0]
                        else:
                            self.feedback = "Check form"

                self.stage = "up"
                self._deep_frame_count = 0

        # ---- Build final feedback string --------------------------------
        final_feedback = self.feedback
        feedback_level = 'success'

        if feedback_list:
            final_feedback = feedback_list[0]
            feedback_level = 'warning'
        if not frame_good_form:
            feedback_level = 'error'

        return {
            "knee_angle": int(knee_angle),
            "hip_angle": int(hip_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": final_feedback,
            "feedback_level": feedback_level,
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
