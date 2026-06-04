from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image


@dataclass
class Landmark:
    x: float
    y: float


@dataclass
class FingertipROI:
    x: int
    y: int
    width: int
    height: int


@dataclass
class HandDetectionResult:
    landmarks: list[Landmark]
    fingertip_rois: list[FingertipROI]


class HandLandmarkerProvider:
    def detect(self, image_path: Path) -> HandDetectionResult:
        try:
            import mediapipe as mp  # type: ignore
            import numpy as np  # type: ignore
        except Exception as exc:
            raise RuntimeError("MediaPipe hand landmarker is not available") from exc

        image = Image.open(image_path).convert("RGB")
        width, height = image.size
        array = np.array(image)
        hands = mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=1, min_detection_confidence=0.35)
        result = hands.process(array)
        hands.close()
        if not result.multi_hand_landmarks:
            raise RuntimeError("No hand landmarks detected")

        landmarks = [
            Landmark(x=point.x, y=point.y)
            for point in result.multi_hand_landmarks[0].landmark
        ]
        fingertip_indices = [4, 8, 12, 16, 20]
        rois: list[FingertipROI] = []
        for index in fingertip_indices:
            point = result.multi_hand_landmarks[0].landmark[index]
            roi_width = max(int(width * 0.09), 28)
            roi_height = max(int(height * 0.08), 28)
            center_x = int(point.x * width)
            center_y = int(point.y * height)
            rois.append(
                FingertipROI(
                    x=max(center_x - roi_width // 2, 0),
                    y=max(center_y - roi_height // 2, 0),
                    width=min(roi_width, width),
                    height=min(roi_height, height),
                )
            )
        return HandDetectionResult(landmarks=landmarks, fingertip_rois=rois)
