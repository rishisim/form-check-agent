import cv2
import time
import sys
import os
import threading

# Add the parent directory to sys.path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.pose_tracker import PoseTracker
from backend.exercises.squat import SquatAnalyzer
from backend.gemini_service import GeminiService

def main():
    cap = cv2.VideoCapture(0) # 0 for default webcam
    
    # Check if webcam is opened correctly
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    tracker = PoseTracker()
    squat_analyzer = SquatAnalyzer()
    
    # Initialize Gemini Service
    # Make sure GEMINI_API_KEY is set in your environment
    gemini_service = GeminiService()
    
    pTime = 0
    gemini_response = "Waiting for analysis..."
    
    print("Starting Form Check Agent...")
    print("Press 'q' to quit.")
    print("Press 'c' to capture clip and ask Gemini.")

    while True:
        success, img = cap.read()
        if not success:
            print("Failed to read frame.")
            break
        
        # Add raw frame to buffer for Gemini
        # We might want to resize or compress before buffering if memory is an issue
        # but for 2 seconds it should be fine.
        gemini_service.add_frame(img)

        # 1. Find Pose
        img = tracker.find_pose(img)
        
        # 2. Get Landmark Position
        lm_list = tracker.get_position(img, draw=False)
        
        # 3. Analyze Squat
        if len(lm_list) != 0:
            img = squat_analyzer.analyze(img, lm_list)
        
        # FPS Calculation
        cTime = time.time()
        fps = 1 / (cTime - pTime) if (cTime - pTime) > 0 else 0
        pTime = cTime
        
        # Display FPS and Gemini Response
        cv2.putText(img, f"FPS: {int(fps)}", (20, 50), cv2.FONT_HERSHEY_PLAIN, 2, (0, 255, 0), 2)
        
        # Wrap text if too long
        y0, dy = 100, 30
        for i, line in enumerate(gemini_response.split('\n')):
            y = y0 + i*dy
            cv2.putText(img, line, (20, y), cv2.FONT_HERSHEY_PLAIN, 1.5, (0, 255, 255), 2)

        # Display
        cv2.imshow("Form Check Agent", img)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            # Run analysis in a separate thread to avoid blocking the UI
            def run_analysis():
                nonlocal gemini_response
                gemini_response = "Analyzing..."
                response = gemini_service.analyze_current_buffer()
                gemini_response = response
                print(f"Gemini Coach: {response}")
            
            threading.Thread(target=run_analysis).start()
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
