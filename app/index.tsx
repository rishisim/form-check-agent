import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    ImageSourcePropType,
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
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme, Theme } from '../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated Exercise Card with ripple effect on press
interface AnimatedExerciseCardProps {
    emoji?: string;
    image?: ImageSourcePropType;
    name: string;
    desc: string;
    href: string;
    theme: Theme;
}

function AnimatedExerciseCard({ emoji, image, name, desc, href, theme }: AnimatedExerciseCardProps) {
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
            <Animated.View style={[
                styles.exerciseCard,
                {
                    backgroundColor: theme.cardBackground,
                    shadowColor: theme.shadow,
                    shadowOpacity: theme.shadowOpacity,
                    transform: [{ scale: scaleAnimation }]
                }
            ]}>
                {/* Ripple effect */}
                <Animated.View
                    style={[
                        styles.ripple,
                        {
                            backgroundColor: theme.ripple,
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
                    {image ? (
                        <Image source={image} style={styles.exerciseImage} resizeMode="contain" />
                    ) : (
                        <Text style={styles.exerciseEmoji}>{emoji}</Text>
                    )}
                    <Text style={[styles.exerciseName, { color: theme.textPrimary }]}>{name}</Text>
                    <Text style={[styles.exerciseDesc, { color: theme.textSecondary }]}>{desc}</Text>
                </View>
            </Animated.View>
        </Pressable>
    );
}

const comingSoonExercises = [
    { emoji: '🧘', image: require('../assets/plank.png'), name: 'Planks', desc: 'Core stability tracking' },
    { emoji: '⭐', image: require('../assets/jumping_jacks.png'), name: 'Jumping Jacks', desc: 'Cardio form analysis' },
];

const PAGE_TITLES = ['Body Weight Exercises', 'Physical Therapy'];

export default function HomeScreen() {
    const { theme, isDark } = useTheme();
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

    const fadeAnim1 = useRef(new Animated.Value(0)).current;
    const fadeAnim2 = useRef(new Animated.Value(0)).current;
    const slideAnim1 = useRef(new Animated.Value(18)).current;
    const slideAnim2 = useRef(new Animated.Value(18)).current;

    useEffect(() => {
        // Staggered fade-in: "Welcome back" first, then "Ready for workout?"
        Animated.sequence([
            Animated.delay(300),
            Animated.parallel([
                Animated.timing(fadeAnim1, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim1, {
                    toValue: 0,
                    duration: 900,
                    useNativeDriver: true,
                }),
            ]),
        ]).start(() => {
            Animated.parallel([
                Animated.timing(fadeAnim2, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim2, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    }, []);

    const goToPage = (index: number) => {
        horizontalRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        setActivePageIndex(index);
    };

    // Dynamic styles based on theme
    const dynamicStyles = useMemo(() => ({
        container: {
            backgroundColor: theme.background,
        },
        title: {
            color: theme.textPrimary,
        },
        subtitle: {
            color: theme.textSecondary,
        },
        tabText: {
            color: theme.textMuted,
        },
        tabTextActive: {
            color: theme.textPrimary,
        },
        tabIndicator: {
            backgroundColor: theme.accent,
        },
        sectionTitle: {
            color: theme.textMuted,
        },
        comingSoonCard: {
            borderColor: theme.border,
            backgroundColor: theme.cardBackgroundHover,
        },
        comingSoonText: {
            color: theme.textSecondary,
        },
        badge: {
            backgroundColor: theme.badgeBackground,
        },
        badgeText: {
            color: theme.textMuted,
        },
        footer: {
            color: theme.textMuted,
        },
        code: {
            color: theme.accent,
        },
        ptTitle: {
            color: theme.textMuted,
        },
        ptDesc: {
            color: theme.textSecondary,
        },
    }), [theme]);

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <WaveHeader isDark={isDark} />
            <SafeAreaView style={styles.safeArea}>
                {/* Header – always visible */}
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <View style={styles.headerSpacer} />
                        <View style={styles.headerCenter}>
                            <Text style={[styles.title, dynamicStyles.title]}>FormFlow</Text>
                            <Text style={[styles.subtitle, dynamicStyles.subtitle]}>AI-Powered Workout Coach</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <ThemeToggle />
                        </View>
                    </View>
                </View>

                {/* Page indicator dots + labels */}
                <View style={styles.tabBar}>
                    {PAGE_TITLES.map((title, i) => (
                        <Pressable key={title} onPress={() => goToPage(i)} style={styles.tab}>
                            <Text style={[
                                styles.tabText,
                                dynamicStyles.tabText,
                                activePageIndex === i && dynamicStyles.tabTextActive
                            ]}>
                                {title}
                            </Text>
                            {activePageIndex === i && (
                                <View style={[styles.tabIndicator, dynamicStyles.tabIndicator]} />
                            )}
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
                        {/* Animated Welcome Message */}
                        <View style={{ alignSelf: 'flex-start', marginBottom: 22, paddingLeft: 8 }}>
                            <Animated.Text style={{
                                opacity: fadeAnim1,
                                transform: [{ translateY: slideAnim1 }],
                                fontSize: 28,
                                fontWeight: '900',
                                color: theme.textPrimary,
                                marginBottom: 4,
                                textAlign: 'left',
                            }}>
                                Welcome back
                            </Animated.Text>
                            <Animated.Text style={{
                                opacity: fadeAnim2,
                                transform: [{ translateY: slideAnim2 }],
                                fontSize: 15,
                                fontWeight: '500',
                                color: theme.textSecondary,
                                textAlign: 'left',
                            }}>
                                Ready for today's workout?
                            </Animated.Text>
                        </View>

                        <View style={styles.grid}>
                            <AnimatedExerciseCard
                                image={require('../assets/squat_icon.png')}
                                name="Squats"
                                desc="Track depth & form"
                                href="/workout-config"
                                theme={theme}
                            />

                            <AnimatedExerciseCard
                                image={require('../assets/pushup.png')}
                                name="Push-ups"
                                desc="Track form & reps"
                                href="/workout-config?exercise=pushup"
                                theme={theme}
                            />
                        </View>

                        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>Coming Soon</Text>

                        <View style={styles.grid}>
                            {comingSoonExercises.map((exercise) => (
                                <View key={exercise.name} style={styles.gridItem}>
                                    <View style={[
                                        styles.exerciseCard,
                                        styles.comingSoonCard,
                                        dynamicStyles.comingSoonCard,
                                        { shadowColor: theme.shadow, shadowOpacity: 0 }
                                    ]}>
                                        {exercise.image ? (
                                            <Image source={exercise.image} style={styles.comingSoonImage} resizeMode="contain" />
                                        ) : (
                                            <Text style={[styles.exerciseEmoji, { opacity: 0.5 }]}>{exercise.emoji}</Text>
                                        )}
                                        <Text style={[
                                            styles.exerciseName,
                                            dynamicStyles.comingSoonText
                                        ]}>
                                            {exercise.name}
                                        </Text>
                                        <Text style={[styles.exerciseDesc, { color: theme.textSecondary }]}>
                                            {exercise.desc}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        <Text style={[styles.footer, dynamicStyles.footer]}>
                            Run the backend first:{'\n'}
                            <Text style={[styles.code, dynamicStyles.code]}>python backend/server.py</Text>
                        </Text>
                    </ScrollView>

                    {/* ─── Page 2: Physical Therapy ─── */}
                    <View style={[styles.ptPage, { width: SCREEN_WIDTH }]}>
                        <Text style={styles.ptEmoji}>🩺</Text>
                        <Text style={[styles.ptTitle, dynamicStyles.ptTitle]}>Coming Soon</Text>
                        <Text style={[styles.ptDesc, dynamicStyles.ptDesc]}>
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
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    header: {
        paddingTop: 24,
        paddingBottom: 24,
        paddingHorizontal: 16,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerSpacer: {
        width: 40,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerRight: {
        width: 40,
        alignItems: 'flex-end',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
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
    },
    tabIndicator: {
        marginTop: 6,
        width: 28,
        height: 3,
        borderRadius: 2,
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
        height: 190,
        paddingHorizontal: 16,
        paddingTop: 28,
        paddingBottom: 16,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden',
        position: 'relative',
    },
    ripple: {
        position: 'absolute',
    },
    cardContent: {
        alignItems: 'center',
        zIndex: 1,
    },
    exerciseEmoji: {
        fontSize: 44,
        marginBottom: 10,
    },
    exerciseImage: {
        width: 80,
        height: 68,
        marginBottom: 10,
    },
    exerciseName: {
        fontSize: 19,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    exerciseDesc: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 16,
        alignSelf: 'center',
    },
    comingSoonCard: {
        height: 180,
        opacity: 0.65,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        elevation: 0,
    },
    comingSoonImage: {
        width: 80,
        height: 64,
        marginBottom: 10,
        opacity: 0.7,
    },
    badge: {
        marginTop: 8,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footer: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
    code: {
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
        marginBottom: 12,
    },
    ptDesc: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
});
