import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../constants/theme';

interface RepCounterProps {
    count: number;
}

export const RepCounter = memo(({ count }: RepCounterProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 1.15,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();
    }, [count]);

    return (
        <View style={styles.container}>
            <Animated.Text style={[styles.countText, { transform: [{ scale: scaleAnim }] }]}>
                {count}
            </Animated.Text>
            <Text style={styles.label}>reps</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 56,
        right: spacing.lg,
        alignItems: 'flex-end',
    },
    countText: {
        fontSize: 56,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 62,
        letterSpacing: -2,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textMuted,
        letterSpacing: 1,
        marginTop: 2,
    },
});
