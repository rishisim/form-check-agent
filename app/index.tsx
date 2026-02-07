import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logo}>🏋️</Text>
                <Text style={styles.title}>Form Check Agent</Text>
                <Text style={styles.subtitle}>AI-Powered Workout Coach</Text>
            </View>

            <View style={styles.exerciseList}>
                <Link href="/form-check" style={styles.exerciseCard}>
                    <View>
                        <Text style={styles.exerciseEmoji}>🦵</Text>
                        <Text style={styles.exerciseName}>Squats</Text>
                        <Text style={styles.exerciseDesc}>Track depth & form</Text>
                    </View>
                </Link>

                {/* Future exercises - disabled for now */}
                <View style={[styles.exerciseCard, styles.disabled]}>
                    <Text style={styles.exerciseEmoji}>💪</Text>
                    <Text style={styles.exerciseName}>Push-ups</Text>
                    <Text style={styles.exerciseDesc}>Coming soon</Text>
                </View>
            </View>

            <Text style={styles.instructions}>
                Make sure to run the backend server first:{'\n'}
                <Text style={styles.code}>source venv/bin/activate && python backend/server.py</Text>
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        fontSize: 64,
        marginBottom: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
    },
    exerciseList: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 40,
    },
    exerciseCard: {
        backgroundColor: '#1E1E1E',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 140,
        borderWidth: 1,
        borderColor: '#333',
    },
    disabled: {
        opacity: 0.5,
    },
    exerciseEmoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    exerciseName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    exerciseDesc: {
        color: '#888',
        fontSize: 12,
    },
    instructions: {
        color: '#666',
        fontSize: 12,
        textAlign: 'center',
        position: 'absolute',
        bottom: 40,
    },
    code: {
        color: '#4FC3F7',
        fontFamily: 'monospace',
    },
});

