import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';

interface SkeletonOverlayProps {
    landmarks: number[][]; // [id, x, y, visibility]
    hipTrajectory: number[][]; // List of [x, y]
    mirrored?: boolean; // true for front camera (default true)
}

// MediaPipe Pose Connections
const CONNECTIONS: [number, number][] = [
    [11, 12], [11, 13], [13, 15], // Left Arm
    [12, 14], [14, 16],           // Right Arm
    [11, 23], [12, 24],           // Torso
    [23, 24],                     // Hips
    [23, 25], [25, 27],           // Left Leg
    [24, 26], [26, 28],           // Right Leg
];

const KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const VISIBILITY_THRESHOLD = 0.45;

// ─────────────────────────────────────────────────────────────────────────
// Smooth-lerp approach: instead of predicting where the body WILL be
// (which amplifies noise), we smoothly interpolate toward where the body
// IS.  This acts as a low-pass filter — jitter gets absorbed while real
// movement comes through cleanly.  Trades ~1-2 frames of latency for
// rock-solid stability.
// ─────────────────────────────────────────────────────────────────────────
const LERP_SPEED = 12;           // higher = more responsive, lower = smoother
const SNAP_DISTANCE = 0.15;     // teleport threshold for big jumps
const VISIBILITY_SMOOTHING = 3;  // frames a joint must be invisible before hiding

interface JointState {
    // Target position from server (normalized 0-1)
    tx: number;
    ty: number;
    // Rendered (smoothed) position
    rx: number;
    ry: number;
    visible: boolean;
    visibleFrames: number; // positive = visible streak, negative = invisible streak
}

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory, mirrored = true }: SkeletonOverlayProps) => {
    const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
    const jointsRef = useRef<Map<number, JointState>>(new Map());
    const animFrameRef = useRef<number | null>(null);
    const hasLandmarksRef = useRef(false);
    const lastAnimTimeRef = useRef<number>(0);
    const [, setTick] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setViewSize({ width, height });
    }, []);

    // ── New landmarks arrive → update targets ────────────────────────────
    useEffect(() => {
        if (!landmarks || landmarks.length === 0) {
            hasLandmarksRef.current = false;
            return;
        }
        hasLandmarksRef.current = true;

        const lmMap = new Map<number, number[]>();
        for (const lm of landmarks) lmMap.set(lm[0], lm);

        // Mark joints not in this frame as trending invisible
        for (const [id, joint] of jointsRef.current) {
            if (!lmMap.has(id)) {
                joint.visibleFrames = Math.min(joint.visibleFrames - 1, -1);
                if (joint.visibleFrames <= -VISIBILITY_SMOOTHING) {
                    joint.visible = false;
                }
            }
        }

        for (const [id, lm] of lmMap) {
            const rawX = lm[1];
            const rawY = lm[2];
            const visibility = lm.length > 3 ? lm[3] : 1;
            const x = mirrored ? 1 - rawX : rawX;
            const y = rawY;
            const nowVisible = visibility >= VISIBILITY_THRESHOLD;

            const joint = jointsRef.current.get(id);
            if (!joint) {
                // First sighting — snap to position
                jointsRef.current.set(id, {
                    tx: x, ty: y,
                    rx: x, ry: y,
                    visible: nowVisible,
                    visibleFrames: nowVisible ? 1 : -1,
                });
            } else {
                const dist = Math.hypot(x - joint.tx, y - joint.ty);
                if (dist > SNAP_DISTANCE) {
                    // Big jump — teleport to avoid rubber-banding
                    joint.rx = x;
                    joint.ry = y;
                }
                joint.tx = x;
                joint.ty = y;

                // Smooth visibility transitions
                if (nowVisible) {
                    joint.visibleFrames = Math.max(joint.visibleFrames + 1, 1);
                    joint.visible = true; // show immediately when detected
                } else {
                    joint.visibleFrames = Math.min(joint.visibleFrames - 1, -1);
                    if (joint.visibleFrames <= -VISIBILITY_SMOOTHING) {
                        joint.visible = false; // only hide after sustained absence
                    }
                }
            }
        }
    }, [landmarks, mirrored]);

    // ── 60 fps smooth-lerp animation loop ────────────────────────────────
    // Each frame: move rendered position toward target by a fraction
    // proportional to elapsed time.  This is a simple exponential ease-out
    // that absorbs jitter while staying responsive to real movement.
    useEffect(() => {
        const animate = (now: number) => {
            if (!hasLandmarksRef.current) {
                lastAnimTimeRef.current = now;
                animFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const dt = lastAnimTimeRef.current > 0
                ? Math.min((now - lastAnimTimeRef.current) / 1000, 0.05) // cap at 50ms
                : 0.016;
            lastAnimTimeRef.current = now;

            // Lerp factor: 1 - e^(-speed * dt) gives frame-rate-independent smoothing
            const alpha = 1 - Math.exp(-LERP_SPEED * dt);

            let needsUpdate = false;

            for (const [, joint] of jointsRef.current) {
                if (!joint.visible) continue;

                const dx = joint.tx - joint.rx;
                const dy = joint.ty - joint.ry;

                // Skip if already at target (within sub-pixel precision)
                if (Math.abs(dx) < 0.0005 && Math.abs(dy) < 0.0005) continue;

                joint.rx += dx * alpha;
                joint.ry += dy * alpha;
                needsUpdate = true;
            }

            if (needsUpdate) {
                setTick(t => t + 1);
            }
            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
        };
    }, []);

    if (!landmarks || landmarks.length === 0) return null;

    const { width, height } = viewSize;

    const getPoint = (idx: number) => {
        const j = jointsRef.current.get(idx);
        if (!j || !j.visible) return null;
        return { x: j.rx * width, y: j.ry * height };
    };

    const trajectoryPoints = hipTrajectory
        .map(pt => {
            const x = mirrored ? 1 - pt[0] : pt[0];
            return `${x * width},${pt[1] * height}`;
        })
        .join(' ');

    return (
        <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                {/* Hip Trajectory - Soft Lavender */}
                {hipTrajectory.length > 1 && (
                    <Polyline
                        points={trajectoryPoints}
                        fill="none"
                        stroke="#D6D6FF"
                        strokeWidth="4"
                        strokeOpacity="0.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Skeleton Connections */}
                {CONNECTIONS.map(([start, end], index) => {
                    const startPt = getPoint(start);
                    const endPt = getPoint(end);
                    if (!startPt || !endPt) return null;

                    return (
                        <Line
                            key={index}
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke="#E0E0E0"
                            strokeWidth="3"
                            strokeOpacity="0.85"
                        />
                    );
                })}

                {/* Key Joints */}
                {KEY_JOINTS.map((idx) => {
                    const pt = getPoint(idx);
                    if (!pt) return null;
                    return (
                        <Circle
                            key={idx}
                            cx={pt.x}
                            cy={pt.y}
                            r="6"
                            fill="#FFFFFF"
                            fillOpacity="0.9"
                            stroke="#CCCCCC"
                            strokeWidth="1.5"
                        />
                    );
                })}
            </Svg>
        </View>
    );
});
