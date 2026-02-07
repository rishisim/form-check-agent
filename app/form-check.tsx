import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { DepthLine } from '../components/DepthLine';
import { RepCounter } from '../components/RepCounter';
import { FeedbackToast } from '../components/FeedbackToast';

// Configuration - Your computer's local IP for physical device testing
// Make sure your phone is on the same WiFi network as your computer
const SERVER_URL = 'ws://10.194.82.50:8000/ws/video';

// For emulator testing, you can use:
// Android emulator: 'ws://10.0.2.2:8000/ws/video'
// iOS simulator: 'ws://localhost:8000/ws/video'

export default function FormCheckScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('disconnected');
    const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

    // UI State
    // Removed isProMode, isAnalyzing, aiFeedback

    // Analysis State
    const [repCount, setRepCount] = useState(0); // keep for backward compatibility or total
    const [validReps, setValidReps] = useState(0);
    const [invalidReps, setInvalidReps] = useState(0);
    const [feedback, setFeedback] = useState('Position yourself in frame');
    const [feedbackLevel, setFeedbackLevel] = useState<'success' | 'warning' | 'error'>('success');

    // Pro Mode Data
    const [kneeAngle, setKneeAngle] = useState<number | null>(null);
    const [hipAngle, setHipAngle] = useState<number | null>(null);
    const [sideDetected, setSideDetected] = useState<'left' | 'right' | null>(null);
    const [landmarks, setLandmarks] = useState<number[][]>([]);
    const [hipTrajectory, setHipTrajectory] = useState<number[][]>([]);

    // Depth Data
    const [targetDepthY, setTargetDepthY] = useState(0);
    const [currentDepthY, setCurrentDepthY] = useState(0);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

    // Connect to backend WebSocket
    const connectWebSocket = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        console.log('Connecting to', SERVER_URL);
        setConnectionStatus('connecting');

        const ws = new WebSocket(SERVER_URL);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setConnectionStatus('connected');
            setFeedback('Ready! Start your squat.');
            setFeedbackLevel('success');
            setCurrentSessionId(null); // Reset session ID for new connection
            currentSessionIdRef.current = null;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const now = Date.now();

                // Handle Reset Confirmation
                if (data.type === 'reset_confirmation') {
                    console.log('Reset confirmed by server, new session:', data.new_session_id);
                    isResetPendingRef.current = false;
                    currentSessionIdRef.current = data.new_session_id;
                    setCurrentSessionId(data.new_session_id);
                    // Clear reset timeout
                    if (resetTimeoutRef.current) {
                        clearTimeout(resetTimeoutRef.current);
                        resetTimeoutRef.current = null;
                    }
                    // Force-zero all state (belt and suspenders)
                    setValidReps(0);
                    setInvalidReps(0);
                    // Reset frame sequence baseline
                    lastFrameSeqRef.current = data.frame_seq ?? 0;
                    // Reset throttle so next analysis update renders immediately
                    lastUpdateRef.current = 0;
                    return;
                }

                // Ignore analysis messages while waiting for reset confirmation
                if (isResetPendingRef.current && data.type === 'analysis') {
                    return;
                }

                // Throttle UI updates to ~12fps (every 80ms)
                if (data.type === 'analysis' && data.feedback) {
                    // Safety check for session ID sync (use ref to avoid stale closure)
                    const activeSessionId = currentSessionIdRef.current;
                    if (activeSessionId && data.feedback.session_id && data.feedback.session_id !== activeSessionId) {
                        // This is a stale message from a previous session — discard it
                        return;
                    }

                    // Drop frames with sequence number at or below our reset baseline
                    const incomingSeq = data.feedback.frame_seq ?? 0;
                    if (incomingSeq > 0 && incomingSeq <= lastFrameSeqRef.current) {
                        return;
                    }

                    // First time we get a session ID, save it
                    if (!activeSessionId && data.feedback.session_id) {
                        currentSessionIdRef.current = data.feedback.session_id;
                        setCurrentSessionId(data.feedback.session_id);
                    }
                    // Always update landmarks immediately (unthrottled) for smooth skeleton
                    setLandmarks(data.feedback.landmarks || []);
                    const analysis = data.feedback.analysis;
                    if (analysis) {
                        setHipTrajectory(analysis.hip_trajectory || []);
                    }

                    // Throttle heavier UI updates (text, angles, reps) to ~15fps
                    if (now - lastUpdateRef.current > 66) {
                        if (analysis) {
                            setValidReps(analysis.valid_reps ?? 0);
                            setInvalidReps(analysis.invalid_reps ?? 0);
                            setKneeAngle(analysis.knee_angle);
                            setHipAngle(analysis.hip_angle);
                            setSideDetected(analysis.side_detected);
                            setFeedback(analysis.feedback);
                            setFeedbackLevel(analysis.feedback_level || 'success');

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

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnectionStatus('error');
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            setIsConnected(false);
            setConnectionStatus('disconnected');
            // Only auto-reconnect if this wasn't an intentional disconnect
            if (!intentionalDisconnectRef.current) {
                setTimeout(connectWebSocket, 3000);
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
            isResetPendingRef.current = false; // Prevent stuck state if disconnect happens during reset
            currentSessionIdRef.current = null;
        };

        wsRef.current = ws;
    }, []);

    // Throttle state updates
    const lastUpdateRef = useRef(0);

    // Disconnect WebSocket
    const disconnectWebSocket = useCallback(() => {
        intentionalDisconnectRef.current = true;
        if (frameIntervalRef.current) {
            clearTimeout(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        isStreamingRef.current = false;
        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    // Reset Reps
    const resetReps = useCallback(() => {
        isResetPendingRef.current = true;

        // Clear any previous reset timeout to prevent race conditions from rapid taps
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }

        // Safety timeout: If server doesn't reply in 3s, unlock and invalidate old session
        resetTimeoutRef.current = setTimeout(() => {
            if (isResetPendingRef.current) {
                console.log('Reset timed out, force unlocking');
                isResetPendingRef.current = false;
                // Use a unique client-side ID so stale server messages won't match
                currentSessionIdRef.current = `client_reset_${Date.now()}`;
                setCurrentSessionId(null);
            }
        }, 3000);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'reset_reps' }));
        } else {
            // If not connected, just unlock immediately
            isResetPendingRef.current = false;
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
                resetTimeoutRef.current = null;
            }
        }

        // Immediately reset client-side counts and throttle timer
        setValidReps(0);
        setInvalidReps(0);
        setFeedback('Counter reset. Start again!');
        setFeedbackLevel('success');
        lastUpdateRef.current = 0;
        lastFrameSeqRef.current = Number.MAX_SAFE_INTEGER; // Block ALL old frames until server confirms
    }, []);

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
        } catch (e) {
            // ignore sizing errors, fallback to default
        }
    }, []);

    // Start streaming frames
    const startStreaming = useCallback(async () => {
        if (isStreamingRef.current) {
            return;
        }
        isStreamingRef.current = true;

        // ~7 frames per second for smoother tracking
        const intervalMs = 150;

        const captureLoop = async () => {
            if (!isStreamingRef.current) {
                return;
            }

            try {
                if (
                    cameraRef.current &&
                    wsRef.current?.readyState === WebSocket.OPEN &&
                    !isCapturingRef.current
                ) {
                    isCapturingRef.current = true;
                    const photo = await cameraRef.current.takePictureAsync({
                        base64: true,
                        quality: 0.1, // Minimal quality — sufficient for pose detection, faster transfer
                        skipProcessing: true,
                        shutterSound: false,
                    });

                    if (photo?.base64) {
                        wsRef.current.send(JSON.stringify({
                            type: 'frame',
                            frame: photo.base64
                        }));
                    }
                }
            } catch (e) {
                // Silently fail on frame capture errors
            } finally {
                isCapturingRef.current = false;
                frameIntervalRef.current = setTimeout(captureLoop, intervalMs);
            }
        };

        captureLoop();
    }, []);

    // Lifecycle
    useEffect(() => {
        connectWebSocket();
        return () => disconnectWebSocket();
    }, [connectWebSocket, disconnectWebSocket]);

    useEffect(() => {
        if (isConnected && permission?.granted) {
            startStreaming();
        }
    }, [isConnected, permission, startStreaming]);

    // Permission handling
    if (!permission) {
        return <View style={styles.container}><Text style={styles.text}>Loading...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Camera permission is required</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ... (camera and previous overlay layers) */}
            <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                animateShutter={false}
                pictureSize={pictureSize}
                onCameraReady={onCameraReady}
            />

            <View pointerEvents="box-none" style={styles.overlay}>
                <DepthLine
                    targetDepthY={targetDepthY}
                    currentDepthY={currentDepthY}
                    isValid={!!targetDepthY}
                />

                <SkeletonOverlay
                    landmarks={landmarks}
                    hipTrajectory={hipTrajectory}
                    mirrored={true}
                />

                <SafeAreaView style={styles.safeOverlay}>
                    {/* Consolidated Seamless HUD Bar */}
                    <View style={styles.hudBar}>
                        {/* 1. Status & Side */}
                        <TouchableOpacity
                            style={[styles.hudItem, { backgroundColor: isConnected ? '#E2F0D9' : '#FCE4D6' }]}
                            onPress={connectWebSocket}
                        >
                            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#88B04B' : '#C65911' }]} />
                            <Text style={styles.hudLabel}>SIDE</Text>
                            <Text style={[styles.hudValue, { fontSize: 16 }]}>
                                {sideDetected === 'left' ? '←' : sideDetected === 'right' ? '→' : '?'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.hudDivider} />

                        {/* 2. Metrics Group */}
                        <View style={styles.metricsGroup}>
                            <View style={styles.metricItem}>
                                <Text style={styles.hudLabel}>KNEE</Text>
                                <Text style={[styles.hudValue, { color: '#41719C' }]}>
                                    {kneeAngle !== null ? `${kneeAngle}°` : '--'}
                                </Text>
                            </View>

                            <View style={styles.metricItem}>
                                <Text style={styles.hudLabel}>BACK</Text>
                                <Text style={[styles.hudValue, { color: '#7030A0' }]}>
                                    {hipAngle !== null ? `${hipAngle}°` : '--'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.hudDivider} />

                        {/* 3. Resettable Reps */}
                        <TouchableOpacity
                            onPress={resetReps}
                            activeOpacity={0.7}
                            style={styles.repControl}
                        >
                            <RepCounter
                                validCount={validReps}
                                invalidCount={invalidReps}
                                transparent
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Feedback Toast */}
                    <FeedbackToast message={feedback} level={feedbackLevel} />
                </SafeAreaView>
            </View>
        </View>
    );
}
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
        justifyContent: 'space-between',
        padding: 20,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    hudBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        marginHorizontal: 10,
        shadowColor: "#000",
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
        minWidth: 45,
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
        fontSize: 8,
        fontWeight: '900',
        color: '#888888',
        marginRight: 4,
        letterSpacing: 0.5,
    },
    hudValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#444444',
    },
    text: { color: '#fff' },
    button: { padding: 10, backgroundColor: 'blue', marginTop: 10, borderRadius: 5 },
    buttonText: { color: '#fff' },
});
