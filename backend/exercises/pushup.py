import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle, is_full_body_in_frame

from collections import deque

# Thresholds: works facing camera OR sideways
ELBOW_UP = 150      # Arms extended
ELBOW_DOWN = 130    # Bottom - count if we saw elbow below this (catches shallow pushups)
COOLDOWN_FRAMES = 2


class PushupAnalyzer:
    def __init__(self):
        self.stage = "up"
        self.counter = 0
        self.feedback = "Get in pushup position"
        self.elbow_history = deque(maxlen=30)
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
        elbow_angle = min(l_elbow_angle, r_elbow_angle)  # More bent = at bottom, no smoothing

        body_angle = calculate_angle(r_shoulder, r_hip, r_ankle)
        in_plank = 100 <= body_angle <= 230  # Very loose - for feedback only
        self.frames_since_rep += 1

        # Trajectory-based rep detection (no plank required for counting)
        if elbow_angle > ELBOW_UP and self.frames_since_rep > COOLDOWN_FRAMES:
            if self.min_elbow_since_up < ELBOW_DOWN:
                self.counter += 1
                self.feedback = "Good! Push back up!"
                self.frames_since_rep = 0
            self.stage = "up"
            self.min_elbow_since_up = 180.0

        if self.stage == "up" and elbow_angle < ELBOW_UP:
            self.min_elbow_since_up = min(self.min_elbow_since_up, elbow_angle)
            if elbow_angle < ELBOW_DOWN:
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
            "feedback": final_feedback,
            "feedback_level": feedback_level,
            "is_good_form": is_good_form,
            "target_depth_y": 0,
            "current_depth_y": 0,
            "hip_trajectory": list(self.elbow_history),
        }
