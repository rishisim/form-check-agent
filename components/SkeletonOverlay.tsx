import React, { memo } from 'react';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { View, Dimensions, StyleSheet } from 'react-native';

interface SkeletonOverlayProps {
    landmarks: number[][]; // [id, x, y]
    hipTrajectory: number[][]; // List of [x, y]
}

const { width, height } = Dimensions.get('window');

// MediaPipe Pose Connections
const CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], // Left Arm
    [12, 14], [14, 16],           // Right Arm
    [11, 23], [12, 24],           // Torso
    [23, 24],                     // Hips
    [23, 25], [25, 27],           // Left Leg
    [24, 26], [26, 28]            // Right Leg
];

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory }: SkeletonOverlayProps) => {
    if (!landmarks || landmarks.length === 0) return null;

    // Helper to get coords (assuming normalized 0-1)
    const getPoint = (idx: number) => {
        const point = landmarks[idx];
        if (!point) return null;
        return { x: point[1] * width, y: point[2] * height };
    };

    // Draw Hip Trajectory
    const trajectoryPoints = hipTrajectory
        .map(pt => `${pt[0] * width},${pt[1] * height}`)
        .join(' ');

    return (
        <View style={StyleSheet.absoluteFill}>
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                {/* Hip Trajectory */}
                {hipTrajectory.length > 1 && (
                    <Polyline
                        points={trajectoryPoints}
                        fill="none"
                        stroke="#FFC107"
                        strokeWidth="3"
                        strokeOpacity="0.6"
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
                            stroke="rgba(255, 255, 255, 0.4)"
                            strokeWidth="2"
                        />
                    );
                })}

                {/* Key Joints */}
                {[11, 12, 23, 24, 25, 26, 27, 28].map((idx) => {
                    const pt = getPoint(idx);
                    if (!pt) return null;
                    return (
                        <Circle
                            key={idx}
                            cx={pt.x}
                            cy={pt.y}
                            r="4"
                            fill="#FFFFFF"
                            opacity={0.8}
                        />
                    );
                })}
            </Svg>
        </View>
    );
});
