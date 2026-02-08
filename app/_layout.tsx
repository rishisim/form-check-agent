import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { ThemeProvider, useTheme } from '../hooks/useTheme';

function AppContent() {
  const { theme } = useTheme();

  // Default the entire app to portrait; form-check.tsx overrides for pushups
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={theme.statusBar} />
    </>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
