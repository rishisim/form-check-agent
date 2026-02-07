import cv2
from backend.geometry import calculate_angle

class SquatAnalyzer:
    def __init__(self):
        self.stage = None # "up" or "down"
        self.counter = 0

    def analyze(self, img, lm_list):
        if len(lm_list) != 0:
            # Landmarks for Right Side (visible in side view)
            # 24 = right_hip, 26 = right_knee, 28 = right_ankle
            # 12 = right_shoulder
            
            # Using right side (odd numbers are right in Mediapipe? No, even are right)
            # 11: left_shoulder, 12: right_shoulder
            # 23: left_hip, 24: right_hip
            # 25: left_knee, 26: right_knee
            # 27: left_ankle, 28: right_ankle

            # Let's assume right side for now, can make it dynamic based on visibility
            
            # Hip Angle (Back checks) - Shoulder, Hip, Knee
            # Knee Angle (Depth check) - Hip, Knee, Ankle
            
            # Get coordinates
            # Right side
            r_shoulder = lm_list[12][1:]
            r_hip = lm_list[24][1:]
            r_knee = lm_list[26][1:]
            r_ankle = lm_list[28][1:]
            
            # Left side
            l_shoulder = lm_list[11][1:]
            l_hip = lm_list[23][1:]
            l_knee = lm_list[25][1:]
            l_ankle = lm_list[27][1:]

            # Determine which side is more visible or use both?
            # For simplicity, let's use the right side for now. 
            # Ideally we check visibility confidence.

            # Knee Angle: 180 is standing, < 90 is deep squat
            angle_knee = calculate_angle(r_hip, r_knee, r_ankle)
            
            # Hip Angle: 180 is straight back relative to leg? No.
            # We want back angle relative to vertical or hip angle?
            # Let's stick to simple depth check for now based on knee angle.

            # Visual feedback
            cv2.putText(img, str(int(angle_knee)), (r_knee[0] + 10, r_knee[1]), 
                        cv2.FONT_HERSHEY_PLAIN, 2, (255, 255, 255), 2)

            # Logic
            if angle_knee > 160:
                self.stage = "up"
            if angle_knee < 90 and self.stage == "up":
                self.stage = "down"
                self.counter += 1
                color = (0, 255, 0) # Good rep
                print("Squat count:", self.counter)
            
            # Highlight bad form (not deep enough? handled by not counting)
            # What if knees cave in? (Front view)
            # That requires checking x-coordinates of knees vs ankles/hips.
            
            return img
