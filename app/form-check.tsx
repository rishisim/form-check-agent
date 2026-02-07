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
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

    // UI State
    const [isProMode, setIsProMode] = useState(false); // Toggle for Skeleton/Details

    // Analysis State
    const [repCount, setRepCount] = useState(0);
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
                            setRepCount(analysis.rep_count || 0);
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

        const intervalMs = Platform.OS === 'android' ? 400 : 250;

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
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonBlur}>
                            <Text style={styles.backButton}>←</Text>
                        </TouchableOpacity>

                        {/* Connection Status Dot */}
                        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
                    </View>

                    {/* Right Side: Rep Counter */}
                    <RepCounter count={repCount} />

                    {/* Center: Feedback Toast */}
                    <FeedbackToast message={feedback} level={feedbackLevel} />

                    {/* AI & Mode Controls - Bottom */}
                    <View style={styles.bottomControls}>
                        {/* Toggle Mode */}
                        <TouchableOpacity
                            style={styles.modeToggle}
                            onPress={() => setIsProMode(!isProMode)}
                        >
                            <Text style={styles.modeText}>{isProMode ? 'PRO' : 'FOCUS'}</Text>
                        </TouchableOpacity>

                        {/* AI Coach Button */}
                        <TouchableOpacity
                            style={[styles.aiButton, isAnalyzing && styles.aiButtonDisabled]}
                            onPress={requestAIFeedback}
                            disabled={isAnalyzing}
                        >
                            <Text style={styles.aiButtonText}>
                                {isAnalyzing ? 'Analyzing...' : '🧠 AI'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* AI Feedback Popup */}
                    {aiFeedback ? (
                        <View style={styles.aiPopup}>
                            <Text style={styles.aiPopupTitle}>AI Coach</Text>
                            <Text style={styles.aiPopupText}>{aiFeedback}</Text>
                            <TouchableOpacity onPress={() => setAiFeedback('')} style={styles.closeAi}>
                                <Text style={styles.closeAiText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* Pro Mode Stats */}
                    {isProMode && kneeAngle !== null && (
                        <View style={styles.debugStats}>
                            <Text style={styles.debugText}>Knee: {kneeAngle}°</Text>
                        </View>
                    )}

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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backButtonBlur: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        position: 'absolute',
        top: 15,
        right: 15,
    },
    bottomControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modeToggle: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    modeText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 1,
    },
    aiButton: {
        backgroundColor: '#6200EE',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        shadowColor: "#6200EE",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 5,
    },
    aiButtonDisabled: {
        backgroundColor: '#555',
        shadowOpacity: 0,
    },
    aiButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    aiPopup: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: '#1E1E1E',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        elevation: 10,
    },
    aiPopupTitle: {
        color: '#BB86FC',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    aiPopupText: {
        color: '#E0E0E0',
        fontSize: 16,
        lineHeight: 24,
    },
    closeAi: {
        marginTop: 15,
        alignSelf: 'flex-end',
    },
    closeAiText: {
        color: '#BB86FC',
        fontWeight: 'bold',
    },
    debugStats: {
        position: 'absolute',
        top: 100,
        left: 20,
    },
    debugText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    text: { color: '#fff' },
    button: { padding: 10, backgroundColor: 'blue', marginTop: 10, borderRadius: 5 },
    buttonText: { color: '#fff' },
});
