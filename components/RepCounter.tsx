import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RepCounterProps {
    validCount: number;
    invalidCount: number;
    transparent?: boolean;
}

export const RepCounter = memo(({ validCount, invalidCount, transparent }: RepCounterProps) => {
    return (
        <View style={[styles.container, transparent && styles.transparent]}>
            <View style={styles.counterRow}>
                {/* Valid Reps */}
                <View style={styles.counterItem}>
                    <Text style={[styles.countText, styles.validText]}>{validCount}</Text>
                    <Text style={styles.label}>VALID</Text>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Invalid Reps */}
                <View style={styles.counterItem}>
                    <Text style={[styles.countText, styles.invalidText]}>{invalidCount}</Text>
                    <Text style={styles.label}>INVALID</Text>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FDFDFD',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    counterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    counterItem: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    divider: {
        width: 1,
        height: 20,
        backgroundColor: '#E0E0E0',
        marginHorizontal: 2,
    },
    countText: {
        fontSize: 24,
        fontWeight: '800',
        lineHeight: 28,
    },
    validText: {
        color: '#88B04B',
    },
    invalidText: {
        color: '#E67E22',
    },
    label: {
        fontSize: 8,
        fontWeight: '800',
        color: '#999999',
        letterSpacing: 1,
    },
    transparent: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
        paddingVertical: 0,
        paddingHorizontal: 4,
    }
});
