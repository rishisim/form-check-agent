import numpy as np

# Key landmarks: head, shoulders, hips, knees, ankles (not fingers/toes - they move out of frame)
KEY_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28]


def is_full_body_in_frame(lm_list, frame_width, frame_height, margin=0.03, exercise="squat"):
    """
    Returns True when full body (head, torso, legs, feet) is in frame.
    Works facing camera OR sideways. Very permissive - only rejects obvious cut-off.
    Rep counting does NOT depend on this; it's for feedback only.
    """
    if len(lm_list) < 33:
        return False
    if not frame_width or not frame_height:
        return False

    h, w = float(frame_height), float(frame_width)
    x_min = margin * w
    x_max = (1 - margin) * w
    y_min = margin * h
    y_max = (1 - margin) * h

    xs, ys = [], []
    for idx in KEY_LANDMARKS:
        if idx >= len(lm_list):
            return False
        cx, cy = lm_list[idx][1], lm_list[idx][2]
        xs.append(cx)
        ys.append(cy)
        if not (x_min <= cx <= x_max and y_min <= cy <= y_max):
            return False

    x_span = max(xs) - min(xs)
    y_span = max(ys) - min(ys)
    min_span = 0.15 * min(w, h)  # Very permissive
    if x_span < min_span and y_span < min_span:
        return False

    # Squat: minimal vertical span (rejects head-only)
    if exercise == "squat":
        head_y = lm_list[0][2]
        ankle_y = max(lm_list[27][2], lm_list[28][2])
        if ankle_y - head_y < 0.15 * h:
            return False

    return True


def calculate_angle(a, b, c):
    """
    Calculates the angle between three points (a, b, c).
    b is the vertex of the angle.
    Returns the angle in degrees.
    """
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)

    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)

    if angle > 180.0:
        angle = 360 - angle

    return angle
