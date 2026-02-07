import cv2
import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle

from collections import deque

class SquatAnalyzer:
    def __init__(self):
        self.stage = "up" # Start in "up" position
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Squatting"
        # Track last 30 frames of hip positions for trajectory
        self.hip_history = deque(maxlen=30) 

    def reset(self):
        """Resets the analyzer state for a new set."""
        self.stage = "up"
        self.counter = 0
        self.valid_reps = 0
        self.invalid_reps = 0
        self.feedback = "Start Squatting"
        self.hip_history.clear()

    def get_analysis(self, lm_list):
        """
        Returns structured analysis data without drawing on image.
        Used by the server to send data to the mobile app.
        """
        if len(lm_list) < 33: # Need full body landmarks
            return None
        
        # Determine which side is more visible
        # 11: L Shoulder, 23: L Hip, 25: L Knee, 27: L Ankle
        # 12: R Shoulder, 24: R Hip, 26: R Knee, 28: R Ankle
        
        left_visibility = (lm_list[11][3] + lm_list[23][3] + lm_list[25][3] + lm_list[27][3]) / 4
        right_visibility = (lm_list[12][3] + lm_list[24][3] + lm_list[26][3] + lm_list[28][3]) / 4
        
        if right_visibility >= left_visibility:
            # Use Right Side
            shoulder = lm_list[12][1:3] # cx, cy
            hip = lm_list[24][1:3] 
            knee = lm_list[26][1:3]
            ankle = lm_list[28][1:3]
            side_used = "right"
        else:
            # Use Left Side
            shoulder = lm_list[11][1:3]
            hip = lm_list[23][1:3]
            knee = lm_list[25][1:3]
            ankle = lm_list[27][1:3]
            side_used = "left"

        # Add current hip position to history
        self.hip_history.append(hip)
        
        # 1. Knee Angle (Flexion)
        knee_angle = calculate_angle(hip, knee, ankle)
        
        # 2. Back Angle (Leaning forward)
        # Angle between vertical line up from hip and the torso line
        hip_angle = calculate_angle(shoulder, hip, knee)

        # 3. Depth Check (Hip Y vs Knee Y)
        # MediaPipe Y increases downwards.
        hip_y = hip[1]
        knee_y = knee[1]
        
        # State Machine & Rep Counting
        if knee_angle > 160:
            self.stage = "up"

        # Real-time form checks
        feedback_list = []
        is_good_form = True
        
        # Check Back Angle (Leaning too far)
        if hip_angle < 45: # Torso is too horizontal relative to thighs
            feedback_list.append("Keep chest up!")
            is_good_form = False
            
        # Check Knee Depth relative to stage
        if self.stage == "up" and knee_angle < 140 and knee_angle > 100:
            feedback_list.append("Squat deeper")

        if self.stage == "up" and knee_angle < 90:
            # Check depth
            is_deep_enough = hip_y >= knee_y # Hips lower or equal to knees

            if is_deep_enough:
                self.stage = "down"
                self.counter += 1

                # Check form quality at the bottom of the rep
                if is_good_form:
                    self.valid_reps += 1
                else:
                    self.invalid_reps += 1

                self.feedback = "Good depth! Drive up!"
            else:
                self.feedback = "Lower! Hips below knees."

        # Combine feedback
        final_feedback = self.feedback
        feedback_level = 'success' # default
        
        if feedback_list:
            final_feedback = feedback_list[0] # Prioritize first error
            feedback_level = 'warning'
        
        if not is_good_form:
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
            "is_good_form": is_good_form,
            "depth_status": "Good" if hip_y >= knee_y else "High",
            "target_depth_y": knee_y,
            "current_depth_y": hip_y,
            "hip_trajectory": list(self.hip_history),
            "side_detected": side_used
        }

    def analyze(self, img, lm_list):
        """Original method for local webcam testing with drawing."""
        if len(lm_list) != 0:
            # Simple visibility check for local mode
            left_v = lm_list[23][3] + lm_list[25][3] + lm_list[27][3]
            right_v = lm_list[24][3] + lm_list[26][3] + lm_list[28][3]
            
            if right_v >= left_v:
                hip, knee, ankle = lm_list[24][1:3], lm_list[26][1:3], lm_list[28][1:3]
            else:
                hip, knee, ankle = lm_list[23][1:3], lm_list[25][1:3], lm_list[27][1:3]
            
            angle_knee = calculate_angle(hip, knee, ankle)
            
            cv2.putText(img, str(int(angle_knee)), (knee[0] + 10, knee[1]), 
                        cv2.FONT_HERSHEY_PLAIN, 2, (255, 255, 255), 2)

            if angle_knee > 160:
                self.stage = "up"
            if angle_knee < 90 and self.stage == "up":
                self.stage = "down"
                self.counter += 1
                print("Squat count:", self.counter)
            
            return img
