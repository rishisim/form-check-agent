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
// Dead-reckoning constants  (same technique as multiplayer game net-code)
//
// The skeleton data is ~300-500 ms old by the time we render it (camera
// capture + encode + network + MediaPipe).  Instead of showing where the
// body WAS, we extrapolate forward by the pipeline delay so the skeleton
// appears where the body IS RIGHT NOW.
// ─────────────────────────────────────────────────────────────────────────
const LEAD_TIME_S = 0.18;        // extra seconds to predict AHEAD of current time
const MAX_EXTRAPOLATE_S = 0.55;  // clamp total extrapolation to avoid runaway
const VELOCITY_BLEND = 0.45;     // EMA blend for new velocity (lower = smoother)
const SNAP_DISTANCE = 0.12;      // teleport on big jumps
const JITTER_THRESHOLD = 0.001;  // ignore sub-pixel noise

interface JointState {
    // Last known target from server (normalized 0-1)
    tx: number;
    ty: number;
    // Smoothed velocity (normalized units / sec)
    vx: number;
    vy: number;
    // Rendered position (updated every animation frame)
    rx: number;
    ry: number;
    visible: boolean;
    arrivedAt: number; // performance.now() when last target arrived
}

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory, mirrored = true }: SkeletonOverlayProps) => {
    const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
    const jointsRef = useRef<Map<number, JointState>>(new Map());
    const prevTargetRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());
    const animFrameRef = useRef<number | null>(null);
    const hasLandmarksRef = useRef(false);
    const [, setTick] = useState(0);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setViewSize({ width, height });
    }, []);

    // ── New landmarks arrive → update targets + compute velocity ─────────
    useEffect(() => {
        if (!landmarks || landmarks.length === 0) {
            hasLandmarksRef.current = false;
            return;
        }
        hasLandmarksRef.current = true;
        const now = performance.now();

        const lmMap = new Map<number, number[]>();
        for (const lm of landmarks) lmMap.set(lm[0], lm);

        for (const [id, lm] of lmMap) {
            const rawX = lm[1];
            const rawY = lm[2];
            const visibility = lm.length > 3 ? lm[3] : 1;
            const x = mirrored ? 1 - rawX : rawX;
            const y = rawY;
            const visible = visibility >= VISIBILITY_THRESHOLD;

            // Velocity from consecutive server updates
            const prev = prevTargetRef.current.get(id);
            let newVx = 0;
            let newVy = 0;
            if (prev) {
                const dtSec = (now - prev.time) / 1000;
                if (dtSec > 0.01 && dtSec < 1.5) {
                    newVx = (x - prev.x) / dtSec;
                    newVy = (y - prev.y) / dtSec;
                }
            }
            prevTargetRef.current.set(id, { x, y, time: now });

            const joint = jointsRef.current.get(id);
            if (!joint) {
                // First sighting — snap everything
                jointsRef.current.set(id, {
                    tx: x, ty: y,
                    vx: newVx, vy: newVy,
                    rx: x, ry: y,
                    visible,
                    arrivedAt: now,
                });
            } else {
                const dist = Math.hypot(x - joint.tx, y - joint.ty);
                if (dist > SNAP_DISTANCE) {
                    // Big jump (person re-entered) — hard reset
                    joint.tx = x; joint.ty = y;
                    joint.rx = x; joint.ry = y;
                    joint.vx = 0; joint.vy = 0;
                } else {
                    // Smooth velocity with EMA to avoid jittery prediction
                    joint.vx = newVx * VELOCITY_BLEND + joint.vx * (1 - VELOCITY_BLEND);
                    joint.vy = newVy * VELOCITY_BLEND + joint.vy * (1 - VELOCITY_BLEND);
                    joint.tx = x;
                    joint.ty = y;
                    // SNAP rendered position to the dead-reckoned spot immediately
                    // (the animation loop will continue extrapolating from here)
                    const leadNow = Math.min(LEAD_TIME_S, MAX_EXTRAPOLATE_S);
                    joint.rx = x + joint.vx * leadNow;
                    joint.ry = y + joint.vy * leadNow;
                }
                joint.visible = visible;
                joint.arrivedAt = now;
            }
        }
    }, [landmarks, mirrored]);

    // ── 60 fps dead-reckoning loop ───────────────────────────────────────
    // Every frame: rendered pos = target + velocity × (timeSinceTarget + LEAD)
    // No lerp. No smoothing on position. Just pure extrapolation.
    // This makes the skeleton track where the body IS, not where it WAS.
    useEffect(() => {
        const animate = (now: number) => {
            if (!hasLandmarksRef.current) {
                animFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            let needsUpdate = false;

            for (const [, joint] of jointsRef.current) {
                if (!joint.visible) continue;

                const timeSinceUpdate = (now - joint.arrivedAt) / 1000;
                // Total time to extrapolate: time elapsed + lead-time, capped
                const extrapT = Math.min(timeSinceUpdate + LEAD_TIME_S, MAX_EXTRAPOLATE_S);

                // Dead-reckoned position
                const drX = joint.tx + joint.vx * extrapT;
                const drY = joint.ty + joint.vy * extrapT;

                // Only update if it moved enough (avoids unnecessary renders)
                if (Math.abs(drX - joint.rx) > JITTER_THRESHOLD ||
                    Math.abs(drY - joint.ry) > JITTER_THRESHOLD) {
                    joint.rx = drX;
                    joint.ry = drY;
                    needsUpdate = true;
                }
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
