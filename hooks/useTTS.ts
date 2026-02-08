import { useRef, useCallback, useEffect } from 'react';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// ─── Configuration ───────────────────────────────────────
const MIN_SPEAK_INTERVAL_MS = 3000; // Minimum gap between TTS calls
const SKIP_MESSAGES = new Set([
    'Position yourself in frame',
    'Start Squatting',
    'Start Push-ups',
    'Nice, just a little more chest lift', // minor warning, not worth vocalizing
    'Let\'s engage that core',             // mild pushup warning, not worth vocalizing
]);

interface UseTTSOptions {
    /** Base HTTP URL of the backend server (e.g. "http://10.0.0.1:8000") */
    serverUrl: string;
    /** Whether TTS is enabled */
    enabled?: boolean;
}

/**
 * Hook that converts real-time feedback text into speech via the backend
 * Eleven Labs TTS endpoint.  De-duplicates and rate-limits automatically.
 * Uses expo-audio AudioPlayer for reliable playback.
 */
export function useTTS({ serverUrl, enabled = true }: UseTTSOptions) {
    const lastSpokenTextRef = useRef('');
    const lastSpeakTimeRef = useRef(0);
    const isSpeakingRef = useRef(false);
    const mountedRef = useRef(true);
    const playerRef = useRef<AudioPlayer | null>(null);

    useEffect(() => {
        mountedRef.current = true;
        // Configure audio mode for playback alongside camera
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: 'duckOthers',
        }).catch(() => {});
        return () => {
            mountedRef.current = false;
            // Cleanup any playing sound
            if (playerRef.current) {
                playerRef.current.remove();
                playerRef.current = null;
            }
        };
    }, []);

    /**
     * Speak the given feedback text.
     * Automatically skips if:
     *  - the same text was just spoken
     *  - the cooldown hasn't elapsed
     *  - the text is in the skip-list
     *  - another utterance is still playing
     */
    const speak = useCallback(
        async (text: string) => {
            if (!enabled || !text) return;

            // Skip generic / initial messages
            if (SKIP_MESSAGES.has(text)) return;

            // Don't repeat the exact same phrase back-to-back
            if (text === lastSpokenTextRef.current) return;

            // Rate-limit
            const now = Date.now();
            if (now - lastSpeakTimeRef.current < MIN_SPEAK_INTERVAL_MS) return;

            // Don't overlap speech
            if (isSpeakingRef.current) return;

            isSpeakingRef.current = true;
            lastSpokenTextRef.current = text;
            lastSpeakTimeRef.current = now;

            try {
                // Release previous player if any
                if (playerRef.current) {
                    playerRef.current.remove();
                    playerRef.current = null;
                }

                const uri = `${serverUrl}/tts?text=${encodeURIComponent(text)}`;
                const player = createAudioPlayer({ uri });
                player.volume = 1.0;
                playerRef.current = player;

                // Listen for playback completion
                player.addListener('playbackStatusUpdate', (status) => {
                    if (!mountedRef.current) return;
                    if (status.didJustFinish) {
                        isSpeakingRef.current = false;
                        player.remove();
                        if (playerRef.current === player) {
                            playerRef.current = null;
                        }
                    }
                });

                player.play();
            } catch (e) {
                console.warn('TTS playback error:', e);
                isSpeakingRef.current = false;
            }
        },
        [serverUrl, enabled],
    );

    /** Stop any currently playing speech */
    const stop = useCallback(async () => {
        isSpeakingRef.current = false;
        try {
            if (playerRef.current) {
                playerRef.current.pause();
                playerRef.current.remove();
                playerRef.current = null;
            }
        } catch { /* ignore */ }
    }, []);

    return { speak, stop };
}
