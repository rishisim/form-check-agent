import cv2
import mediapipe as mp
import numpy as np
import os

from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
)

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker_lite.task")


class PoseTracker:
    def __init__(self, static_image_mode=False, model_complexity=0, smooth_landmarks=True, detection_confidence=0.45, tracking_confidence=0.4):
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=_MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=detection_confidence,
            min_pose_presence_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
        )
        self.landmarker = PoseLandmarker.create_from_options(options)
        self.results = None

    def find_pose(self, img, draw=True):
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        self.results = self.landmarker.detect(mp_image)
        return img

    def get_position(self, img, draw=False):
        lm_list = []
        if self.results and self.results.pose_landmarks:
            h, w, c = img.shape
            landmarks = self.results.pose_landmarks[0]  # first pose
            for idx, lm in enumerate(landmarks):
                cx, cy = int(lm.x * w), int(lm.y * h)
                visibility = lm.visibility if hasattr(lm, 'visibility') and lm.visibility is not None else 0.0
                lm_list.append([idx, cx, cy, visibility])

                if draw:
                    cv2.circle(img, (cx, cy), 5, (255, 0, 0), cv2.FILLED)
        return lm_list
