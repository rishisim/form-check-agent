import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';

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
    const [repCount, setRepCount] = useState(0);
    const [feedback, setFeedback] = useState('Position yourself in frame');
    const [aiFeedback, setAiFeedback] = useState('');
    const [kneeAngle, setKneeAngle] = useState<number | null>(null);

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
                            if (analysis.feedback) {
                                setFeedback(analysis.feedback);
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
        };

        ws.onclose = () => {
            console.log('WebSocket closed');
            setIsConnected(false);
            setFeedback('Disconnected. Tap to reconnect.');
        };

        wsRef.current = ws;
    }, []);

    // Throttle state updates
    const lastUpdateRef = useRef(0);



    // Disconnect WebSocket
    const disconnectWebSocket = useCallback(() => {
        if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    // Start streaming frames
    const startStreaming = useCallback(async () => {
        if (!cameraRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        // Capture and send frames at ~10fps for bandwidth efficiency
        frameIntervalRef.current = setInterval(async () => {
            try {
                if (cameraRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                    const photo = await cameraRef.current.takePictureAsync({
                        base64: true,
                        quality: 0.4, // Good balance
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
            }
        }, 200); // 5fps for better performance
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
            >
                {/* Overlay UI */}
                <View style={styles.overlay}>
                    {/* Top bar */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
                    </View>

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{repCount}</Text>
                            <Text style={styles.statLabel}>REPS</Text>
                        </View>
                        {kneeAngle !== null && (
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{Math.round(kneeAngle)}°</Text>
                                <Text style={styles.statLabel}>KNEE ANGLE</Text>
                            </View>
                        )}
                    </View>

                    {/* Feedback */}
                    <View style={styles.feedbackContainer}>
                        <Text style={styles.feedbackText}>{feedback}</Text>
                        {aiFeedback ? (
                            <Text style={styles.aiFeedbackText}>🤖 {aiFeedback}</Text>
                        ) : null}
                    </View>

                    {/* AI Button */}
                    <TouchableOpacity
                        style={[styles.aiButton, isAnalyzing && styles.aiButtonDisabled]}
                        onPress={requestAIFeedback}
                        disabled={isAnalyzing}
                    >
                        <Text style={styles.aiButtonText}>
                            {isAnalyzing ? 'Analyzing...' : '🧠 Ask AI Coach'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
        padding: 20,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 40,
    },
    backButton: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    statBox: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        minWidth: 100,
    },
    statValue: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    statLabel: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 4,
    },
    feedbackContainer: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    feedbackText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    aiFeedbackText: {
        color: '#4FC3F7',
        fontSize: 16,
        marginTop: 10,
        textAlign: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 16,
    },
    button: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    aiButton: {
        backgroundColor: '#6200EE',
        padding: 18,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 40,
    },
    aiButtonDisabled: {
        backgroundColor: '#555',
    },
    aiButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
