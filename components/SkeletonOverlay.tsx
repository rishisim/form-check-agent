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

// ── Tuning knobs ────────────────────────────────────────────────────────
const LERP_SPEED = 0.85;           // near-instant snap to target
const VELOCITY_DECAY = 0.78;       // prediction decays quickly to avoid overshoot
const PREDICTION_WEIGHT = 0.75;    // aggressive forward prediction between updates
const SNAP_DISTANCE = 0.12;        // snap sooner on big jumps
const STALE_MS = 300;              // dampen prediction sooner when data is stale

interface TrackedPoint {
    // Smoothed (rendered) position
    x: number;
    y: number;
    // Estimated velocity (normalized units / sec)
    vx: number;
    vy: number;
    visible: boolean;
}

interface TargetPoint {
    x: number;
    y: number;
    visible: boolean;
    arrivedAt: number; // performance.now() when this target was set
}

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory, mirrored = true }: SkeletonOverlayProps) => {
    const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
    const trackedRef = useRef<Map<number, TrackedPoint>>(new Map());
    const targetRef = useRef<Map<number, TargetPoint>>(new Map());
    const prevTargetRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());
    const animFrameRef = useRef<number | null>(null);
    const hasLandmarksRef = useRef(false);
    const [, setTick] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setViewSize({ width, height });
        }
    }, []);

    // ── Update targets + compute velocity when new landmarks arrive ──────
    useEffect(() => {
        if (!landmarks || landmarks.length === 0) {
            hasLandmarksRef.current = false;
            return;
        }
        hasLandmarksRef.current = true;
        const now = performance.now();

        const lmMap = new Map<number, number[]>();
        for (const lm of landmarks) {
            lmMap.set(lm[0], lm);
        }

        for (const [id, lm] of lmMap) {
            const rawX = lm[1];
            const rawY = lm[2];
            const visibility = lm.length > 3 ? lm[3] : 1;
            const x = mirrored ? 1 - rawX : rawX;
            const y = rawY;
            const visible = visibility >= VISIBILITY_THRESHOLD;

            // Compute velocity from previous target
            const prev = prevTargetRef.current.get(id);
            let vx = 0;
            let vy = 0;
            if (prev) {
                const dtSec = (now - prev.time) / 1000;
                if (dtSec > 0 && dtSec < 1) {
                    vx = (x - prev.x) / dtSec;
                    vy = (y - prev.y) / dtSec;
                }
            }

            // Store as new previous
            prevTargetRef.current.set(id, { x, y, time: now });
            targetRef.current.set(id, { x, y, visible, arrivedAt: now });

            const tracked = trackedRef.current.get(id);
            if (!tracked) {
                // First appearance → snap
                trackedRef.current.set(id, { x, y, vx, vy, visible });
            } else {
                // Update velocity on tracked point (blended)
                tracked.vx = vx * 0.6 + tracked.vx * 0.4;
                tracked.vy = vy * 0.6 + tracked.vy * 0.4;
                tracked.visible = visible;

                // Snap if the target jumped far (e.g., person re-entered frame)
                const dist = Math.hypot(x - tracked.x, y - tracked.y);
                if (dist > SNAP_DISTANCE) {
                    tracked.x = x;
                    tracked.y = y;
                    tracked.vx = 0;
                    tracked.vy = 0;
                }
            }
        }
    }, [landmarks, mirrored]);

    // ── 60 fps animation loop with velocity prediction ───────────────────
    useEffect(() => {
        let lastTime = performance.now();

        const animate = (now: number) => {
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;

            if (!hasLandmarksRef.current) {
                animFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const lerpFactor = 1 - Math.pow(1 - LERP_SPEED, dt * 60);
            let needsUpdate = false;

            for (const [id, tgt] of targetRef.current) {
                const pt = trackedRef.current.get(id);
                if (!pt) {
                    trackedRef.current.set(id, {
                        x: tgt.x, y: tgt.y, vx: 0, vy: 0, visible: tgt.visible,
                    });
                    needsUpdate = true;
                    continue;
                }

                // How stale is the data?
                const staleness = now - tgt.arrivedAt;
                // Dampen prediction when data is stale
                const predictionScale = staleness < STALE_MS
                    ? PREDICTION_WEIGHT
                    : PREDICTION_WEIGHT * Math.max(0, 1 - (staleness - STALE_MS) / 600);

                // Predicted target = actual target + velocity extrapolation
                const predX = tgt.x + pt.vx * dt * predictionScale;
                const predY = tgt.y + pt.vy * dt * predictionScale;

                const dx = predX - pt.x;
                const dy = predY - pt.y;

                if (Math.abs(dx) > 0.0003 || Math.abs(dy) > 0.0003) {
                    pt.x += dx * lerpFactor;
                    pt.y += dy * lerpFactor;
                    needsUpdate = true;
                }

                // Decay velocity over time
                pt.vx *= Math.pow(VELOCITY_DECAY, dt * 60);
                pt.vy *= Math.pow(VELOCITY_DECAY, dt * 60);
            }

            if (needsUpdate) {
                setTick(t => t + 1);
            }

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    if (!landmarks || landmarks.length === 0) return null;

    const { width, height } = viewSize;

    const getPoint = (idx: number) => {
        const pt = trackedRef.current.get(idx);
        if (!pt || !pt.visible) return null;
        return { x: pt.x * width, y: pt.y * height };
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
