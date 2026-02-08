import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AnalysisScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        totalSets: string;
        repsPerSet: string;
        setData: string;
        workoutDuration: string;
        kneeMin: string;
        kneeMax: string;
        kneeAvg: string;
        hipMin: string;
        hipMax: string;
        hipAvg: string;
    }>();

    const totalSets = parseInt(params.totalSets || '0', 10);
    const repsPerSet = parseInt(params.repsPerSet || '0', 10);
    const workoutDuration = parseInt(params.workoutDuration || '0', 10);
    const setData: Array<{ validReps: number; invalidReps: number }> = JSON.parse(
        params.setData || '[]',
    );

    const kneeMin = parseInt(params.kneeMin || '0', 10);
    const kneeMax = parseInt(params.kneeMax || '0', 10);
    const kneeAvg = parseInt(params.kneeAvg || '0', 10);
    const hipMin = parseInt(params.hipMin || '0', 10);
    const hipMax = parseInt(params.hipMax || '0', 10);
    const hipAvg = parseInt(params.hipAvg || '0', 10);

    // ─── Computed Metrics ────────────────────────
    const totalValidReps = setData.reduce((sum, s) => sum + s.validReps, 0);
    const totalInvalidReps = setData.reduce((sum, s) => sum + s.invalidReps, 0);
    const totalReps = totalValidReps + totalInvalidReps;
    const formScore =
        totalReps > 0
            ? Math.round((totalValidReps / totalReps) * 100)
            : 0;

    // Duration formatting
    const durationMin = Math.floor(workoutDuration / 60);
    const durationSec = workoutDuration % 60;
    const durationStr =
        durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

    // Form quality grade
    const getFormGrade = (score: number) => {
        if (score >= 90) return { label: 'Excellent', color: '#88B04B', bg: '#E2F0D9', emoji: '🌟' };
        if (score >= 75) return { label: 'Good', color: '#5B9BD5', bg: '#DEEAF6', emoji: '👍' };
        if (score >= 60) return { label: 'Decent', color: '#FFC000', bg: '#FFF2CC', emoji: '💪' };
        if (score >= 40) return { label: 'Needs Work', color: '#ED7D31', bg: '#FCE4D6', emoji: '⚠️' };
        return { label: 'Poor', color: '#C00000', bg: '#FADBD8', emoji: '🔴' };
    };
    const formGrade = getFormGrade(formScore);

    // Knee angle assessment
    const getKneeAssessment = () => {
        if (kneeMin === 0 && kneeMax === 0)
            return { text: 'No data recorded', color: '#999' };
        if (kneeMin < 70)
            return { text: 'Great depth! Below parallel.', color: '#88B04B' };
        if (kneeMin < 90)
            return { text: 'Good depth. Near parallel.', color: '#5B9BD5' };
        return { text: 'Try going deeper for full ROM.', color: '#ED7D31' };
    };

    // Hip / back angle assessment
    const getHipAssessment = () => {
        if (hipMin === 0 && hipMax === 0)
            return { text: 'No data recorded', color: '#999' };
        if (hipAvg >= 40 && hipAvg <= 70)
            return { text: 'Good back angle maintained.', color: '#88B04B' };
        if (hipAvg < 40)
            return { text: 'Leaning too far forward.', color: '#ED7D31' };
        return { text: 'Very upright. Slight lean is OK.', color: '#5B9BD5' };
    };

    const kneeAssessment = getKneeAssessment();
    const hipAssessment = getHipAssessment();

    // ─── Render ──────────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            {/* Back Arrow */}
            <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backLabel}>Home</Text>
            </TouchableOpacity>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ─── */}
                <Text style={styles.headerEmoji}>📊</Text>
                <Text style={styles.headerTitle}>Workout Analysis</Text>
                <Text style={styles.headerSubtitle}>
                    Squats · {totalSets} sets × {repsPerSet} reps
                </Text>

                {/* ── Form Score Card ─── */}
                <View style={[styles.scoreCard, { borderColor: formGrade.color }]}>
                    <View style={[styles.scoreBadge, { backgroundColor: formGrade.bg }]}>
                        <Text style={styles.scoreBadgeEmoji}>{formGrade.emoji}</Text>
                    </View>
                    <Text style={[styles.scoreNumber, { color: formGrade.color }]}>
                        {formScore}%
                    </Text>
                    <Text style={styles.scoreLabel}>Form Score</Text>
                    <Text style={[styles.scoreGrade, { color: formGrade.color }]}>
                        {formGrade.label}
                    </Text>
                    <View style={styles.scoreBarBg}>
                        <View
                            style={[
                                styles.scoreBarFill,
                                { width: `${formScore}%`, backgroundColor: formGrade.color },
                            ]}
                        />
                    </View>
                    <View style={styles.scoreBreakdown}>
                        <Text style={styles.scoreBreakdownText}>
                            <Text style={{ color: '#88B04B', fontWeight: '800' }}>{totalValidReps}</Text>
                            {' good  ·  '}
                            <Text style={{ color: '#C65911', fontWeight: '800' }}>{totalInvalidReps}</Text>
                            {' bad  ·  '}
                            <Text style={{ fontWeight: '800' }}>{totalReps}</Text>
                            {' total'}
                        </Text>
                    </View>
                </View>

                {/* ── Quick Stats Row ─── */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statIcon}>⏱</Text>
                        <Text style={styles.statValue}>{durationStr}</Text>
                        <Text style={styles.statLabel}>Duration</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statIcon}>🔄</Text>
                        <Text style={styles.statValue}>{setData.length}</Text>
                        <Text style={styles.statLabel}>Sets Done</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statIcon}>⚡</Text>
                        <Text style={styles.statValue}>
                            {totalReps > 0 && workoutDuration > 0
                                ? (totalReps / (workoutDuration / 60)).toFixed(1)
                                : '--'}
                        </Text>
                        <Text style={styles.statLabel}>Reps/Min</Text>
                    </View>
                </View>

                {/* ── Per-Set Breakdown ─── */}
                <Text style={styles.sectionTitle}>Set Breakdown</Text>
                {setData.map((set, index) => {
                    const setTotal = set.validReps + set.invalidReps;
                    const setPercent = setTotal > 0 ? (set.validReps / setTotal) * 100 : 0;
                    const setComplete = set.validReps >= repsPerSet;
                    return (
                        <View key={index} style={styles.setCard}>
                            <View style={styles.setHeader}>
                                <View style={styles.setLabelRow}>
                                    <Text style={styles.setLabel}>Set {index + 1}</Text>
                                    {setComplete && <Text style={styles.setCheck}> ✓</Text>}
                                </View>
                                <Text style={styles.setReps}>
                                    <Text style={{ color: '#88B04B', fontWeight: '800' }}>
                                        {set.validReps}
                                    </Text>
                                    {set.invalidReps > 0 && (
                                        <Text style={{ color: '#C65911', fontWeight: '600' }}>
                                            {' '}+ {set.invalidReps} bad
                                        </Text>
                                    )}
                                    <Text style={{ color: '#bbb' }}> / {repsPerSet}</Text>
                                </Text>
                            </View>
                            <View style={styles.setBarBg}>
                                <View
                                    style={[
                                        styles.setBarValid,
                                        {
                                            width: `${Math.min(
                                                (set.validReps / repsPerSet) * 100,
                                                100,
                                            )}%`,
                                        },
                                    ]}
                                />
                                {set.invalidReps > 0 && (
                                    <View
                                        style={[
                                            styles.setBarInvalid,
                                            {
                                                width: `${Math.min(
                                                    (set.invalidReps / repsPerSet) * 100,
                                                    100 - (set.validReps / repsPerSet) * 100,
                                                )}%`,
                                            },
                                        ]}
                                    />
                                )}
                            </View>
                            <Text style={styles.setScoreText}>
                                {Math.round(setPercent)}% form accuracy
                            </Text>
                        </View>
                    );
                })}

                {/* ── Angle Metrics ─── */}
                <Text style={styles.sectionTitle}>Joint Angles</Text>

                {/* Knee Angle Card */}
                <View style={styles.angleCard}>
                    <View style={styles.angleHeader}>
                        <View style={[styles.angleIcon, { backgroundColor: '#E3EFF9' }]}>
                            <Text style={styles.angleIconText}>🦵</Text>
                        </View>
                        <View style={styles.angleInfo}>
                            <Text style={styles.angleLabel}>Knee Angle</Text>
                            <Text
                                style={[
                                    styles.angleAssessment,
                                    { color: kneeAssessment.color },
                                ]}
                            >
                                {kneeAssessment.text}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.angleMetrics}>
                        <View style={styles.angleMetricItem}>
                            <Text style={[styles.angleMetricValue, { color: '#88B04B' }]}>
                                {kneeMin || '--'}°
                            </Text>
                            <Text style={styles.angleMetricLabel}>Min</Text>
                        </View>
                        <View style={styles.angleDivider} />
                        <View style={styles.angleMetricItem}>
                            <Text style={[styles.angleMetricValue, { color: '#41719C' }]}>
                                {kneeAvg || '--'}°
                            </Text>
                            <Text style={styles.angleMetricLabel}>Avg</Text>
                        </View>
                        <View style={styles.angleDivider} />
                        <View style={styles.angleMetricItem}>
                            <Text style={styles.angleMetricValue}>{kneeMax || '--'}°</Text>
                            <Text style={styles.angleMetricLabel}>Max</Text>
                        </View>
                    </View>
                    {kneeMin > 0 && (
                        <View style={styles.angleRangeBar}>
                            <View style={styles.angleRangeTrack}>
                                <View
                                    style={[
                                        styles.angleRangeFill,
                                        {
                                            left: `${Math.max((kneeMin / 180) * 100, 0)}%`,
                                            right: `${Math.max(100 - (kneeMax / 180) * 100, 0)}%`,
                                            backgroundColor: '#41719C',
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.angleRangeLabels}>
                                <Text style={styles.angleRangeLabelText}>0°</Text>
                                <Text style={styles.angleRangeLabelText}>90°</Text>
                                <Text style={styles.angleRangeLabelText}>180°</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Hip / Back Angle Card */}
                <View style={styles.angleCard}>
                    <View style={styles.angleHeader}>
                        <View style={[styles.angleIcon, { backgroundColor: '#F0E6F6' }]}>
                            <Text style={styles.angleIconText}>🔄</Text>
                        </View>
                        <View style={styles.angleInfo}>
                            <Text style={styles.angleLabel}>Back Angle</Text>
                            <Text
                                style={[
                                    styles.angleAssessment,
                                    { color: hipAssessment.color },
                                ]}
                            >
                                {hipAssessment.text}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.angleMetrics}>
                        <View style={styles.angleMetricItem}>
                            <Text style={[styles.angleMetricValue, { color: '#88B04B' }]}>
                                {hipMin || '--'}°
                            </Text>
                            <Text style={styles.angleMetricLabel}>Min</Text>
                        </View>
                        <View style={styles.angleDivider} />
                        <View style={styles.angleMetricItem}>
                            <Text style={[styles.angleMetricValue, { color: '#7030A0' }]}>
                                {hipAvg || '--'}°
                            </Text>
                            <Text style={styles.angleMetricLabel}>Avg</Text>
                        </View>
                        <View style={styles.angleDivider} />
                        <View style={styles.angleMetricItem}>
                            <Text style={styles.angleMetricValue}>{hipMax || '--'}°</Text>
                            <Text style={styles.angleMetricLabel}>Max</Text>
                        </View>
                    </View>
                    {hipMin > 0 && (
                        <View style={styles.angleRangeBar}>
                            <View style={styles.angleRangeTrack}>
                                <View
                                    style={[
                                        styles.angleRangeFill,
                                        {
                                            left: `${Math.max((hipMin / 180) * 100, 0)}%`,
                                            right: `${Math.max(100 - (hipMax / 180) * 100, 0)}%`,
                                            backgroundColor: '#7030A0',
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.angleRangeLabels}>
                                <Text style={styles.angleRangeLabelText}>0°</Text>
                                <Text style={styles.angleRangeLabelText}>90°</Text>
                                <Text style={styles.angleRangeLabelText}>180°</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* ── Tips & Recommendations ─── */}
                <Text style={styles.sectionTitle}>Tips & Recommendations</Text>
                <View style={styles.tipsCard}>
                    {formScore >= 80 ? (
                        <View style={styles.tipRow}>
                            <Text style={styles.tipIcon}>🌟</Text>
                            <Text style={styles.tipText}>
                                Great workout! Your form consistency is strong. Keep
                                maintaining this quality as you increase weight or volume.
                            </Text>
                        </View>
                    ) : formScore >= 50 ? (
                        <View style={styles.tipRow}>
                            <Text style={styles.tipIcon}>💡</Text>
                            <Text style={styles.tipText}>
                                Good effort! Focus on controlled movements and maintaining
                                proper depth throughout each set. Quality over speed.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.tipRow}>
                            <Text style={styles.tipIcon}>🎯</Text>
                            <Text style={styles.tipText}>
                                Focus on form fundamentals: keep your chest up, push knees
                                out over toes, and aim for parallel depth on each rep.
                            </Text>
                        </View>
                    )}

                    {kneeMin > 90 && kneeMin !== 0 && (
                        <View style={[styles.tipRow, { marginTop: 14 }]}>
                            <Text style={styles.tipIcon}>📏</Text>
                            <Text style={styles.tipText}>
                                Try to break parallel — aim for knee angles below 90° at the
                                bottom of your squat for full range of motion.
                            </Text>
                        </View>
                    )}

                    {totalInvalidReps > totalValidReps && totalReps > 0 && (
                        <View style={[styles.tipRow, { marginTop: 14 }]}>
                            <Text style={styles.tipIcon}>🔄</Text>
                            <Text style={styles.tipText}>
                                Consider reducing weight or reps to prioritize proper form.
                                Building the right movement pattern is key.
                            </Text>
                        </View>
                    )}

                    {setData.length > 1 && (
                        <View style={[styles.tipRow, { marginTop: 14 }]}>
                            <Text style={styles.tipIcon}>📈</Text>
                            <Text style={styles.tipText}>
                                {setData[setData.length - 1].invalidReps >
                                setData[0].invalidReps
                                    ? 'Your form declined in later sets — consider shorter rest periods or fewer sets next time.'
                                    : 'Your form stayed consistent across sets — great endurance and control!'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Bottom Button ─── */}
                <TouchableOpacity
                    style={styles.homeButton}
                    onPress={() => router.replace('/')}
                    activeOpacity={0.85}
                >
                    <Text style={styles.homeButtonText}>Back to Home</Text>
                </TouchableOpacity>

                <View style={{ height: 24 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────
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
        paddingBottom: 40,
        alignItems: 'center',
    },

    /* ── Header ─── */
    headerEmoji: {
        fontSize: 48,
        marginBottom: 4,
        marginTop: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#333',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 15,
        color: '#999',
        fontWeight: '500',
        marginBottom: 24,
    },

    /* ── Form Score Card ─── */
    scoreCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 4,
    },
    scoreBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    scoreBadgeEmoji: {
        fontSize: 32,
    },
    scoreNumber: {
        fontSize: 52,
        fontWeight: '900',
        letterSpacing: -1,
    },
    scoreLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#999',
        marginTop: 2,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    scoreGrade: {
        fontSize: 20,
        fontWeight: '800',
        marginTop: 6,
        marginBottom: 16,
    },
    scoreBarBg: {
        height: 8,
        backgroundColor: '#ECECEC',
        borderRadius: 4,
        overflow: 'hidden',
        width: '100%',
        marginBottom: 14,
    },
    scoreBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    scoreBreakdown: {
        alignItems: 'center',
    },
    scoreBreakdownText: {
        fontSize: 14,
        color: '#777',
        fontWeight: '500',
    },

    /* ── Quick Stats Row ─── */
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
        marginBottom: 24,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    statIcon: {
        fontSize: 22,
        marginBottom: 6,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#333',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#AAA',
        marginTop: 4,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },

    /* ── Section Title ─── */
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#444',
        alignSelf: 'flex-start',
        marginBottom: 12,
        marginTop: 4,
    },

    /* ── Set Cards ─── */
    setCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 18,
        width: '100%',
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    setHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    setLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    setLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#444',
    },
    setCheck: {
        fontSize: 14,
        color: '#88B04B',
        fontWeight: '700',
    },
    setReps: {
        fontSize: 14,
        fontWeight: '600',
    },
    setBarBg: {
        height: 8,
        backgroundColor: '#F0F0F0',
        borderRadius: 4,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    setBarValid: {
        height: '100%',
        backgroundColor: '#88B04B',
        borderRadius: 4,
    },
    setBarInvalid: {
        height: '100%',
        backgroundColor: '#ED7D31',
    },
    setScoreText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#BBB',
        marginTop: 8,
    },

    /* ── Angle Cards ─── */
    angleCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    angleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    angleIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    angleIconText: {
        fontSize: 24,
    },
    angleInfo: {
        flex: 1,
    },
    angleLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: '#444',
        marginBottom: 3,
    },
    angleAssessment: {
        fontSize: 13,
        fontWeight: '600',
    },
    angleMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
        borderRadius: 14,
        paddingVertical: 14,
    },
    angleMetricItem: {
        alignItems: 'center',
        flex: 1,
    },
    angleMetricValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#555',
    },
    angleMetricLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#AAA',
        marginTop: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    angleDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#EAEAEA',
    },
    angleRangeBar: {
        marginTop: 14,
    },
    angleRangeTrack: {
        height: 6,
        backgroundColor: '#ECECEC',
        borderRadius: 3,
        overflow: 'hidden',
    },
    angleRangeFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        borderRadius: 3,
    },
    angleRangeLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    angleRangeLabelText: {
        fontSize: 10,
        color: '#CCC',
        fontWeight: '600',
    },

    /* ── Tips Card ─── */
    tipsCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 22,
        width: '100%',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    tipIcon: {
        fontSize: 20,
        marginRight: 12,
        marginTop: 1,
    },
    tipText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: '#555',
        lineHeight: 21,
    },

    /* ── Home Button ─── */
    homeButton: {
        backgroundColor: '#88B04B',
        paddingVertical: 18,
        borderRadius: 22,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#88B04B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    homeButtonText: {
        fontSize: 19,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.3,
    },
});
