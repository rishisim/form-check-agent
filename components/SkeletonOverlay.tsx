import React, { memo } from 'react';
import Svg, { Line, Circle, Polyline } from 'react-native-svg';
import { View, Dimensions, StyleSheet } from 'react-native';

interface SkeletonOverlayProps {
    landmarks: number[][];
    hipTrajectory: number[][];
}

const { width, height } = Dimensions.get('window');

const CONNECTIONS = [
    [11, 12], [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
];

export const SkeletonOverlay = memo(({ landmarks, hipTrajectory }: SkeletonOverlayProps) => {
    if (!landmarks || landmarks.length === 0) return null;

    const getPoint = (idx: number) => {
        const point = landmarks[idx];
        if (!point) return null;
        return { x: point[1] * width, y: point[2] * height };
    };

    const trajectoryPoints = hipTrajectory
        .map(pt => `${pt[0] * width},${pt[1] * height}`)
        .join(' ');

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                {hipTrajectory.length > 1 && (
                    <Polyline
                        points={trajectoryPoints}
                        fill="none"
                        stroke="rgba(99, 102, 241, 0.5)"
                        strokeWidth="2"
                    />
                )}
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
                            stroke="rgba(255, 255, 255, 0.35)"
                            strokeWidth="1.5"
                        />
                    );
                })}
                {[11, 12, 23, 24, 25, 26, 27, 28].map((idx) => {
                    const pt = getPoint(idx);
                    if (!pt) return null;
                    return (
                        <Circle
                            key={idx}
                            cx={pt.x}
                            cy={pt.y}
                            r="3"
                            fill="rgba(255, 255, 255, 0.6)"
                        />
                    );
                })}
            </Svg>
        </View>
    );
});
