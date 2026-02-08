import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WaveHeader } from '../components/WaveHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated Exercise Card with ripple effect on press
interface AnimatedExerciseCardProps {
    emoji: string;
    name: string;
    desc: string;
    href: string;
}

function AnimatedExerciseCard({ emoji, name, desc, href }: AnimatedExerciseCardProps) {
    const router = useRouter();
    const rippleScale = useRef(new Animated.Value(0)).current;
    const rippleOpacity = useRef(new Animated.Value(0.4)).current;
    const scaleAnimation = useRef(new Animated.Value(1)).current;
    const [isPressed, setIsPressed] = useState(false);
    const [pressLocation, setPressLocation] = useState({ x: 0, y: 0 });

    const handlePressIn = (event: any) => {
        const { locationX, locationY } = event.nativeEvent;
        setPressLocation({ x: locationX, y: locationY });
    };

    const handlePress = (event: any) => {
        if (isPressed) return;
        setIsPressed(true);

        // Reset ripple values
        rippleScale.setValue(0);
        rippleOpacity.setValue(0.35);

        // Start animations
        Animated.parallel([
            // Ripple expands outward
            Animated.timing(rippleScale, {
                toValue: 1,
                duration: 350,
                useNativeDriver: true,
            }),
            // Ripple fades slightly as it expands
            Animated.timing(rippleOpacity, {
                toValue: 0.15,
                duration: 350,
                useNativeDriver: true,
            }),
            // Subtle scale feedback
            Animated.sequence([
                Animated.timing(scaleAnimation, {
                    toValue: 0.97,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnimation, {
                    toValue: 1,
                    duration: 270,
                    useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            // Navigate after animation completes
            router.push(href as any);

            // Reset animation state after a delay
            setTimeout(() => {
                rippleScale.setValue(0);
                rippleOpacity.setValue(0.4);
                scaleAnimation.setValue(1);
                setIsPressed(false);
            }, 500);
        });
    };

    // Calculate ripple size (should be large enough to cover card)
    const rippleSize = 300;

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPress={handlePress}
            style={styles.gridItem}
        >
            <Animated.View style={[styles.exerciseCard, { transform: [{ scale: scaleAnimation }] }]}>
                {/* Ripple effect */}
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            width: rippleSize,
                            height: rippleSize,
                            borderRadius: rippleSize / 2,
                            left: pressLocation.x - rippleSize / 2,
                            top: pressLocation.y - rippleSize / 2,
                            opacity: rippleOpacity,
                            transform: [{ scale: rippleScale }],
                        },
                    ]}
                />

                {/* Content */}
                <View style={styles.cardContent}>
                    <Text style={styles.exerciseEmoji}>{emoji}</Text>
                    <Text style={styles.exerciseName}>{name}</Text>
                    <Text style={styles.exerciseDesc}>{desc}</Text>
                </View>
            </Animated.View>
        </Pressable>
    );
}

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
    const scrollX = useRef(new Animated.Value(0)).current;

    const onScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false },
    );

    const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActivePageIndex(page);
    }, []);

    const goToPage = (index: number) => {
        horizontalRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        setActivePageIndex(index);
    };

    return (
        <View style={styles.container}>
            <WaveHeader />
            <SafeAreaView style={styles.safeArea}>
                {/* Header – always visible */}
                <View style={styles.header}>
                    <Text style={styles.title}>FormFlow</Text>
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
                <Animated.ScrollView
                    ref={horizontalRef as any}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    onMomentumScrollEnd={onMomentumEnd}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                    overScrollMode="never"
                    bounces={false}
                    style={styles.pager}
                    snapToInterval={SCREEN_WIDTH}
                    snapToAlignment="start"
                    directionalLockEnabled={true}
                    disableIntervalMomentum={true}
                >
                    {/* ─── Page 1: Body Weight Exercises ─── */}
                    <ScrollView
                        style={{ width: SCREEN_WIDTH }}
                        contentContainerStyle={styles.pageContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                    >
                        <View style={styles.grid}>
                            <AnimatedExerciseCard
                                emoji="🦵"
                                name="Squats"
                                desc="Track depth & form"
                                href="/workout-config"
                            />

                            <AnimatedExerciseCard
                                emoji="💪"
                                name="Push-ups"
                                desc="Track form & reps"
                                href="/workout-config?exercise=pushup"
                            />
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
                </Animated.ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F8', // Main background color for the app
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    header: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 16,
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
        overflow: 'hidden',
        position: 'relative',
    },
    ripple: {
        position: 'absolute',
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
    },
    cardContent: {
        alignItems: 'center',
        zIndex: 1,
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
