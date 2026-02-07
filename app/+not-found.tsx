import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View style={styles.container}>
                <Text style={styles.emoji}>🤔</Text>
                <Text style={styles.title}>Page Not Found</Text>
                <Text style={styles.subtitle}>This screen doesn't exist.</Text>
                <Link href="/" style={styles.link}>
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
        backgroundColor: '#F7F7F8',
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#333',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        marginBottom: 24,
    },
    link: {
        backgroundColor: '#88B04B',
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
