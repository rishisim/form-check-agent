import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, radius } from '../constants/theme';

export default function HomeScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.logo}>Form</Text>
                <Text style={styles.subtitle}>AI form coach</Text>
            </View>

            <View style={styles.exerciseList}>
                <Link href="/form-check" style={styles.exerciseCard}>
                    <Text style={styles.exerciseEmoji}>Squats</Text>
                    <Text style={styles.exerciseDesc}>Depth & form</Text>
                </Link>

                <Link href="/form-check-pushup" style={styles.exerciseCard}>
                    <Text style={styles.exerciseEmoji}>Push-ups</Text>
                    <Text style={styles.exerciseDesc}>Reps & form</Text>
                </Link>
            </View>

            <Text style={styles.instructions}>
                Run backend: cd form-check-agent, cd backend, python server.py
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl * 2,
    },
    logo: {
        fontSize: 32,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    exerciseList: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    exerciseCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: radius.md,
        minWidth: 140,
        borderWidth: 1,
        borderColor: colors.border,
    },
    exerciseEmoji: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
    },
    exerciseDesc: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: spacing.xs,
    },
    instructions: {
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
        position: 'absolute',
        bottom: spacing.xl + spacing.lg,
        paddingHorizontal: spacing.lg,
    },
});
