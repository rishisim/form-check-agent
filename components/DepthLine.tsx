import React, { memo, useState, useCallback } from 'react';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';

interface DepthLineProps {
    targetDepthY: number;   // Target Y (normalized 0-1)
    currentDepthY: number;  // Current Y
    isValid: boolean;       // Are coordinates valid?
    label?: string;         // Label for current indicator, e.g. "HIPS" or "CHEST"
}

export const DepthLine = memo(({ targetDepthY, currentDepthY, isValid, label = 'HIPS' }: DepthLineProps) => {
    const [size, setSize] = useState({ width: 1, height: 1 });

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
    }, []);

    if (!isValid) return null;

    const { width, height } = size;
    const targetY = targetDepthY * height;
    const currentY = currentDepthY * height;

    const isGoodDepth = currentY >= targetY;
    const color = isGoodDepth ? '#88B04B' : '#BBBBBB'; // Mint or Soft Grey

    return (
        <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
            <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
                {/* Fixed Target Line (at Knee Height) */}
                <Line
                    x1="0"
                    y1={targetY}
                    x2={width * 0.3}
                    y2={targetY}
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray="6, 6"
                    strokeOpacity="0.8"
                />
                <SvgText
                    x="10"
                    y={targetY - 10}
                    fill={color}
                    fontSize="10"
                    fontWeight="bold"
                    opacity="0.8"
                >
                    TARGET DEPTH
                </SvgText>

                {/* Moving Indicator (at Hip Height) */}
                <Circle
                    cx={30}
                    cy={currentY}
                    r="8"
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                />
                <SvgText
                    x="45"
                    y={currentY + 5}
                    fill={color}
                    fontSize="10"
                    fontWeight="bold"
                >
                    {label}
                </SvgText>
            </Svg>
        </View>
    );
});
