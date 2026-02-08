import React, { useState, useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WAVE_HEIGHT = 160;
const FLOW_SPEED = 1; // Very slow drift

/**
 * Slowly flowing parametric wave lines rendered at the top of the screen.
 * Purely decorative – sits behind the header text.
 */
export function WaveHeader() {
    const [time, setTime] = useState(0);

    useEffect(() => {
        const start = Date.now();
        let frame: number;
        const tick = () => {
            setTime((Date.now() - start) / 1000);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, []);

    // Generate a smooth parametric wave path
    const buildWave = (
        amplitude: number,
        frequency: number,
        phaseShift: number,
        yOffset: number,
        drift: number,
    ): string => {
        const points: string[] = [];
        const steps = 120;

        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * SCREEN_WIDTH;
            const t = (i / steps) * Math.PI * 2 * frequency + phaseShift + drift;
            const y = yOffset + Math.sin(t) * amplitude + Math.cos(t * 0.6 + 1.2) * (amplitude * 0.35);
            points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
        }

        return points.join(' ');
    };

    const waves = [
        { amplitude: 14, frequency: 1.6, phase: 0, y: 55, gradientId: 'wave1', color1: '#4285F4', color2: '#60A5FA', opacity: 0.18, strokeWidth: 2.5 },
        { amplitude: 10, frequency: 2.0, phase: 1.2, y: 72, gradientId: 'wave2', color1: '#60A5FA', color2: '#93C5FD', opacity: 0.22, strokeWidth: 2 },
        { amplitude: 18, frequency: 1.3, phase: 2.5, y: 90, gradientId: 'wave3', color1: '#3B82F6', color2: '#60A5FA', opacity: 0.13, strokeWidth: 3 },
        { amplitude: 8, frequency: 2.4, phase: 0.8, y: 105, gradientId: 'wave4', color1: '#93C5FD', color2: '#BFDBFE', opacity: 0.25, strokeWidth: 1.5 },
        { amplitude: 12, frequency: 1.8, phase: 3.8, y: 120, gradientId: 'wave5', color1: '#60A5FA', color2: '#93C5FD', opacity: 0.15, strokeWidth: 2 },
    ];

    return (
        <Svg
            width={SCREEN_WIDTH}
            height={WAVE_HEIGHT}
            style={styles.svg}
            pointerEvents="none"
        >
            <Defs>
                {waves.map((w) => (
                    <LinearGradient key={w.gradientId} id={w.gradientId} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={w.color1} stopOpacity={String(w.opacity)} />
                        <Stop offset="0.5" stopColor={w.color2} stopOpacity={String(w.opacity * 1.3)} />
                        <Stop offset="1" stopColor={w.color1} stopOpacity={String(w.opacity * 0.6)} />
                    </LinearGradient>
                ))}
            </Defs>

            {waves.map((w, i) => (
                <Path
                    key={w.gradientId}
                    d={buildWave(w.amplitude, w.frequency, w.phase, w.y, time * FLOW_SPEED * (0.8 + i * 0.15))}
                    stroke={`url(#${w.gradientId})`}
                    strokeWidth={w.strokeWidth}
                    strokeLinecap="round"
                    fill="none"
                />
            ))}
        </Svg>
    );
}

const styles = StyleSheet.create({
    svg: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
    },
});
