import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SkeletonOverlay } from '../components/SkeletonOverlay';
import { DepthLine } from '../components/DepthLine';
import { RepBreakdown } from '../components/RepBreakdown';
import { FeedbackToast } from '../components/FeedbackToast';
import { colors, spacing, radius } from '../constants/theme';

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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

    // UI State
    const [isProMode, setIsProMode] = useState(false); // Toggle for Skeleton/Details

    // Analysis State
    const [validReps, setValidReps] = useState(0);
    const [invalidReps, setInvalidReps] = useState(0);
    const [feedback, setFeedback] = useState('Position yourself in frame');
    const [feedbackLevel, setFeedbackLevel] = useState<'success' | 'warning' | 'error'>('success');
    const [aiFeedback, setAiFeedback] = useState('');

    // Pro Mode Data
    const [kneeAngle, setKneeAngle] = useState<number | null>(null);
    const [landmarks, setLandmarks] = useState<number[][]>([]);
    const [hipTrajectory, setHipTrajectory] = useState<number[][]>([]);

    // Depth Data
    const [targetDepthY, setTargetDepthY] = useState(0);
    const [currentDepthY, setCurrentDepthY] = useState(0);

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isStreamingRef = useRef(false);
    const isCapturingRef = useRef(false);
    const cameraReadyRef = useRef(false);

    // Connect to backend WebSocket
    const connectWebSocket = useCallback(() => {
        console.log('Connecting to', SERVER_URL);
        const ws = new WebSocket(SERVER_URL);

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setFeedback('Connected! Start your exercise.');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const now = Date.now();

                // Throttle UI updates to ~15fps (every 66ms)
                if (data.type === 'analysis' && data.feedback) {
                    if (now - lastUpdateRef.current > 66) {
                        const analysis = data.feedback.analysis;
                        if (analysis) {
                            setValidReps(analysis.valid_reps ?? 0);
                            setInvalidReps(analysis.invalid_reps ?? 0);
                            setKneeAngle(analysis.knee_angle);
                            setFeedback(analysis.feedback);
                            setFeedbackLevel(analysis.feedback_level || 'success');

                            // Visuals
                            setTargetDepthY(analysis.target_depth_y || 0);
                            setCurrentDepthY(analysis.current_depth_y || 0);

                            if (isProMode) {
                                // Only update heavy arrays in Pro Mode to save React cycles
                                setLandmarks(data.feedback.landmarks || []);
                                setHipTrajectory(analysis.hip_trajectory || []);
                            }
                        }
                        lastUpdateRef.current = now;
                    }
                } else if (data.type === 'ai_feedback') {
                    setAiFeedback(data.response);
                    setIsAnalyzing(false);
                }
            } catch (e) {
                console.error('Failed to parse message:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setFeedback('Connection error. Check server.');
            setFeedbackLevel('error');
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            setIsConnected(false);
            setFeedback('Disconnected. Tap to reconnect.');
            setFeedbackLevel('warning');
            if (frameIntervalRef.current) {
                clearTimeout(frameIntervalRef.current);
                frameIntervalRef.current = null;
            }
            isStreamingRef.current = false;
        };

        wsRef.current = ws;
    }, [isProMode]); // Re-connect if mode changes? No, just closure dependency.

    // Throttle state updates
    const lastUpdateRef = useRef(0);

    // Disconnect WebSocket
    const disconnectWebSocket = useCallback(() => {
        if (frameIntervalRef.current) {
            clearTimeout(frameIntervalRef.current);
            frameIntervalRef.current = null;
        }
        isStreamingRef.current = false;
        if (wsRef.current) {
            wsRef.current.close();
        }
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

        const intervalMs = 150;  // ~6.7 fps - more frames = better rep detection

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
                        quality: Platform.OS === 'android' ? 0.15 : 0.25,
                        skipProcessing: true,
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

    // Request AI analysis
    const requestAIFeedback = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            setIsAnalyzing(true);
            setAiFeedback('Analyzing your form...');
            wsRef.current.send(JSON.stringify({
                type: 'request_ai_feedback',
                exercise: 'squat'
            }));
        } else {
            Alert.alert('Not Connected', 'Please wait for connection to the server.');
        }
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
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={[styles.text, { color: colors.textMuted }]}>Loading…</Text>
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, { justifyContent: 'center', padding: spacing.lg }]}>
                <Text style={[styles.text, { marginBottom: spacing.md }]}>Camera permission required</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission} activeOpacity={0.8}>
                    <Text style={styles.buttonText}>Allow</Text>
                </TouchableOpacity>
            </View>
        );
    }

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
                {/* 1. Underlying Visual Layers */}
                <DepthLine
                    targetDepthY={targetDepthY}
                    currentDepthY={currentDepthY}
                    isValid={!!targetDepthY}
                />

                {isProMode && (
                    <SkeletonOverlay
                        landmarks={landmarks}
                        hipTrajectory={hipTrajectory}
                    />
                )}

                {/* 2. UI Overlay Layer */}
                <SafeAreaView style={styles.safeOverlay}>
                    {/* Top Bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                            <Text style={styles.backText}>←</Text>
                        </TouchableOpacity>
                        <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.success : colors.error }]} />
                    </View>

                    {/* Right Side: Rep Breakdown */}
                    <RepBreakdown validReps={validReps} invalidReps={invalidReps} />

                    {/* Center: Feedback Toast */}
                    <FeedbackToast message={feedback} level={feedbackLevel} />

                    {/* Bottom Controls */}
                    <View style={styles.bottomControls}>
                        <TouchableOpacity
                            style={styles.modeBtn}
                            onPress={() => setIsProMode(!isProMode)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.modeText}>{isProMode ? 'PRO' : 'FOCUS'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.aiBtn, isAnalyzing && styles.aiBtnDisabled]}
                            onPress={requestAIFeedback}
                            disabled={isAnalyzing}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.aiBtnText}>{isAnalyzing ? '…' : 'AI'}</Text>
                        </TouchableOpacity>
                    </View>

                    {aiFeedback ? (
                        <View style={styles.aiPopup}>
                            <Text style={styles.aiPopupText}>{aiFeedback}</Text>
                            <TouchableOpacity onPress={() => setAiFeedback('')} style={styles.closeBtn} activeOpacity={0.7}>
                                <Text style={styles.closeText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {isProMode && kneeAngle !== null && (
                        <View style={styles.proStats}>
                            <Text style={styles.proStatsText}>{kneeAngle}°</Text>
                        </View>
                    )}

                </SafeAreaView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    camera: { flex: 1, width: '100%', backgroundColor: colors.bg },
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 2, elevation: 2 },
    safeOverlay: { flex: 1, justifyContent: 'space-between', padding: spacing.lg },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center', alignItems: 'center',
    },
    backText: { color: colors.text, fontSize: 22, fontWeight: '300' },
    statusDot: {
        width: 6, height: 6, borderRadius: 3,
        position: 'absolute', top: 14, right: spacing.lg,
    },
    bottomControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modeBtn: {
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modeText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    aiBtn: {
        backgroundColor: colors.accent,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg * 2,
        borderRadius: radius.full,
    },
    aiBtnDisabled: { backgroundColor: colors.textMuted, opacity: 0.7 },
    aiBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    aiPopup: {
        position: 'absolute',
        bottom: 100,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: 'rgba(10,10,10,0.95)',
        padding: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    aiPopupText: { color: colors.text, fontSize: 15, lineHeight: 22 },
    closeBtn: { marginTop: spacing.md, alignSelf: 'flex-end' },
    closeText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
    proStats: {
        position: 'absolute',
        top: 100,
        left: spacing.lg,
    },
    proStatsText: {
        color: colors.textMuted,
        fontSize: 13,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    text: { color: colors.text },
    button: { padding: spacing.md, backgroundColor: colors.accent, marginTop: spacing.sm, borderRadius: radius.sm },
    buttonText: { color: colors.text, fontWeight: '600' },
});
