import cv2
import os
import sys

# Handle import path for server context (running from project root)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from geometry import calculate_angle

class SquatAnalyzer:
    def __init__(self):
        self.stage = "up" # Start in "up" position
        self.counter = 0
        self.feedback = "Start Squatting"

    def get_analysis(self, lm_list):
        """
        Returns structured analysis data without drawing on image.
        Used by the server to send data to the mobile app.
        """
        if len(lm_list) < 33: # Need full body landmarks
            return None
        
        # Landmarks (MediaPipe Body 25 = Left Hip, 26 = Left Knee, etc. or side dependent)
        # Using Right Side landmarks for now
        # 12: R Shoulder, 24: R Hip, 26: R Knee, 28: R Ankle
        r_shoulder = lm_list[12][1:]
        r_hip = lm_list[24][1:]
        r_knee = lm_list[26][1:]
        r_ankle = lm_list[28][1:]
        
        # 1. Knee Angle (Flexion)
        knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
        
        # 2. Back Angle (Leaning forward)
        # Angle between vertical line up from hip and the torso line
        # Simplified: Angle between Shoulder-Hip-Knee
        hip_angle = calculate_angle(r_shoulder, r_hip, r_knee)

        # 3. Depth Check (Hip Y vs Knee Y)
        # MediaPipe Y increases downwards.
        # Hips (r_hip[1]) > Knees (r_knee[1]) means Hips are LOWER than knees (Good depth)
        hip_y = r_hip[1]
        knee_y = r_knee[1]
        
        # State Machine & Rep Counting
        if knee_angle > 160:
            self.stage = "up"
            
        if self.stage == "up" and knee_angle < 100: # Early warning
             pass
             
        if self.stage == "up" and knee_angle < 90:
            # Check depth
            is_deep_enough = hip_y >= knee_y # Hips lower or equal to knees
            
            if is_deep_enough:
                self.stage = "down"
                self.counter += 1
                self.feedback = "Good depth! Drive up!"
            else:
                 self.feedback = "Lower! Hips below knees."

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

        # Combine feedback
        final_feedback = self.feedback
        if feedback_list:
            final_feedback = feedback_list[0] # Prioritize first error
            
        return {
            "knee_angle": int(knee_angle),
            "hip_angle": int(hip_angle),
            "stage": self.stage,
            "rep_count": self.counter,
            "feedback": final_feedback,
            "is_good_form": is_good_form,
            "depth_status": "Good" if hip_y >= knee_y else "High"
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

