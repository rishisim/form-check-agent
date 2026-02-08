import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const comingSoonExercises = [
    { emoji: '🧘', name: 'Planks', desc: 'Core stability tracking' },
    { emoji: '⭐', name: 'Jumping Jacks', desc: 'Cardio form analysis' },
    { emoji: '🔥', name: 'Burpees', desc: 'Full-body tracking' },
    { emoji: '🦿', name: 'Lunges', desc: 'Balance & depth check' },
];

const PAGE_TITLES = ['Body Weight Exercises', 'Physical Therapy'];

export default function HomeScreen() {
    const [activePageIndex, setActivePageIndex] = useState(0);
    const horizontalRef = useRef<ScrollView>(null);

    const onHorizontalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        if (page !== activePageIndex) setActivePageIndex(page);
    };

    const goToPage = (index: number) => {
        horizontalRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        setActivePageIndex(index);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header – always visible */}
            <View style={styles.header}>
                <Text style={styles.logo}>🏋️</Text>
                <Text style={styles.title}>Form Check Agent</Text>
                <Text style={styles.subtitle}>AI-Powered Workout Coach</Text>
            </View>

            {/* Page indicator dots + labels */}
            <View style={styles.tabBar}>
                {PAGE_TITLES.map((title, i) => (
                    <Pressable key={title} onPress={() => goToPage(i)} style={styles.tab}>
                        <Text style={[styles.tabText, activePageIndex === i && styles.tabTextActive]}>
                            {title}
                        </Text>
                        {activePageIndex === i && <View style={styles.tabIndicator} />}
                    </Pressable>
                ))}
            </View>

            {/* Horizontal paging scroll */}
            <ScrollView
                ref={horizontalRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onHorizontalScroll}
                style={styles.pager}
            >
                {/* ─── Page 1: Body Weight Exercises ─── */}
                <ScrollView
                    style={{ width: SCREEN_WIDTH }}
                    contentContainerStyle={styles.pageContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.grid}>
                        <Link href="/workout-config" asChild>
                            <Pressable style={styles.gridItem}>
                                <View style={styles.exerciseCard}>
                                    <Text style={styles.exerciseEmoji}>🦵</Text>
                                    <Text style={styles.exerciseName}>Squats</Text>
                                    <Text style={styles.exerciseDesc}>Track depth & form</Text>
                                </View>
                            </Pressable>
                        </Link>

                        <Link href="/workout-config?exercise=pushup" asChild>
                            <Pressable style={styles.gridItem}>
                                <View style={styles.exerciseCard}>
                                    <Text style={styles.exerciseEmoji}>💪</Text>
                                    <Text style={styles.exerciseName}>Push-ups</Text>
                                    <Text style={styles.exerciseDesc}>Track form & reps</Text>
                                </View>
                            </Pressable>
                        </Link>
                    </View>

                    <Text style={styles.sectionTitle}>Coming Soon</Text>

                    <View style={styles.grid}>
                        {comingSoonExercises.map((exercise) => (
                            <View key={exercise.name} style={styles.gridItem}>
                                <View style={[styles.exerciseCard, styles.comingSoonCard]}>
                                    <Text style={styles.exerciseEmoji}>{exercise.emoji}</Text>
                                    <Text style={[styles.exerciseName, styles.comingSoonText]}>
                                        {exercise.name}
                                    </Text>
                                    <Text style={styles.exerciseDesc}>{exercise.desc}</Text>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>Coming Soon</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.footer}>
                        Run the backend first:{'\n'}
                        <Text style={styles.code}>python backend/server.py</Text>
                    </Text>
                </ScrollView>

                {/* ─── Page 2: Physical Therapy ─── */}
                <View style={[styles.ptPage, { width: SCREEN_WIDTH }]}>
                    <Text style={styles.ptEmoji}>🩺</Text>
                    <Text style={styles.ptTitle}>Coming Soon</Text>
                    <Text style={styles.ptDesc}>
                        Guided physical therapy routines with real-time form tracking to support your recovery.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F8',
    },
    header: {
        alignItems: 'center',
        paddingTop: 24,
        paddingBottom: 16,
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
    /* ── Tab bar ── */
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 28,
        marginBottom: 8,
        paddingHorizontal: 24,
    },
    tab: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#bbb',
    },
    tabTextActive: {
        color: '#333',
    },
    tabIndicator: {
        marginTop: 6,
        width: 28,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#88B04B',
    },
    /* ── Pager ── */
    pager: {
        flex: 1,
    },
    pageContent: {
        alignItems: 'center',
        padding: 24,
        paddingBottom: 80,
    },
    /* ── Exercise grid ── */
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 14,
        marginBottom: 32,
        maxWidth: 340,
        width: '100%',
    },
    gridItem: {
        width: '47%',
    },
    exerciseCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
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
        textAlign: 'center',
    },
    exerciseDesc: {
        color: '#999',
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#bbb',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 16,
        alignSelf: 'center',
    },
    comingSoonCard: {
        opacity: 0.55,
        padding: 22,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#ddd',
        backgroundColor: '#FAFAFA',
        shadowOpacity: 0,
        elevation: 0,
    },
    comingSoonText: {
        color: '#aaa',
    },
    badge: {
        marginTop: 8,
        backgroundColor: '#F0F0F0',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#bbb',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footer: {
        color: '#bbb',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
    code: {
        color: '#88B04B',
        fontFamily: 'monospace',
    },
    /* ── Physical Therapy page ── */
    ptPage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    ptEmoji: {
        fontSize: 72,
        marginBottom: 20,
    },
    ptTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#bbb',
        marginBottom: 12,
    },
    ptDesc: {
        fontSize: 15,
        color: '#aaa',
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
});
