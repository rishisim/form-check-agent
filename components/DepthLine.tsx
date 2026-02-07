import React, { memo } from 'react';
import Svg, { Line, Circle } from 'react-native-svg';
import { View, Dimensions, StyleSheet } from 'react-native';

interface DepthLineProps {
    targetDepthY: number; // Knee Y (normalized 0-1 or pixel coords)
    currentDepthY: number; // Hip Y
    isValid: boolean;     // Are coordinates valid?
}

const { width, height } = Dimensions.get('window');

export const DepthLine = memo(({ targetDepthY, currentDepthY, isValid }: DepthLineProps) => {
    if (!isValid) return null;

    // Convert normalized coords if needed (assuming backend sends pixel coords for now)
    // If backend sends normalized (0-1), multiply by height. If pixel, ensure scaling.
    // Assuming backend sends raw pixel coordinates from original frame size.
    // We need to know the frame size to scale correctly. 
    // For now, let's assume we receive normalized coordinates (0-1) from backend 
    // OR allow backend to return raw pixels and we scale based on assumption.

    // Let's assume normalized 0-1 for flexibility:
    const targetY = targetDepthY * height;
    const currentY = currentDepthY * height;

    const isGoodDepth = currentY >= targetY;
    const color = isGoodDepth ? '#4CAF50' : '#FFFFFF';

    return (
        <View style={StyleSheet.absoluteFill}>
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                {/* Fixed Target Line (at Knee Height) */}
                <Line
                    x1="0"
                    y1={targetY}
                    x2={width * 0.3} // Short line on left
                    y2={targetY}
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray="5, 5"
                    opacity={0.6}
                />

                {/* Moving Indicator (at Hip Height) */}
                <Circle
                    cx={30}
                    cy={currentY}
                    r="8"
                    fill={color}
                    opacity={0.9}
                />
            </Svg>
        </View>
    );
});
