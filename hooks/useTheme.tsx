import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Animated, Dimensions, StyleSheet, View, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Theme color definitions
export const lightTheme = {
    // Backgrounds
    background: '#F7F7F8',
    cardBackground: '#fff',
    cardBackgroundHover: '#FAFAFA',

    // Text
    textPrimary: '#333',
    textSecondary: '#999',
    textMuted: '#bbb',
    textDisabled: '#ccc',

    // Accents
    accent: '#88B04B',
    accentLight: '#E2F0D9',
    accentText: '#5A8A3C',
    accentTextSecondary: '#7DAF60',

    // UI Elements
    border: '#ddd',
    shadow: '#000',
    shadowOpacity: 0.06,
    ripple: 'rgba(0, 0, 0, 0.08)',
    stepperBackground: '#EEF2F6',
    stepperBackgroundDisabled: '#F5F5F5',
    badgeBackground: '#F0F0F0',

    // Status bar
    statusBar: 'dark' as const,
};

export const darkTheme = {
    // Backgrounds
    background: '#121212',
    cardBackground: '#1E1E1E',
    cardBackgroundHover: '#252525',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666',
    textDisabled: '#444',

    // Accents
    accent: '#A4C969',
    accentLight: '#2A3D20',
    accentText: '#A4C969',
    accentTextSecondary: '#8AAF52',

    // UI Elements
    border: '#333',
    shadow: '#000',
    shadowOpacity: 0.3,
    ripple: 'rgba(255, 255, 255, 0.1)',
    stepperBackground: '#2A2A2A',
    stepperBackgroundDisabled: '#1A1A1A',
    badgeBackground: '#2A2A2A',

    // Status bar
    statusBar: 'light' as const,
};

export type Theme = typeof lightTheme;

interface ThemeContextType {
    theme: Theme;
    isDark: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@formflow_theme';

interface ThemeProviderProps {
    children: ReactNode;
}

// Circle reveal: one circle expands from the toggle button (top-right)
// Only animates scale + opacity → 100% GPU composited, 60fps guaranteed.
const DIAGONAL = Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H);
const CIRCLE_SIZE = DIAGONAL * 2.2;
// Toggle button position (top-right corner, inset)
const ORIGIN_X = SCREEN_W - 36;
const ORIGIN_Y = 56;

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [isDark, setIsDark] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const nextBgRef = useRef('');

    // Single animated value: 0 → 1 (expand in) → 2 (fade out)
    const anim = useRef(new Animated.Value(0)).current;

    // Load saved theme preference on mount
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedTheme !== null) {
                    setIsDark(savedTheme === 'dark');
                }
            } catch (error) {
                console.log('Error loading theme preference:', error);
            }
        };
        loadTheme();
    }, []);

    const toggleTheme = useCallback(async () => {
        if (isTransitioning) return;

        const newIsDark = !isDark;
        nextBgRef.current = (newIsDark ? darkTheme : lightTheme).background;

        setIsTransitioning(true);
        anim.setValue(0);

        // Phase 1: Circle expands from toggle button to cover screen
        Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start(() => {
            // Flip theme while fully covered
            setIsDark(newIsDark);

            // Phase 2: Circle fades out, revealing new theme
            Animated.timing(anim, {
                toValue: 2,
                duration: 200,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            }).start(() => {
                setIsTransitioning(false);
                anim.setValue(0);
            });
        });

        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newIsDark ? 'dark' : 'light');
        } catch (error) {
            console.log('Error saving theme preference:', error);
        }
    }, [isDark, isTransitioning, anim]);

    const theme = isDark ? darkTheme : lightTheme;

    // Scale: 0 → 1 during expand, stays 1 during fade-out
    const circleScale = anim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, 1, 1],
    });

    // Opacity: soft fade in during expand, fade out after flip
    const circleOpacity = anim.interpolate({
        inputRange: [0, 0.15, 0.85, 1, 1.6, 2],
        outputRange: [0, 0.9, 1, 1, 0.4, 0],
    });

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
            <View style={overlayStyles.root}>
                {children}
                {isTransitioning && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            overlayStyles.circle,
                            {
                                backgroundColor: nextBgRef.current,
                                opacity: circleOpacity,
                                transform: [{ scale: circleScale }],
                            },
                        ]}
                    />
                )}
            </View>
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

const overlayStyles = StyleSheet.create({
    root: {
        flex: 1,
    },
    circle: {
        position: 'absolute',
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        left: ORIGIN_X - CIRCLE_SIZE / 2,
        top: ORIGIN_Y - CIRCLE_SIZE / 2,
        zIndex: 9999,
        elevation: 9999,
    },
});
