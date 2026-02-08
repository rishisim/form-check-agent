import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
    const { isDark, toggleTheme, theme } = useTheme();
    const rotation = useRef(new Animated.Value(isDark ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(rotation, {
            toValue: isDark ? 1 : 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
    }, [isDark]);

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <TouchableOpacity
            onPress={toggleTheme}
            style={[
                styles.container,
                { backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0' }
            ]}
            activeOpacity={0.7}
        >
            <Animated.View style={{ transform: [{ rotate }] }}>
                <View style={styles.iconContainer}>
                    {isDark ? (
                        // Moon icon for dark mode
                        <View style={[styles.moon, { backgroundColor: '#FFD93D' }]}>
                            <View style={[styles.moonCrater, { backgroundColor: '#2A2A2A' }]} />
                        </View>
                    ) : (
                        // Sun icon for light mode
                        <View style={styles.sunContainer}>
                            <View style={[styles.sun, { backgroundColor: '#FFB300' }]} />
                            {[...Array(8)].map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.sunRay,
                                        {
                                            backgroundColor: '#FFB300',
                                            transform: [
                                                { rotate: `${i * 45}deg` },
                                                { translateY: -12 },
                                            ],
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Sun styles
    sunContainer: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sun: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    sunRay: {
        position: 'absolute',
        width: 2,
        height: 4,
        borderRadius: 1,
    },
    // Moon styles
    moon: {
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    moonCrater: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        top: -2,
        right: -2,
    },
});
