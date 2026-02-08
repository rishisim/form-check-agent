import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function WorkoutConfigScreen() {
    const router = useRouter();
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

    return (
        <SafeAreaView style={styles.container}>
            {/* Back Arrow */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backLabel}>Home</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.emoji}>{isPushup ? '💪' : '🦵'}</Text>
                <Text style={styles.title}>{isPushup ? 'Push-ups' : 'Squats'}</Text>
                <Text style={styles.subtitle}>Configure your workout</Text>

                {/* ── Sets ────────────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Sets</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[styles.stepBtn, sets <= 1 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setSets, sets, 1, 20, -1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, sets <= 1 && styles.stepBtnTextDisabled]}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValue}>{sets}</Text>
                        <TouchableOpacity
                            style={[styles.stepBtn, sets >= 20 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setSets, sets, 1, 20, 1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, sets >= 20 && styles.stepBtnTextDisabled]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Reps per Set ────────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Reps per Set</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[styles.stepBtn, reps <= 1 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setReps, reps, 1, 30, -1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, reps <= 1 && styles.stepBtnTextDisabled]}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValue}>{reps}</Text>
                        <TouchableOpacity
                            style={[styles.stepBtn, reps >= 30 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setReps, reps, 1, 30, 1)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, reps >= 30 && styles.stepBtnTextDisabled]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Countdown Timer ────────────── */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Countdown Timer</Text>
                    <Text style={styles.cardHint}>Seconds before analysis begins</Text>
                    <View style={styles.stepper}>
                        <TouchableOpacity
                            style={[styles.stepBtn, timerSeconds <= 0 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setTimerSeconds, timerSeconds, 0, 60, -5)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, timerSeconds <= 0 && styles.stepBtnTextDisabled]}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepValue}>{timerSeconds}s</Text>
                        <TouchableOpacity
                            style={[styles.stepBtn, timerSeconds >= 60 && styles.stepBtnDisabled]}
                            onPress={() => adjust(setTimerSeconds, timerSeconds, 0, 60, 5)}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.stepBtnText, timerSeconds >= 60 && styles.stepBtnTextDisabled]}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Rest Between Sets ────────────── */}
                {sets > 1 && (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Rest Between Sets</Text>
                        <Text style={styles.cardHint}>You can skip the rest timer during workout</Text>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[styles.stepBtn, restSeconds <= 0 && styles.stepBtnDisabled]}
                                onPress={() => adjust(setRestSeconds, restSeconds, 0, 600, -15)}
                                activeOpacity={0.6}
                            >
                                <Text style={[styles.stepBtnText, restSeconds <= 0 && styles.stepBtnTextDisabled]}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepValue}>
                                {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
                            </Text>
                            <TouchableOpacity
                                style={[styles.stepBtn, restSeconds >= 600 && styles.stepBtnDisabled]}
                                onPress={() => adjust(setRestSeconds, restSeconds, 0, 600, 15)}
                                activeOpacity={0.6}
                            >
                                <Text style={[styles.stepBtnText, restSeconds >= 600 && styles.stepBtnTextDisabled]}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Summary ────────────────────── */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryText}>
                        {sets} × {reps} = {sets * reps} total reps
                    </Text>
                    {timerSeconds > 0 && (
                        <Text style={styles.summarySubtext}>{timerSeconds}s countdown before start</Text>
                    )}
                    {sets > 1 && restSeconds > 0 && (
                        <Text style={styles.summarySubtext}>
                            {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')} rest between sets
                        </Text>
                    )}
                </View>
            </ScrollView>

            {/* ── Start Button ───────────────────── */}
            <View style={styles.bottomSpacer}>
                <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout} activeOpacity={0.85}>
                    <Text style={styles.startButtonText}>Start Workout 💪</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F8',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    backArrow: {
        fontSize: 32,
        color: '#555',
        fontWeight: '300',
        lineHeight: 34,
    },
    backLabel: {
        fontSize: 16,
        color: '#888',
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
        color: '#333',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: '#999',
        fontWeight: '500',
        marginBottom: 28,
    },
    /* ── Card ─── */
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    cardLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#444',
        marginBottom: 2,
    },
    cardHint: {
        fontSize: 12,
        color: '#aaa',
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
        backgroundColor: '#EEF2F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepBtnDisabled: {
        backgroundColor: '#F5F5F5',
    },
    stepBtnText: {
        fontSize: 26,
        fontWeight: '600',
        color: '#555',
    },
    stepBtnTextDisabled: {
        color: '#ccc',
    },
    stepValue: {
        fontSize: 34,
        fontWeight: '800',
        color: '#333',
        minWidth: 90,
        textAlign: 'center',
    },
    /* ── Summary ─── */
    summaryCard: {
        backgroundColor: '#E2F0D9',
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
        color: '#5A8A3C',
    },
    summarySubtext: {
        fontSize: 13,
        fontWeight: '500',
        color: '#7DAF60',
        marginTop: 4,
    },
    /* ── Bottom ─── */
    bottomSpacer: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    startButton: {
        backgroundColor: '#88B04B',
        paddingVertical: 18,
        borderRadius: 22,
        alignItems: 'center',
        shadowColor: '#88B04B',
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
