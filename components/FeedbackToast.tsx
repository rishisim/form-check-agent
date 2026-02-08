import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FeedbackToastProps {
    message: string;
    level: 'success' | 'warning' | 'error';
}

export const FeedbackToast = memo(({ message, level }: FeedbackToastProps) => {
    if (!message) return null;

    const getBgColor = (level: string) => {
        switch (level) {
            case 'success': return '#D4EDDA'; // Soft Green
            case 'warning': return '#FFF3CD'; // Warm Amber
            case 'error': return '#F8D7DA';   // Soft Red
            default: return '#F0F0F0';
        }
    };

    const getTextColor = (level: string) => {
        switch (level) {
            case 'success': return '#155724'; // Dark Green
            case 'warning': return '#856404'; // Dark Amber
            case 'error': return '#721C24';   // Dark Red
            default: return '#444444';
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: getBgColor(level) }]}>
            <Text style={[styles.text, { color: getTextColor(level) }]}>
                {message}
            </Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        paddingVertical: 18,
        paddingHorizontal: 36,
        borderRadius: 22,
        maxWidth: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
    },
    text: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    }
});
