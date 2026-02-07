import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FeedbackToastProps {
    message: string;
    level: 'success' | 'warning' | 'error';
}

export const FeedbackToast = memo(({ message, level }: FeedbackToastProps) => {
    if (!message) return null;

    const getColor = (level: string) => {
        switch (level) {
            case 'success': return '#4CAF50';
            case 'warning': return '#FFC107';
            case 'error': return '#F44336';
            default: return '#FFFFFF';
        }
    };

    return (
        <View style={[styles.container, { borderLeftColor: getColor(level) }]}>
            <Text style={[styles.text, { color: level === 'warning' ? '#FFD740' : '#FFFFFF' }]}>
                {message}
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderLeftWidth: 4,
        maxWidth: '80%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    text: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    }
});
