import React, { memo } from 'react';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { View, Dimensions, StyleSheet } from 'react-native';

interface DepthLineProps {
    targetDepthY: number; // Knee Y (normalized 0-1)
    currentDepthY: number; // Hip Y
    isValid: boolean;     // Are coordinates valid?
}

const { width, height } = Dimensions.get('window');

export const DepthLine = memo(({ targetDepthY, currentDepthY, isValid }: DepthLineProps) => {
    if (!isValid) return null;

    const targetY = targetDepthY * height;
    const currentY = currentDepthY * height;

    const isGoodDepth = currentY >= targetY;
    const color = isGoodDepth ? '#88B04B' : '#BBBBBB'; // Mint or Soft Grey

    return (
        <View style={StyleSheet.absoluteFill}>
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
                    HIPS
                </SvgText>
            </Svg>
        </View>
    );
});
