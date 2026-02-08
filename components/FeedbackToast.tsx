import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FeedbackToastProps {
    message: string;
    level: 'success' | 'warning' | 'error';
    isLandscape?: boolean;
}

export const FeedbackToast = memo(({ message, level, isLandscape = false }: FeedbackToastProps) => {
    if (!message) return null;

    const getBgColor = () => {
        switch (level) {
            case 'success': return '#D4EDDA'; // Soft Green
            case 'warning': return '#FFF3CD'; // Warm Amber
            case 'error': return '#F8D7DA';   // Soft Red
            default: return '#F0F0F0';
        }
    };

    const getTextColor = () => {
        switch (level) {
            case 'success': return '#155724'; // Dark Green
            case 'warning': return '#856404'; // Dark Amber
            case 'error': return '#721C24';   // Dark Red
            default: return '#444444';
        }
    };

    return (
        <View style={[
            styles.container,
            { backgroundColor: getBgColor() },
            isLandscape && styles.containerLandscape,
        ]}>
            <Text style={[
                styles.text,
                { color: getTextColor() },
                isLandscape && styles.textLandscape,
            ]}>
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
    containerLandscape: {
        bottom: 16,
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 16,
    },
    text: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    },
    textLandscape: {
        fontSize: 17,
    },
});
