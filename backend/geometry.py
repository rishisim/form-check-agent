import numpy as np

# Key landmarks: head, shoulders, hips, knees, ankles (not fingers/toes - they move out of frame)
KEY_LANDMARKS = [0, 11, 12, 23, 24, 25, 26, 27, 28]


def is_full_body_in_frame(lm_list, frame_width, frame_height, margin=0.08, exercise="squat"):
    """
    Returns True when full body (head, torso, legs, feet) is in frame.
    Optimized for SIDE/PROFILE view: camera on Y-axis, body along X-axis.
    - Squat (standing): body vertical in frame → large y_span, small x_span (narrow profile)
    - Pushup (horizontal): body horizontal in frame → large x_span, small y_span
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

    # 1. Key landmarks (head, shoulders, hips, knees, ankles) must be in bounds
    xs, ys = [], []
    for idx in KEY_LANDMARKS:
        if idx >= len(lm_list):
            return False
        cx, cy = lm_list[idx][1], lm_list[idx][2]
        xs.append(cx)
        ys.append(cy)
        if not (x_min <= cx <= x_max and y_min <= cy <= y_max):
            return False

    # 2. Body must span enough (rejects head-only). Side view: squat=vertical (y_span), pushup=horizontal (x_span)
    x_span = max(xs) - min(xs)
    y_span = max(ys) - min(ys)
    min_span = 0.28 * min(w, h)  # Slightly relaxed for profile (narrow body width)
    if x_span < min_span and y_span < min_span:
        return False

    # 3. Squat (side view): body vertical - head top, feet bottom
    if exercise == "squat":
        head_y = lm_list[0][2]
        ankle_y = max(lm_list[27][2], lm_list[28][2])
        if head_y > 0.7 * h:  # Head shouldn't be in bottom 30% (would mean only feet visible)
            return False
        if ankle_y < 0.3 * h:  # Ankles shouldn't be in top 30% (would mean only head visible)
            return False
        if ankle_y - head_y < 0.25 * h:  # Vertical span head-to-feet at least 25%
            return False

    # Pushup: body span check above is enough (horizontal or diagonal)

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
