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
            case 'success': return '#DDEBF7'; // Light Blue
            case 'warning': return '#FFF2CC'; // Light Yellow
            case 'error': return '#FCE4D6';   // Light Peach
            default: return '#FDFDFD';
        }
    };

    const getTextColor = (level: string) => {
        switch (level) {
            case 'success': return '#41719C'; // Darker Blue
            case 'warning': return '#BF8F00'; // Darker Yellow
            case 'error': return '#C65911';   // Darker Peach/Red
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
