import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle, is_full_body_in_frame

from collections import deque

# Thresholds: works facing camera OR sideways (relaxed for reliable counting)
ELBOW_UP = 140      # Arms extended - trigger "back at top" when elbow > this
ELBOW_DOWN = 145    # Count rep if we saw elbow below this (more bent)
ELBOW_GOOD_DEPTH = 115   # Elbows <= 115° = valid; 115-145° = invalid (half rep)
COOLDOWN_FRAMES = 1


class PushupAnalyzer:
    def __init__(self):
        self.stage = "up"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Get in pushup position"
        self.elbow_history = deque(maxlen=30)
        self.elbow_smoother = deque(maxlen=2)  # Light smoothing for noisy angles
        self.min_elbow_since_up = 180.0
        self.frames_since_rep = 999

    NO_BODY_MSG = "Get fully in frame — head, torso, legs, feet must all be visible"

    def _no_body_response(self):
        return {
            "knee_angle": 0,
            "elbow_angle": 0,
            "body_angle": 0,
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": self.NO_BODY_MSG,
            "feedback_level": "warning",
            "is_good_form": False,
            "target_depth_y": 0,
            "current_depth_y": 0,
            "hip_trajectory": list(self.elbow_history),
        }

    def get_analysis(self, lm_list, frame_width=None, frame_height=None):
        """
        Rep counting works facing camera OR sideways.
        NO plank requirement for counting - only elbow angle.
        Trajectory-based: count when elbow goes down then back up.
        """
        if len(lm_list) < 33:
            return self._no_body_response()

        full_body_visible = True
        if frame_width and frame_height:
            full_body_visible = is_full_body_in_frame(lm_list, frame_width, frame_height, exercise="pushup")

        l_shoulder = lm_list[11][1:]
        l_elbow = lm_list[13][1:]
        l_wrist = lm_list[15][1:]
        r_shoulder = lm_list[12][1:]
        r_elbow = lm_list[14][1:]
        r_wrist = lm_list[16][1:]
        r_hip = lm_list[24][1:]
        r_ankle = lm_list[28][1:]

        l_elbow_angle = calculate_angle(l_shoulder, l_elbow, l_wrist)
        r_elbow_angle = calculate_angle(r_shoulder, r_elbow, r_wrist)
        # Use more bent arm; ignore wild outliers from occlusion
        valid = [a for a in (l_elbow_angle, r_elbow_angle) if 35 <= a <= 178]
        raw_elbow = min(valid) if valid else min(l_elbow_angle, r_elbow_angle)
        self.elbow_smoother.append(raw_elbow)
        elbow_angle = sum(self.elbow_smoother) / len(self.elbow_smoother)

        body_angle = calculate_angle(r_shoulder, r_hip, r_ankle)
        in_plank = 100 <= body_angle <= 230  # Very loose - for feedback only
        self.frames_since_rep += 1

        # Trajectory-based: track min elbow during descent, count when back at top
        # Use raw_elbow for transitions - smoothing can lag and miss the moment
        if raw_elbow > ELBOW_UP and self.frames_since_rep > COOLDOWN_FRAMES:
            if self.min_elbow_since_up < ELBOW_DOWN:
                self.counter += 1
                if self.min_elbow_since_up < ELBOW_GOOD_DEPTH:
                    self.valid_reps += 1
                    self.feedback = "Good rep! Full depth."
                else:
                    self.invalid_reps += 1
                    self.feedback = "Half rep — go lower next time"
                self.frames_since_rep = 0
            self.stage = "up"
            self.min_elbow_since_up = 180.0

        if self.stage == "up" and raw_elbow < ELBOW_UP:
            # Track raw (unsmoothed) min for accurate depth - smoothing can lag
            self.min_elbow_since_up = min(self.min_elbow_since_up, raw_elbow)
            if raw_elbow < ELBOW_DOWN:
                self.stage = "down"

        # Feedback - always pushup/elbow specific, never mention squats or knees
        if not full_body_visible:
            self.feedback = self.NO_BODY_MSG
        elif not in_plank:
            self.feedback = "Get in pushup position — body straight, arms under shoulders"
        elif self.stage == "up" and ELBOW_DOWN < elbow_angle < ELBOW_UP:
            self.feedback = f"Bend elbows more — {int(elbow_angle)}° now, aim for 90° at bottom"
        elif self.stage == "up" and elbow_angle >= ELBOW_UP:
            self.feedback = f"Arms extended ({int(elbow_angle)}°) — lower chest toward floor"
        elif self.stage == "down":
            self.feedback = "Good depth! Push up and extend elbows"

        is_good_form = in_plank and (100 <= body_angle <= 230)
        final_feedback = self.feedback
        feedback_level = "success"
        if not full_body_visible:
            feedback_level = "warning"

        return {
            "knee_angle": int(elbow_angle),
            "elbow_angle": int(elbow_angle),
            "body_angle": int(body_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "valid_reps": self.valid_reps,
            "invalid_reps": self.invalid_reps,
            "feedback": final_feedback,
            "feedback_level": feedback_level,
            "is_good_form": is_good_form,
            "target_depth_y": 0,
            "current_depth_y": 0,
            "hip_trajectory": list(self.elbow_history),
        }
