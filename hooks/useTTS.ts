import { useRef, useCallback, useEffect } from 'react';
import { useAudioPlayer, AudioSource } from 'expo-audio';

// ─── Configuration ───────────────────────────────────────
const MIN_SPEAK_INTERVAL_MS = 3000; // Minimum gap between TTS calls
const SKIP_MESSAGES = new Set([
    'Position yourself in frame',
    'Start Squatting',
    'Start Push-ups',
    'Chest up a bit more',      // minor warning, not worth vocalizing
    'Tighten your core',        // mild pushup warning, not worth vocalizing
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
 */
export function useTTS({ serverUrl, enabled = true }: UseTTSOptions) {
    const lastSpokenTextRef = useRef('');
    const lastSpeakTimeRef = useRef(0);
    const isSpeakingRef = useRef(false);
    const mountedRef = useRef(true);
    const playerRef = useRef<ReturnType<typeof useAudioPlayer> | null>(null);

    // Create a player instance (starts with no source)
    const player = useAudioPlayer(null);
    playerRef.current = player;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Listen for playback completion
    useEffect(() => {
        const subscription = player.addListener('playbackStatusUpdate', (status) => {
            if (!mountedRef.current) return;
            if (status.playing === false && isSpeakingRef.current) {
                isSpeakingRef.current = false;
            }
        });
        return () => subscription.remove();
    }, [player]);

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
                const uri = `${serverUrl}/tts?text=${encodeURIComponent(text)}`;
                player.replace({ uri } as AudioSource);
                player.play();
            } catch (e) {
                console.warn('TTS playback error:', e);
                isSpeakingRef.current = false;
            }
        },
        [serverUrl, enabled, player],
    );

    /** Stop any currently playing speech */
    const stop = useCallback(() => {
        isSpeakingRef.current = false;
        try {
            player.pause();
        } catch { /* ignore */ }
    }, [player]);

    return { speak, stop };
}
