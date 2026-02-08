import React, { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing } from '../constants/theme';

interface RepBreakdownProps {
    validReps: number;
    invalidReps: number;
}

export const RepBreakdown = memo(({ validReps, invalidReps }: RepBreakdownProps) => {
    const validScale = useRef(new Animated.Value(1)).current;
    const invalidScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(validScale, {
                    toValue: 1.2,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(invalidScale, {
                    toValue: 1.2,
                    duration: 80,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(validScale, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(invalidScale, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [validReps, invalidReps]);

    const total = validReps + invalidReps;

    return (
        <View style={styles.container}>
            <View style={styles.column}>
                <Animated.Text style={[styles.count, styles.validCount, { transform: [{ scale: validScale }] }]}>
                    {validReps}
                </Animated.Text>
                <Text style={styles.label}>Valid</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.column}>
                <Animated.Text style={[styles.count, styles.invalidCount, { transform: [{ scale: invalidScale }] }]}>
                    {invalidReps}
                </Animated.Text>
                <Text style={styles.label}>Invalid</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.column}>
                <Text style={styles.count}>{total}</Text>
                <Text style={styles.label}>Total</Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 56,
        right: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    column: {
        alignItems: 'center',
        minWidth: 44,
    },
    count: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 32,
    },
    validCount: {
        color: colors.success,
    },
    invalidCount: {
        color: colors.warning,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textMuted,
        letterSpacing: 0.5,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: 28,
        backgroundColor: colors.border,
    },
});
