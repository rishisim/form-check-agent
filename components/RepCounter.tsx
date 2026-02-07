import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RepCounterProps {
    count: number;
}

export const RepCounter = memo(({ count }: RepCounterProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.countText}>{count}</Text>
            <Text style={styles.label}>REPS</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        right: 30,
        alignItems: 'flex-end',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 5,
    },
    countText: {
        fontSize: 72,
        fontWeight: '900',
        color: '#FFFFFF',
        lineHeight: 80,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#AAAAAA',
        letterSpacing: 2,
    },
});
