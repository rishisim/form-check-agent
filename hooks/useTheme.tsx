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

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [isDark, setIsDark] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Overlay panels: two diagonal strips that sweep across
    const overlayAnim = useRef(new Animated.Value(0)).current;
    // Store the "next" background color for the overlay
    const nextBgRef = useRef('');

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

    // Animated toggle with sweep overlay
    const toggleTheme = useCallback(async () => {
        if (isTransitioning) return;

        const newIsDark = !isDark;
        const nextTheme = newIsDark ? darkTheme : lightTheme;
        nextBgRef.current = nextTheme.background;

        setIsTransitioning(true);
        overlayAnim.setValue(0);

        // Phase 1: Diagonal sweep in (top-right → bottom-left), fading in
        Animated.timing(overlayAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
        }).start(() => {
            // Flip the actual theme while fully covered
            setIsDark(newIsDark);

            // Phase 2: Continue diagonal sweep out, fading out
            Animated.timing(overlayAnim, {
                toValue: 2,
                duration: 280,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                useNativeDriver: true,
            }).start(() => {
                setIsTransitioning(false);
                overlayAnim.setValue(0);
            });
        });

        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newIsDark ? 'dark' : 'light');
        } catch (error) {
            console.log('Error saving theme preference:', error);
        }
    }, [isDark, isTransitioning, overlayAnim]);

    const theme = isDark ? darkTheme : lightTheme;

    // Diagonal sweep: translate on both X and Y simultaneously
    // Enters from top-right, exits toward bottom-left
    const diagonal = Math.sqrt(SCREEN_W * SCREEN_W + SCREEN_H * SCREEN_H);

    const overlayTranslateX = overlayAnim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [diagonal * 0.7, 0, -diagonal * 0.7],
    });

    const overlayTranslateY = overlayAnim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [-diagonal * 0.35, 0, diagonal * 0.35],
    });

    // Soft fade: starts transparent, builds to full, then fades out
    const overlayOpacity = overlayAnim.interpolate({
        inputRange: [0, 0.3, 0.7, 1, 1.3, 1.7, 2],
        outputRange: [0, 0.85, 1, 1, 1, 0.85, 0],
    });

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
            <View style={overlayStyles.root}>
                {children}
                {isTransitioning && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            overlayStyles.overlay,
                            {
                                backgroundColor: nextBgRef.current,
                                opacity: overlayOpacity,
                                transform: [
                                    { translateX: overlayTranslateX },
                                    { translateY: overlayTranslateY },
                                    { rotate: '-25deg' },
                                ],
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
    overlay: {
        position: 'absolute',
        // Make panel large enough to cover screen even when rotated 25°
        width: SCREEN_W * 2.5,
        height: SCREEN_H * 2.5,
        top: -SCREEN_H * 0.75,
        left: -SCREEN_W * 0.75,
        zIndex: 9999,
        elevation: 9999,
    },
});
