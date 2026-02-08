import React, { memo } from 'react';
import Svg, { Line, Circle } from 'react-native-svg';
import { View, Dimensions, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

interface DepthLineProps {
    targetDepthY: number;
    currentDepthY: number;
    isValid: boolean;
}

const { width, height } = Dimensions.get('window');

export const DepthLine = memo(({ targetDepthY, currentDepthY, isValid }: DepthLineProps) => {
    if (!isValid) return null;

    const targetY = targetDepthY * height;
    const currentY = currentDepthY * height;
    const isGoodDepth = currentY >= targetY;
    const lineColor = isGoodDepth ? colors.success : 'rgba(255,255,255,0.5)';

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                <Line
                    x1="0"
                    y1={targetY}
                    x2={width * 0.25}
                    y2={targetY}
                    stroke={lineColor}
                    strokeWidth="2"
                    strokeDasharray="4, 4"
                    opacity={0.5}
                />
                <Circle
                    cx={24}
                    cy={currentY}
                    r="6"
                    fill={lineColor}
                    opacity={0.7}
                />
            </Svg>
        </View>
    );
});
