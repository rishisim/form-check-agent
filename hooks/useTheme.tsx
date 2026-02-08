import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    // Save theme preference when it changes
    const toggleTheme = async () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, newIsDark ? 'dark' : 'light');
        } catch (error) {
            console.log('Error saving theme preference:', error);
        }
    };

    const theme = isDark ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
            {children}
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
