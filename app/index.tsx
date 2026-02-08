import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logo}>🏋️</Text>
                <Text style={styles.title}>Form Check Agent</Text>
                <Text style={styles.subtitle}>AI-Powered Workout Coach</Text>
            </View>

            <View style={styles.exerciseList}>
                <Link href="/workout-config" style={styles.exerciseCard}>
                    <View style={styles.cardInner}>
                        <Text style={styles.exerciseEmoji}>🦵</Text>
                        <Text style={styles.exerciseName}>Squats</Text>
                        <Text style={styles.exerciseDesc}>Track depth & form</Text>
                    </View>
                </Link>

                <Link href="/workout-config?exercise=pushup" style={styles.exerciseCard}>
                    <View style={styles.cardInner}>
                        <Text style={styles.exerciseEmoji}>💪</Text>
                        <Text style={styles.exerciseName}>Push-ups</Text>
                        <Text style={styles.exerciseDesc}>Track form & reps</Text>
                    </View>
                </Link>
            </View>

            <Text style={styles.footer}>
                Run the backend first:{'\n'}
                <Text style={styles.code}>python backend/server.py</Text>
            </Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F8',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logo: {
        fontSize: 72,
        marginBottom: 12,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: '#333',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 16,
        color: '#999',
        fontWeight: '500',
    },
    exerciseList: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 40,
    },
    exerciseCard: {
        backgroundColor: '#fff',
        padding: 28,
        borderRadius: 24,
        alignItems: 'center',
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    cardInner: {
        alignItems: 'center',
    },
    disabled: {
        opacity: 0.4,
    },
    exerciseEmoji: {
        fontSize: 44,
        marginBottom: 10,
    },
    exerciseName: {
        color: '#333',
        fontSize: 19,
        fontWeight: '700',
        marginBottom: 4,
    },
    exerciseDesc: {
        color: '#999',
        fontSize: 13,
        fontWeight: '500',
    },
    footer: {
        color: '#bbb',
        fontSize: 12,
        textAlign: 'center',
        position: 'absolute',
        bottom: 48,
    },
    code: {
        color: '#88B04B',
        fontFamily: 'monospace',
    },
});
