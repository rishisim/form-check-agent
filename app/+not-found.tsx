import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export default function NotFoundScreen() {
    const { theme } = useTheme();

    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <Text style={styles.emoji}>🤔</Text>
                <Text style={[styles.title, { color: theme.textPrimary }]}>Page Not Found</Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>This screen doesn't exist.</Text>
                <Link href="/" style={[styles.link, { backgroundColor: theme.accent }]}>
                    <Text style={styles.linkText}>Go to Home</Text>
                </Link>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 24,
    },
    link: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 18,
    },
    linkText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
