import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

export default function WorkoutConfigScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const params = useLocalSearchParams<{ exercise?: string }>();
    const exercise = (params.exercise || 'squat').toLowerCase();

    const [sets, setSets] = useState(3);
    const [reps, setReps] = useState(10);
    const [timerSeconds, setTimerSeconds] = useState(10);
    const [restSeconds, setRestSeconds] = useState(180);

    const handleStartWorkout = () => {
        router.push(`/form-check?sets=${sets}&reps=${reps}&timerSeconds=${timerSeconds}&restSeconds=${restSeconds}&exercise=${exercise}`);
    };

    const isPushup = exercise === 'pushup';

    const adjust = (
        setter: React.Dispatch<React.SetStateAction<number>>,
        value: number,
        min: number,
        max: number,
        delta: number,
    ) => {
        const next = value + delta;
        if (next >= min && next <= max) setter(next);
    };

    // Dynamic styles based on theme
    const dynamicStyles = useMemo(() => ({
        container: { backgroundColor: theme.background },
        backArrow: { color: theme.textSecondary },
        backLabel: { color: theme.textSecondary },
        title: { color: theme.textPrimary },
        subtitle: { color: theme.textSecondary },
        card: {
            backgroundColor: theme.cardBackground,
            shadowColor: theme.shadow,
            shadowOpacity: theme.shadowOpacity,
        },
        cardLabel: { color: theme.textPrimary },
        cardHint: { color: theme.textSecondary },
        stepBtn: { backgroundColor: theme.stepperBackground },
        stepBtnDisabled: { backgroundColor: theme.stepperBackgroundDisabled },
        stepBtnText: { color: theme.textSecondary },
        stepBtnTextDisabled: { color: theme.textDisabled },
        stepValue: { color: theme.textPrimary },
        summaryCard: { backgroundColor: theme.accentLight },
        summaryText: { color: theme.accentText },
        summarySubtext: { color: theme.accentTextSecondary },
        startButton: {
            backgroundColor: theme.accent,
            shadowColor: theme.accent,
        },
    }), [theme]);

    return (
        <SafeAreaView style={[styles.container, dynamicStyles.container]}>
            {/* Back Arrow */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={[styles.backArrow, dynamicStyles.backArrow]}>‹</Text>
                <Text style={[styles.backLabel, dynamicStyles.backLabel]}>Home</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.emoji}>{isPushup ? '💪' : '🦵'}</Text>
                <Text style={[styles.title, dynamicStyles.title]}>{isPushup ? 'Push-ups' : 'Squats'}</Text>
                <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Configure your workout</Text>

                {/* ── Sets ────────────────────────── */}
                <View style={[styles.card, dynamicStyles.card]}>
                    <Text style={[styles.cardLabel, dynamicStyles.cardLabel]}>Sets</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                sets <= 1 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setSets, sets, 1, 20, -1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                sets <= 1 && dynamicStyles.stepBtnTextDisabled
                            ]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, dynamicStyles.stepValue]}>{sets}</Text>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                sets >= 20 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setSets, sets, 1, 20, 1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                sets >= 20 && dynamicStyles.stepBtnTextDisabled
                            ]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Reps per Set ────────────────── */}
                <View style={[styles.card, dynamicStyles.card]}>
                    <Text style={[styles.cardLabel, dynamicStyles.cardLabel]}>Reps per Set</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                reps <= 1 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setReps, reps, 1, 30, -1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                reps <= 1 && dynamicStyles.stepBtnTextDisabled
                            ]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, dynamicStyles.stepValue]}>{reps}</Text>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                reps >= 30 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setReps, reps, 1, 30, 1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                reps >= 30 && dynamicStyles.stepBtnTextDisabled
                            ]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Countdown Timer ────────────── */}
                <View style={[styles.card, dynamicStyles.card]}>
                    <Text style={[styles.cardLabel, dynamicStyles.cardLabel]}>Countdown Timer</Text>
                    <Text style={[styles.cardHint, dynamicStyles.cardHint]}>Seconds before analysis begins</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                timerSeconds <= 0 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setTimerSeconds, timerSeconds, 0, 60, -5)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                timerSeconds <= 0 && dynamicStyles.stepBtnTextDisabled
                            ]}>−</Text>
                        </TouchableOpacity>
                        <Text style={[styles.stepValue, dynamicStyles.stepValue]}>{timerSeconds}s</Text>
                        <TouchableOpacity
                            style={[
                                styles.stepBtn,
                                dynamicStyles.stepBtn,
                                timerSeconds >= 60 && dynamicStyles.stepBtnDisabled
                            ]}
                            onPress={() => adjust(setTimerSeconds, timerSeconds, 0, 60, 5)}
                            activeOpacity={0.6}
                        >
                            <Text style={[
                                styles.stepBtnText,
                                dynamicStyles.stepBtnText,
                                timerSeconds >= 60 && dynamicStyles.stepBtnTextDisabled
                            ]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Rest Between Sets ────────────── */}
                {sets > 1 && (
                    <View style={[styles.card, dynamicStyles.card]}>
                        <Text style={[styles.cardLabel, dynamicStyles.cardLabel]}>Rest Between Sets</Text>
                        <Text style={[styles.cardHint, dynamicStyles.cardHint]}>You can skip the rest timer during workout</Text>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[
                                    styles.stepBtn,
                                    dynamicStyles.stepBtn,
                                    restSeconds <= 0 && dynamicStyles.stepBtnDisabled
                                ]}
                                onPress={() => adjust(setRestSeconds, restSeconds, 0, 600, -15)}
                                activeOpacity={0.6}
                            >
                                <Text style={[
                                    styles.stepBtnText,
                                    dynamicStyles.stepBtnText,
                                    restSeconds <= 0 && dynamicStyles.stepBtnTextDisabled
                                ]}>−</Text>
                            </TouchableOpacity>
                            <Text style={[styles.stepValue, dynamicStyles.stepValue]}>
                                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
                            </Text>
                            <TouchableOpacity
                                style={[
                                    styles.stepBtn,
                                    dynamicStyles.stepBtn,
                                    restSeconds >= 600 && dynamicStyles.stepBtnDisabled
                                ]}
                                onPress={() => adjust(setRestSeconds, restSeconds, 0, 600, 15)}
                                activeOpacity={0.6}
                            >
                                <Text style={[
                                    styles.stepBtnText,
                                    dynamicStyles.stepBtnText,
                                    restSeconds >= 600 && dynamicStyles.stepBtnTextDisabled
                                ]}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Summary ────────────────────── */}
                <View style={[styles.summaryCard, dynamicStyles.summaryCard]}>
                    <Text style={[styles.summaryText, dynamicStyles.summaryText]}>
                        {sets} × {reps} = {sets * reps} total reps
                    </Text>
                    {timerSeconds > 0 && (
                        <Text style={[styles.summarySubtext, dynamicStyles.summarySubtext]}>
                            {timerSeconds}s countdown before start
                        </Text>
                    )}
                    {sets > 1 && restSeconds > 0 && (
                        <Text style={[styles.summarySubtext, dynamicStyles.summarySubtext]}>
                            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')} rest between sets
                        </Text>
                    )}
                </View>
            </ScrollView>

            {/* ── Start Button ───────────────────── */}
            <View style={styles.bottomSpacer}>
                <TouchableOpacity
                    style={[styles.startButton, dynamicStyles.startButton]}
                    onPress={handleStartWorkout}
                    activeOpacity={0.85}
                >
                    <Text style={styles.startButtonText}>Start Workout 💪</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backArrow: {
        fontSize: 32,
        fontWeight: '300',
        lineHeight: 34,
    },
    backLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 4,
    },
    content: {
        paddingHorizontal: 24,
        paddingBottom: 120,
        alignItems: 'center',
    },
    emoji: {
        fontSize: 56,
        marginBottom: 6,
        marginTop: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 28,
    },
    /* ── Card ─── */
    card: {
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginBottom: 14,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 10,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    cardHint: {
        fontSize: 12,
        marginBottom: 4,
    },
    /* ── Stepper ─── */
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    stepBtn: {
        width: 50,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBtnText: {
        fontSize: 26,
        fontWeight: '600',
    },
    stepValue: {
        fontSize: 34,
        fontWeight: '800',
        minWidth: 90,
        textAlign: 'center',
    },
    /* ── Summary ─── */
    summaryCard: {
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 24,
        width: '100%',
        alignItems: 'center',
        marginTop: 6,
    },
    summaryText: {
        fontSize: 17,
        fontWeight: '700',
    },
    summarySubtext: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    /* ── Bottom ─── */
    bottomSpacer: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    startButton: {
        paddingVertical: 18,
        borderRadius: 22,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    startButtonText: {
        fontSize: 19,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.3,
    },
});
