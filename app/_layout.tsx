import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="form-check" options={{ title: 'Analyze Form' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
