import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle, is_full_body_in_frame

from collections import deque


class PushupAnalyzer:
    def __init__(self):
        self.stage = "up"  # Start in "up" position (arms extended)
        self.counter = 0
        self.feedback = "Get in pushup position"
        self.elbow_history = deque(maxlen=30)
        self.elbow_smoother = deque(maxlen=3)
        self.frames_since_rep = 999  # Cooldown between reps
        self.frames_in_down = 0
        self.in_plank_position = False

    NO_BODY_MSG = "Get fully in frame — head, torso, legs, feet must all be visible"

    def _no_body_response(self):
        """Return analysis when no/incomplete body. Does NOT count reps."""
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
        Returns structured analysis data. Reps ONLY count when FULL body in frame.
        """
        if len(lm_list) < 33:
            return self._no_body_response()

        full_body_visible = True
        if frame_width and frame_height:
            full_body_visible = is_full_body_in_frame(lm_list, frame_width, frame_height, exercise="pushup")

        # Use both arms - only count when in plank AND full body visible
        l_shoulder = lm_list[11][1:]
        l_elbow = lm_list[13][1:]
        l_wrist = lm_list[15][1:]
        r_shoulder = lm_list[12][1:]
        r_elbow = lm_list[14][1:]
        r_wrist = lm_list[16][1:]
        r_hip = lm_list[24][1:]
        r_ankle = lm_list[28][1:]

        # Elbow angles for both arms
        l_elbow_angle = calculate_angle(l_shoulder, l_elbow, l_wrist)
        r_elbow_angle = calculate_angle(r_shoulder, r_elbow, r_wrist)
        # Use the arm that's more bent (lower) - catches down position reliably
        raw_elbow_angle = min(l_elbow_angle, r_elbow_angle)

        self.elbow_history.append(r_elbow)
        self.elbow_smoother.append(raw_elbow_angle)
        elbow_angle = sum(self.elbow_smoother) / len(self.elbow_smoother) if self.elbow_smoother else raw_elbow_angle

        # Body alignment (shoulder-hip-ankle) - plank check
        body_angle = calculate_angle(r_shoulder, r_hip, r_ankle)

        self.in_plank_position = 135 <= body_angle <= 205  # Plank or slight angle
        self.frames_since_rep += 1

        # State Machine & Rep Counting - ONLY when in plank
        if elbow_angle > 150:
            self.stage = "up"
            self.frames_in_down = 0

        if self.in_plank_position and full_body_visible and self.frames_since_rep > 5:
            if self.stage == "up" and elbow_angle < 95:
                self.stage = "down"
                self.counter += 1
                self.feedback = "Good! Push back up!"
                self.frames_since_rep = 0

        # Feedback when not in plank or body cut off
        if not full_body_visible:
            self.feedback = self.NO_BODY_MSG
        elif not self.in_plank_position:
            if body_angle < 140:
                self.feedback = "Get in pushup position - body horizontal"
            elif body_angle > 200:
                self.feedback = "Lower your hips into plank"
            else:
                self.feedback = "Get in pushup position"
        elif self.stage == "up" and elbow_angle > 90 and elbow_angle < 140:
            self.feedback = "Go lower - chest toward floor"
        elif self.stage == "down":
            self.feedback = "Good! Push back up!"

        # Real-time form checks (only when in plank)
        feedback_list = []
        is_good_form = True

        if self.in_plank_position:
            if body_angle < 135:
                feedback_list.append("Keep body straight!")
                is_good_form = False
            elif body_angle > 205:
                feedback_list.append("Lower hips")
                is_good_form = False

        final_feedback = self.feedback
        feedback_level = "success"
        if not full_body_visible:
            feedback_level = "warning"
        elif feedback_list:
            final_feedback = feedback_list[0]
            feedback_level = "warning"
        if not is_good_form and full_body_visible:
            feedback_level = "error"

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
