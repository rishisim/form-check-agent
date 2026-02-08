import { useState, useEffect, useCallback } from 'react';
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export type OrientationMode = 'portrait' | 'landscape';

interface UseOrientationOptions {
    /** Lock to a specific orientation when the hook mounts. */
    lockTo?: OrientationMode | 'auto';
}

interface OrientationState {
    /** Current orientation mode */
    mode: OrientationMode;
    /** Current screen width (updates on orientation change) */
    width: number;
    /** Current screen height */
    height: number;
    /** Whether the screen is in landscape */
    isLandscape: boolean;
    /** Programmatically lock to a specific orientation */
    lockOrientation: (mode: OrientationMode | 'auto') => Promise<void>;
    /** Unlock orientation back to default (sensor-driven) */
    unlockOrientation: () => Promise<void>;
}

/**
 * Hook that tracks and controls device orientation.
 *
 * Uses expo-screen-orientation for programmatic locking and
 * Dimensions change events as fallback for layout-driven updates.
 */
export function useOrientation(options?: UseOrientationOptions): OrientationState {
    const getMode = (): OrientationMode => {
        const { width, height } = Dimensions.get('window');
        return width > height ? 'landscape' : 'portrait';
    };

    const getDims = () => Dimensions.get('window');

    const [mode, setMode] = useState<OrientationMode>(getMode());
    const [dims, setDims] = useState(getDims());

    // ── Orientation change listener ──
    useEffect(() => {
        const sub = ScreenOrientation.addOrientationChangeListener((event) => {
            const o = event.orientationInfo.orientation;
            const isLand =
                o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
            setMode(isLand ? 'landscape' : 'portrait');
        });

        // Also listen to Dimensions as a reliable fallback
        const dimSub = Dimensions.addEventListener('change', ({ window }) => {
            setDims(window);
            setMode(window.width > window.height ? 'landscape' : 'portrait');
        });

        return () => {
            ScreenOrientation.removeOrientationChangeListener(sub);
            dimSub.remove();
        };
    }, []);

    // ── Apply initial lock if requested ──
    useEffect(() => {
        if (options?.lockTo) {
            lockOrientation(options.lockTo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const lockOrientation = useCallback(async (target: OrientationMode | 'auto') => {
        try {
            if (target === 'landscape') {
                await ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
                );
            } else if (target === 'portrait') {
                await ScreenOrientation.lockAsync(
                    ScreenOrientation.OrientationLock.PORTRAIT_UP,
                );
            } else {
                // 'auto' — allow sensor
                await ScreenOrientation.unlockAsync();
            }
        } catch (e) {
            console.warn('Failed to lock orientation:', e);
        }
    }, []);

    const unlockOrientation = useCallback(async () => {
        try {
            await ScreenOrientation.unlockAsync();
        } catch (e) {
            console.warn('Failed to unlock orientation:', e);
        }
    }, []);

    return {
        mode,
        width: dims.width,
        height: dims.height,
        isLandscape: mode === 'landscape',
        lockOrientation,
        unlockOrientation,
    };
}
