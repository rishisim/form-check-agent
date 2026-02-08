import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { DepthLine } from '../components/DepthLine';
import { RepCounter } from '../components/RepCounter';
import { FeedbackToast } from '../components/FeedbackToast';
import { useTTS } from '../hooks/useTTS';

// ─── Configuration ───────────────────────────────────────
const SERVER_BASE = 'ws://10.194.82.50:8000/ws/video';

export default function FormCheckScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ sets: string; reps: string; timerSeconds: string; exercise?: string }>();

    const totalSets = parseInt(params.sets || '3', 10);
    const repsPerSet = parseInt(params.reps || '10', 10);
    const initialTimer = parseInt(params.timerSeconds || '10', 10);
    const exercise = (params.exercise || 'squat').toLowerCase();
    const isPushup = exercise === 'pushup';

    const SERVER_URL = `${SERVER_BASE}?exercise=${exercise}`;
    const SERVER_HTTP_URL = SERVER_BASE.replace('ws://', 'http://').replace(/\/ws\/video.*$/, '');

    // ─── Camera / Connection ─────────────────────
    const [permission, requestPermission] = useCameraPermissions();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
    const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

    // ─── Workout Tracking ────────────────────────
    const [currentSet, setCurrentSet] = useState(1);
    const [isWorkoutComplete, setIsWorkoutComplete] = useState(false);
    const [isSetTransition, setIsSetTransition] = useState(false);

    // ─── Countdown Timer ─────────────────────────
    const [countdown, setCountdown] = useState(initialTimer);
    const [isCountdownActive, setIsCountdownActive] = useState(initialTimer > 0);

    // ─── Analysis State ──────────────────────────
    const [validReps, setValidReps] = useState(0);
    const [invalidReps, setInvalidReps] = useState(0);
    const [feedback, setFeedback] = useState('Position yourself in frame');
    const [feedbackLevel, setFeedbackLevel] = useState<'success' | 'warning' | 'error'>('success');

    // ─── Pro-Mode Data ───────────────────────────
    const [kneeAngle, setKneeAngle] = useState<number | null>(null);
    const [hipAngle, setHipAngle] = useState<number | null>(null);
    const [sideDetected, setSideDetected] = useState<'left' | 'right' | null>(null);
    const [landmarks, setLandmarks] = useState<number[][]>([]);
    const [hipTrajectory, setHipTrajectory] = useState<number[][]>([]);

    // ─── Depth Data ──────────────────────────────
    const [targetDepthY, setTargetDepthY] = useState(0);
    const [currentDepthY, setCurrentDepthY] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // ─── Refs ────────────────────────────────────
    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isStreamingRef = useRef(false);
    const isCapturingRef = useRef(false);
    const cameraReadyRef = useRef(false);
    const isResetPendingRef = useRef(false);
    const currentSessionIdRef = useRef<string | null>(null);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastFrameSeqRef = useRef(0);
    const intentionalDisconnectRef = useRef(false);
    const lastUpdateRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectDelayRef = useRef(1000);
    const lastFeedbackRef = useRef('');

    // ─── Workout Stats Tracking ─────────
    const workoutStartRef = useRef<number>(0);
    const setDataRef = useRef<Array<{ validReps: number; invalidReps: number }>>([]);
    const kneeAngleStatsRef = useRef({ min: Infinity, max: -Infinity, sum: 0, count: 0 });
    const hipAngleStatsRef = useRef({ min: Infinity, max: -Infinity, sum: 0, count: 0 });
    const feedbackLogRef = useRef<Array<{ msg: string; level: string; ts: number }>>([]);

    // Workout refs (avoid stale closures)
    const currentSetRef = useRef(1);
    const isSetTransitionRef = useRef(false);
    const isWorkoutCompleteRef = useRef(false);

    // ─── Text-to-Speech ──────────────────────
    const { speak: speakTTS, stop: stopTTS } = useTTS({
        serverUrl: SERVER_HTTP_URL,
        enabled: true,
    });

    // ─── Countdown Timer ─────────────────────────
    useEffect(() => {
        if (!isCountdownActive) return;
        if (countdown <= 0) {
            setIsCountdownActive(false);
            const goMsg = isPushup ? 'Go! Start your pushups!' : 'Go! Start your squats!';
            setFeedback(goMsg);
            setFeedbackLevel('success');
            speakTTS(goMsg);
            return;
        }
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, isCountdownActive, isPushup]);

    // ─── Set Completion Detection ────────────────
    useEffect(() => {
        if (isSetTransitionRef.current || isWorkoutCompleteRef.current) return;
        if (validReps > 0 && validReps >= repsPerSet) {
            // Record set data for post-workout analysis
            setDataRef.current.push({ validReps, invalidReps });

            if (currentSetRef.current >= totalSets) {
                // All sets done → Workout complete
                isWorkoutCompleteRef.current = true;
                setIsWorkoutComplete(true);
                setFeedback('🏆 Workout Complete!');
                setFeedbackLevel('success');
                speakTTS('Workout Complete! Great job!');
                // Stop streaming
                isStreamingRef.current = false;
                if (frameIntervalRef.current) {
                    clearTimeout(frameIntervalRef.current);
                    frameIntervalRef.current = null;
                }
            } else {
                // Set complete → transition
                isSetTransitionRef.current = true;
                setIsSetTransition(true);
                setFeedback(`✅ Set ${currentSetRef.current} Complete!`);
                setFeedbackLevel('success');
                speakTTS(`Set ${currentSetRef.current} complete! Rest up.`);

                setTimeout(() => {
                    currentSetRef.current += 1;
                    setCurrentSet(currentSetRef.current);
                    resetReps();
                    isSetTransitionRef.current = false;
                    setIsSetTransition(false);
                }, 3000);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [validReps]);

    // ─── WebSocket ───────────────────────────────
    const connectWebSocket = useCallback(() => {
        if (wsRef.current) {
            const state = wsRef.current.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
        }

        setConnectionStatus('connecting');
        console.log('Connecting to', SERVER_URL);
        const ws = new WebSocket(SERVER_URL);

        ws.onopen = () => {
            setIsConnected(true);
            setConnectionStatus('connected');
            setCurrentSessionId(null);
            currentSessionIdRef.current = null;
            reconnectDelayRef.current = 1000; // reset backoff on success
            console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const now = Date.now();

                // Respond to server keepalive pings
                if (data.type === 'ping') {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                    return;
                }

                // Reset confirmation
                if (data.type === 'reset_confirmation') {
                    isResetPendingRef.current = false;
                    currentSessionIdRef.current = data.new_session_id;
                    setCurrentSessionId(data.new_session_id);
                    if (resetTimeoutRef.current) {
                        clearTimeout(resetTimeoutRef.current);
                        resetTimeoutRef.current = null;
                    }
                    setValidReps(0);
                    setInvalidReps(0);
                    lastFrameSeqRef.current = data.frame_seq ?? 0;
                    lastUpdateRef.current = 0;
                    return;
                }

                // Drop messages while awaiting reset
                if (isResetPendingRef.current && data.type === 'analysis') return;

                if (data.type === 'analysis' && data.feedback) {
                    const activeSessionId = currentSessionIdRef.current;
                    if (activeSessionId && data.feedback.session_id && data.feedback.session_id !== activeSessionId) return;

                    const incomingSeq = data.feedback.frame_seq ?? 0;
                    if (incomingSeq > 0 && incomingSeq <= lastFrameSeqRef.current) return;

                    if (!activeSessionId && data.feedback.session_id) {
                        currentSessionIdRef.current = data.feedback.session_id;
                        setCurrentSessionId(data.feedback.session_id);
                    }

                    // Unthrottled: landmarks for smooth skeleton
                    setLandmarks(data.feedback.landmarks || []);
                    const analysis = data.feedback.analysis;
                    if (analysis) {
                        setHipTrajectory(analysis.hip_trajectory || []);

                        // Feedback text + TTS: only update when text actually changes
                        if (!isSetTransitionRef.current && !isWorkoutCompleteRef.current) {
                            const newFeedback = analysis.feedback;
                            if (newFeedback && newFeedback !== lastFeedbackRef.current) {
                                lastFeedbackRef.current = newFeedback;
                                setFeedback(newFeedback);
                                const lvl = analysis.feedback_level || 'success';
                                setFeedbackLevel(lvl);
                                speakTTS(newFeedback);
                                // Log for post-workout AI analysis
                                feedbackLogRef.current.push({
                                    msg: newFeedback,
                                    level: lvl,
                                    ts: Math.round((Date.now() - (workoutStartRef.current || Date.now())) / 1000),
                                });
                            }
                        }
                    }

                    // Throttled (~30 fps) for numeric / angle displays
                    if (now - lastUpdateRef.current > 33) {
                        if (analysis) {
                            setValidReps(analysis.valid_reps ?? 0);
                            setInvalidReps(analysis.invalid_reps ?? 0);
                            setKneeAngle(analysis.knee_angle);
                            setHipAngle(analysis.hip_angle);
                            setSideDetected(analysis.side_detected);

                            // Track angle stats for post-workout analysis
                            if (analysis.knee_angle != null) {
                                const ks = kneeAngleStatsRef.current;
                                ks.min = Math.min(ks.min, analysis.knee_angle);
                                ks.max = Math.max(ks.max, analysis.knee_angle);
                                ks.sum += analysis.knee_angle;
                                ks.count++;
                            }
                            if (analysis.hip_angle != null) {
                                const hs = hipAngleStatsRef.current;
                                hs.min = Math.min(hs.min, analysis.hip_angle);
                                hs.max = Math.max(hs.max, analysis.hip_angle);
                                hs.sum += analysis.hip_angle;
                                hs.count++;
                            }

                            setTargetDepthY(analysis.target_depth_y || 0);
                            setCurrentDepthY(analysis.current_depth_y || 0);
                        }
                        lastUpdateRef.current = now;
                    }
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        ws.onerror = (e) => {
            // Suppress the default console error to avoid red screen
            if (e && typeof e === 'object' && 'preventDefault' in e) {
                (e as any).preventDefault?.();
            }
            console.log('WebSocket connection failed — is the backend running?');
            setConnectionStatus('error');
        };

        ws.onclose = () => {
            wsRef.current = null;
            setIsConnected(false);
            setConnectionStatus('disconnected');
            console.log('WebSocket closed');

            if (!intentionalDisconnectRef.current) {
                // Exponential backoff: 1s → 2s → 4s → max 10s
                const delay = reconnectDelayRef.current;
                reconnectDelayRef.current = Math.min(delay * 2, 10000);
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
            }
            if (frameIntervalRef.current) {
                clearTimeout(frameIntervalRef.current);
                frameIntervalRef.current = null;
            }
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
                resetTimeoutRef.current = null;
            }
            isStreamingRef.current = false;
            isResetPendingRef.current = false;
            currentSessionIdRef.current = null;
        };

        wsRef.current = ws;
    }, []);

    // ─── Disconnect ──────────────────────────────
    const disconnectWebSocket = useCallback(() => {
        intentionalDisconnectRef.current = true;
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (frameIntervalRef.current) {
            clearTimeout(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        isStreamingRef.current = false;
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // ─── Reset Reps ──────────────────────────────
    const resetReps = useCallback(() => {
        isResetPendingRef.current = true;

        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }

        resetTimeoutRef.current = setTimeout(() => {
            if (isResetPendingRef.current) {
                isResetPendingRef.current = false;
                currentSessionIdRef.current = `client_reset_${Date.now()}`;
                setCurrentSessionId(null);
            }
        }, 3000);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'reset_reps' }));
        } else {
            isResetPendingRef.current = false;
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
                resetTimeoutRef.current = null;
            }
        }

        setValidReps(0);
        setInvalidReps(0);
        setFeedback('Next set — get ready!');
        setFeedbackLevel('success');
        lastUpdateRef.current = 0;
        lastFrameSeqRef.current = Number.MAX_SAFE_INTEGER;
    }, []);

    // ─── Camera Ready ────────────────────────────
    const onCameraReady = useCallback(async () => {
        cameraReadyRef.current = true;
        try {
            const sizes = await cameraRef.current?.getAvailablePictureSizesAsync();
            if (sizes && sizes.length) {
                const smallest = [...sizes].sort((a, b) => {
                    const [aw, ah] = a.split('x').map(Number);
                    const [bw, bh] = b.split('x').map(Number);
                    return aw * ah - bw * bh;
                })[0];
                setPictureSize(smallest);
            }
        } catch {
            // ignore
        }
    }, []);

    // ─── Start Streaming Frames ──────────────────
    const startStreaming = useCallback(async () => {
        if (isStreamingRef.current) return;
        isStreamingRef.current = true;

        // Back-to-back captures: fire the next one as soon as the previous
        // finishes. The camera hardware is the natural throttle (~5-8 fps).
        // The server drops stale frames anyway, so flooding is fine.
        const captureLoop = async () => {
            if (!isStreamingRef.current) return;

            try {
                if (
                    cameraRef.current &&
                    wsRef.current?.readyState === WebSocket.OPEN &&
                    !isCapturingRef.current
                ) {
                    isCapturingRef.current = true;
                    const photo = await cameraRef.current.takePictureAsync({
                        base64: true,
                        quality: 0.1,
                        skipProcessing: true,
                        shutterSound: false,
                    });

                    if (photo?.base64 && wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'frame', frame: photo.base64 }));
                    }
                }
            } catch {
                // Silently fail
            } finally {
                isCapturingRef.current = false;
                // No delay — immediately start the next capture
                frameIntervalRef.current = setTimeout(captureLoop, 0);
            }
        };

        captureLoop();
    }, []);

    // ─── Lifecycle ───────────────────────────────
    useEffect(() => {
        connectWebSocket();
        return () => {
            disconnectWebSocket();
            stopTTS();
        };
    }, [connectWebSocket, disconnectWebSocket, stopTTS]);

    // Only start streaming after countdown finishes
    useEffect(() => {
        if (isConnected && permission?.granted && !isCountdownActive && !isWorkoutCompleteRef.current) {
            if (!workoutStartRef.current) workoutStartRef.current = Date.now();
            startStreaming();
        }
    }, [isConnected, permission, startStreaming, isCountdownActive]);

    // ─── Progress Calculation ────────────────────
    const totalRepsGoal = totalSets * repsPerSet;
    const completedReps = (currentSet - 1) * repsPerSet + Math.min(validReps, repsPerSet);
    const progressPercent = Math.min((completedReps / totalRepsGoal) * 100, 100);

    // ─── Navigate to Analysis ────────────────────
    const handleShowAnalysis = useCallback(() => {
        const workoutDuration = Math.round((Date.now() - workoutStartRef.current) / 1000);
        const ks = kneeAngleStatsRef.current;
        const hs = hipAngleStatsRef.current;

        router.push({
            pathname: '/analysis',
            params: {
                exercise: exercise,
                totalSets: totalSets.toString(),
                repsPerSet: repsPerSet.toString(),
                setData: JSON.stringify(setDataRef.current),
                workoutDuration: workoutDuration.toString(),
                kneeMin: ks.count ? Math.round(ks.min).toString() : '0',
                kneeMax: ks.count ? Math.round(ks.max).toString() : '0',
                kneeAvg: ks.count ? Math.round(ks.sum / ks.count).toString() : '0',
                hipMin: hs.count ? Math.round(hs.min).toString() : '0',
                hipMax: hs.count ? Math.round(hs.max).toString() : '0',
                hipAvg: hs.count ? Math.round(hs.sum / hs.count).toString() : '0',
                feedbackLog: JSON.stringify(feedbackLogRef.current),
                serverUrl: SERVER_HTTP_URL,
            },
        });
    }, [router, totalSets, repsPerSet]);

    // ─── Permission Screens ──────────────────────
    if (!permission) {
        return (
            <View style={styles.container}>
                <Text style={styles.loadingText}>Loading…</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.permissionContainer}>
                <TouchableOpacity style={styles.permBackButton} onPress={() => router.back()}>
                    <Text style={styles.permBackArrow}>‹</Text>
                    <Text style={styles.permBackLabel}>Back</Text>
                </TouchableOpacity>
                <View style={styles.permContent}>
                    <Text style={styles.permEmoji}>📷</Text>
                    <Text style={styles.permTitle}>Camera Access Needed</Text>
                    <Text style={styles.permSubtitle}>
                        We need your camera to analyze your form in real-time
                    </Text>
                    <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
                        <Text style={styles.permButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ─── Main Render ─────────────────────────────
    const showAnalysis = !isCountdownActive && !isWorkoutComplete;

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                animateShutter={false}
                pictureSize={pictureSize}
                onCameraReady={onCameraReady}
            />

            <View pointerEvents="box-none" style={styles.overlay}>
                {/* Depth & Skeleton — only during active analysis */}
                {showAnalysis && (
                    <>
                        <DepthLine
                            targetDepthY={targetDepthY}
                            currentDepthY={currentDepthY}
                            isValid={!!targetDepthY}
                            label={isPushup ? 'CHEST' : 'HIPS'}
                        />
                        <SkeletonOverlay
                            landmarks={landmarks}
                            hipTrajectory={hipTrajectory}
                            mirrored={true}
                        />
                    </>
                )}

                <SafeAreaView style={styles.safeOverlay} pointerEvents="box-none">
                    {/* ─── TOP SECTION ─── */}
                    <View>
                        {/* Back + Progress Bar Row */}
                        <View style={styles.topRow}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => router.back()}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.backArrow}>‹</Text>
                            </TouchableOpacity>

                            <View style={styles.progressPill}>
                                <Text style={styles.progressLabel}>
                                    Set {currentSet}/{totalSets}  ·  Rep {Math.min(validReps, repsPerSet)}/{repsPerSet}
                                </Text>
                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${progressPercent}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* HUD Metrics Bar — only during analysis */}
                        {showAnalysis && (
                            <View style={styles.hudBar}>
                                {/* Status & Side */}
                                <TouchableOpacity
                                    style={[
                                        styles.hudItem,
                                        { backgroundColor: isConnected ? '#E2F0D9' : '#FCE4D6' },
                                    ]}
                                    onPress={connectWebSocket}
                                >
                                    <View
                                        style={[
                                            styles.statusDot,
                                            { backgroundColor: isConnected ? '#88B04B' : '#C65911' },
                                        ]}
                                    />
                                    <Text style={styles.hudLabel}>SIDE</Text>
                                    <Text style={[styles.hudValue, { fontSize: 20 }]}>
                                        {sideDetected === 'left' ? '←' : sideDetected === 'right' ? '→' : '?'}
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.hudDivider} />

                                {/* Angle Metrics */}
                                <View style={styles.metricsGroup}>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.hudLabel}>{isPushup ? 'ELBOW' : 'KNEE'}</Text>
                                        <Text style={[styles.hudValue, { color: '#41719C' }]}>
                                            {kneeAngle !== null ? `${kneeAngle}°` : '--'}
                                        </Text>
                                    </View>
                                    <View style={styles.metricItem}>
                                        <Text style={styles.hudLabel}>{isPushup ? 'BODY' : 'BACK'}</Text>
                                        <Text style={[styles.hudValue, { color: '#7030A0' }]}>
                                            {hipAngle !== null ? `${hipAngle}°` : '--'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.hudDivider} />

                                {/* Rep Counter */}
                                <TouchableOpacity
                                    onPress={resetReps}
                                    activeOpacity={0.7}
                                    style={styles.repControl}
                                >
                                    <RepCounter
                                        validCount={Math.min(validReps, repsPerSet)}
                                        invalidCount={invalidReps}
                                        transparent
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ─── CENTER SECTION ─── */}
                    <View style={styles.centerSection}>
                        {/* Countdown Overlay */}
                        {isCountdownActive && (
                            <View style={styles.centerCard}>
                                <Text style={styles.countdownLabel}>Get Ready!</Text>
                                <Text style={styles.countdownNumber}>{countdown}</Text>
                                <Text style={styles.countdownHint}>
                                    {totalSets} × {repsPerSet} {isPushup ? 'Push-ups' : 'Squats'}
                                </Text>
                            </View>
                        )}

                        {/* Set Transition Overlay */}
                        {isSetTransition && !isWorkoutComplete && (
                            <View style={styles.centerCard}>
                                <Text style={styles.transitionEmoji}>✅</Text>
                                <Text style={styles.transitionTitle}>
                                    Set {currentSet} Complete!
                                </Text>
                                <Text style={styles.transitionHint}>
                                    Next set starting soon…
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ─── BOTTOM: Feedback Toast ─── */}
                    {showAnalysis && (
                        <FeedbackToast message={feedback} level={feedbackLevel} />
                    )}
                </SafeAreaView>

                {/* ─── WORKOUT COMPLETE (Full-screen overlay) ─── */}
                {isWorkoutComplete && (
                    <View style={styles.completeOverlay}>
                        <Text style={styles.completeEmoji}>🏆</Text>
                        <Text style={styles.completeTitle}>Workout Complete!</Text>
                        <Text style={styles.completeStats}>
                            {totalSets} sets × {repsPerSet} reps finished
                        </Text>
                        <View style={styles.completeDivider} />
                        <TouchableOpacity
                            style={styles.completeButton}
                            onPress={handleShowAnalysis}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.completeButtonText}>📊  Show Analysis</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.completeButtonSecondary}
                            onPress={() => router.replace('/')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.completeButtonSecondaryText}>Back to Home</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        width: '100%',
        backgroundColor: '#000',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
        elevation: 2,
    },
    safeOverlay: {
        flex: 1,
        padding: 16,
    },
    loadingText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 'auto',
        marginBottom: 'auto',
    },

    /* ── Top Row ─────────────────────────── */
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backArrow: {
        fontSize: 28,
        fontWeight: '300',
        color: '#444',
        marginTop: -2,
    },

    /* ── Progress Pill ────────────────────── */
    progressPill: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    progressLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#555',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#E8E8E8',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#88B04B',
        borderRadius: 3,
    },

    /* ── HUD Bar ──────────────────────────── */
    hudBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    hudDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#EAEAEA',
        marginHorizontal: 4,
    },
    metricsGroup: {
        flexDirection: 'row',
        flex: 1,
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    metricItem: {
        alignItems: 'center',
        minWidth: 50,
    },
    repControl: {
        paddingRight: 4,
    },
    hudItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 16,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    hudLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#888888',
        marginRight: 4,
        letterSpacing: 0.5,
    },
    hudValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#444444',
    },

    /* ── Center Section ───────────────────── */
    centerSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerCard: {
        alignItems: 'center',
    },

    /* ── Countdown ────────────────────────── */
    countdownLabel: {
        fontSize: 26,
        fontWeight: '700',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
        marginBottom: 4,
    },
    countdownNumber: {
        fontSize: 120,
        fontWeight: '900',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.4)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 14,
    },
    countdownHint: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    /* ── Set Transition ───────────────────── */
    transitionEmoji: {
        fontSize: 72,
        marginBottom: 12,
    },
    transitionTitle: {
        fontSize: 30,
        fontWeight: '800',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    transitionHint: {
        fontSize: 17,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    /* ── Workout Complete Overlay ──────────── */
    completeOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 10,
        padding: 32,
    },
    completeEmoji: {
        fontSize: 80,
        marginBottom: 16,
    },
    completeTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 8,
    },
    completeStats: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.75)',
        marginBottom: 24,
    },
    completeDivider: {
        width: 60,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 28,
    },
    completeButton: {
        backgroundColor: '#88B04B',
        paddingVertical: 16,
        paddingHorizontal: 44,
        borderRadius: 22,
        shadowColor: '#88B04B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
    completeButtonText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.3,
    },
    completeButtonSecondary: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    completeButtonSecondaryText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: 0.3,
    },

    /* ── Permission Screen ────────────────── */
    permissionContainer: {
        flex: 1,
        backgroundColor: '#F7F7F8',
    },
    permBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    permBackArrow: {
        fontSize: 32,
        color: '#555',
        fontWeight: '300',
        lineHeight: 34,
    },
    permBackLabel: {
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
        marginLeft: 4,
    },
    permContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    permEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    permTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#333',
        marginBottom: 8,
    },
    permSubtitle: {
        fontSize: 15,
        color: '#888',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 22,
    },
    permButton: {
        backgroundColor: '#88B04B',
        paddingVertical: 14,
        paddingHorizontal: 36,
        borderRadius: 18,
        shadowColor: '#88B04B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    permButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
