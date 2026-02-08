import cv2
import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle, is_full_body_in_frame

from collections import deque

class SquatAnalyzer:
    def __init__(self):
        self.stage = "up" # Start in "up" position
        self.counter = 0
        self.feedback = "Start Squatting"
        # Track last 30 frames of hip positions for trajectory
        self.hip_history = deque(maxlen=30) 

    NO_BODY_MSG = "Get fully in frame — head, torso, legs, feet must all be visible"

    def _no_body_response(self):
        """Return analysis when no/incomplete body detected. Does NOT count reps."""
        return {
            "knee_angle": 0,
            "hip_angle": 0,
            "stage": self.stage,
            "rep_count": self.counter,
            "feedback": self.NO_BODY_MSG,
            "feedback_level": "warning",
            "is_good_form": False,
            "depth_status": "N/A",
            "target_depth_y": 0,
            "current_depth_y": 0,
            "hip_trajectory": list(self.hip_history),
        }

    def get_analysis(self, lm_list, frame_width=None, frame_height=None):
        """
        Returns structured analysis data. Reps ONLY count when FULL body in frame.
        """
        if len(lm_list) < 33:
            return self._no_body_response()

        full_body_visible = True
        if frame_width and frame_height:
            full_body_visible = is_full_body_in_frame(lm_list, frame_width, frame_height, exercise="squat")

        # Side view: use the leg with larger vertical extent (visible profile leg)
        r_hip = lm_list[24][1:]
        r_knee = lm_list[26][1:]
        r_ankle = lm_list[28][1:]
        l_hip = lm_list[23][1:]
        l_knee = lm_list[25][1:]
        l_ankle = lm_list[27][1:]
        r_shoulder = lm_list[12][1:]

        knee_r = calculate_angle(r_hip, r_knee, r_ankle)
        knee_l = calculate_angle(l_hip, l_knee, l_ankle)
        # Side view: use leg with larger vertical span (more visible from profile)
        r_leg_span = abs(r_ankle[1] - r_hip[1])
        l_leg_span = abs(l_ankle[1] - l_hip[1])
        use_right = r_leg_span >= l_leg_span
        knee_angle = knee_r if use_right else knee_l
        hip_y = r_hip[1] if use_right else l_hip[1]
        knee_y = r_knee[1] if use_right else l_knee[1]

        self.hip_history.append(r_hip)
        hip_angle = calculate_angle(r_shoulder, r_hip, r_knee)
        is_deep_enough = hip_y >= knee_y

        if knee_angle > 155:
            self.stage = "up"

        if self.stage == "up" and knee_angle < 95 and full_body_visible:
            if is_deep_enough:
                self.stage = "down"
                self.counter += 1
                self.feedback = "Good depth! Drive up!"
            else:
                self.feedback = "Lower — hips below knees"

        # Real-time form checks
        feedback_list = []
        is_good_form = True
        
        # Check Back Angle (Leaning too far)
        if hip_angle < 45: # Torso is too horizontal relative to thighs
            feedback_list.append("Keep chest up!")
            is_good_form = False
            
        # Check Knee Depth relative to stage
        if self.stage == "up" and knee_angle < 140 and knee_angle > 95:
             feedback_list.append("Squat deeper")

        # Combine feedback
        final_feedback = self.feedback
        feedback_level = 'success' # default
        
        if not full_body_visible:
            final_feedback = self.NO_BODY_MSG
            feedback_level = "warning"
        elif feedback_list:
            final_feedback = feedback_list[0]
            feedback_level = "warning"

        if not is_good_form and full_body_visible:
            feedback_level = "error"
            
        return {
            "knee_angle": int(knee_angle),
            "hip_angle": int(hip_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "feedback": final_feedback,
            "feedback_level": feedback_level,
            "is_good_form": is_good_form,
            "depth_status": "Good" if hip_y >= knee_y else "High",
            "target_depth_y": knee_y,
            "current_depth_y": hip_y,
            "hip_trajectory": list(self.hip_history)
        }

    def analyze(self, img, lm_list):
        """Original method for local webcam testing with drawing."""
        if len(lm_list) != 0:
            r_hip = lm_list[24][1:]
            r_knee = lm_list[26][1:]
            r_ankle = lm_list[28][1:]
            
            angle_knee = calculate_angle(r_hip, r_knee, r_ankle)
            
            cv2.putText(img, str(int(angle_knee)), (r_knee[0] + 10, r_knee[1]), 
                        cv2.FONT_HERSHEY_PLAIN, 2, (255, 255, 255), 2)

            if angle_knee > 160:
                self.stage = "up"
            if angle_knee < 90 and self.stage == "up":
                self.stage = "down"
                self.counter += 1
                print("Squat count:", self.counter)
            
            return img

