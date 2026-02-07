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
const LERP_SPEED = 0.3; // 0-1, higher = snappier catch-up

interface SmoothedPoint {
    x: number;
    y: number;
}

interface TargetPoint {
    x: number;
    y: number;
    visible: boolean;
}

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory, mirrored = true }: SkeletonOverlayProps) => {
    const [viewSize, setViewSize] = useState({ width: 1, height: 1 });
    const smoothedRef = useRef<Map<number, SmoothedPoint>>(new Map());
    const targetRef = useRef<Map<number, TargetPoint>>(new Map());
    const animFrameRef = useRef<number | null>(null);
    const hasLandmarksRef = useRef(false);
    const [, setTick] = useState(0); // force re-render

    // Measure actual overlay size (matches camera view)
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            setViewSize({ width, height });
        }
    }, []);

    // Update targets immediately when new landmarks arrive
    useEffect(() => {
        if (!landmarks || landmarks.length === 0) {
            hasLandmarksRef.current = false;
            return;
        }
        hasLandmarksRef.current = true;

        // Build a lookup by landmark id
        const lmMap = new Map<number, number[]>();
        for (const lm of landmarks) {
            lmMap.set(lm[0], lm);
        }

        for (const [id, lm] of lmMap) {
            const rawX = lm[1]; // normalized 0-1
            const rawY = lm[2]; // normalized 0-1
            const visibility = lm.length > 3 ? lm[3] : 1;

            // Mirror x for front camera (preview is mirrored but coords are not)
            const x = mirrored ? 1 - rawX : rawX;
            const y = rawY;
            const visible = visibility >= VISIBILITY_THRESHOLD;

            targetRef.current.set(id, { x, y, visible });

            // Snap to position on first appearance (no lerp from 0,0)
            if (!smoothedRef.current.has(id)) {
                smoothedRef.current.set(id, { x, y });
            }
        }
    }, [landmarks, mirrored]);

    // 60fps interpolation loop — smoothly moves rendered positions toward targets
    useEffect(() => {
        let lastTime = performance.now();

        const animate = (now: number) => {
            const dt = Math.min((now - lastTime) / 1000, 0.1); // cap delta
            lastTime = now;

            if (!hasLandmarksRef.current) {
                animFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            // Frame-rate independent lerp factor
            const factor = 1 - Math.pow(1 - LERP_SPEED, dt * 60);
            let needsUpdate = false;

            for (const [id, tgt] of targetRef.current) {
                const curr = smoothedRef.current.get(id);
                if (!curr) {
                    smoothedRef.current.set(id, { x: tgt.x, y: tgt.y });
                    needsUpdate = true;
                    continue;
                }

                const dx = tgt.x - curr.x;
                const dy = tgt.y - curr.y;

                if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
                    curr.x += dx * factor;
                    curr.y += dy * factor;
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
            if (animFrameRef.current !== null) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    if (!landmarks || landmarks.length === 0) return null;

    const { width, height } = viewSize;

    // Read smoothed position for a landmark, respecting visibility
    const getPoint = (idx: number) => {
        const tgt = targetRef.current.get(idx);
        if (!tgt || !tgt.visible) return null;
        const s = smoothedRef.current.get(idx);
        if (!s) return null;
        return { x: s.x * width, y: s.y * height };
    };

    // Hip trajectory with mirroring
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
