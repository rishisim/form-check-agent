import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../constants/theme';

interface FeedbackToastProps {
    message: string;
    level: 'success' | 'warning' | 'error';
}

export const FeedbackToast = memo(({ message, level }: FeedbackToastProps) => {
    if (!message) return null;

    const accentColor = level === 'success' ? colors.success : level === 'warning' ? colors.warning : colors.error;

    return (
        <View style={[styles.container, { borderLeftColor: accentColor }]}>
            <Text style={styles.text} numberOfLines={2}>{message}</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 110,
        alignSelf: 'center',
        backgroundColor: 'rgba(10, 10, 10, 0.85)',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.sm,
        borderLeftWidth: 3,
        maxWidth: '85%',
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
});
