import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Configuration - Autonomous floating blob
const NUM_PARTICLES = 80;
const BLOB_RADIUS = 90;
const BLOB_AMPLITUDE = 14;
const PARTICLE_RADIUS = 3;
const JITTER_AMOUNT = 35;

// Google Blue palette
const PARTICLE_COLOR = '#4285F4';
const PARTICLE_OPACITY = 0.3;

// Blob movement parameters
const FLOAT_SPEED_X = 0.15;
const FLOAT_SPEED_Y = 0.12;
const FLOAT_RANGE_X = SCREEN_WIDTH * 0.3;
const FLOAT_RANGE_Y = SCREEN_HEIGHT * 0.15;

export function ParticleBackground() {
    const [time, setTime] = useState(0);

    // Animation loop
    useEffect(() => {
        const startTime = Date.now();
        let animationFrame: number;

        const tick = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            setTime(elapsed);
            animationFrame = requestAnimationFrame(tick);
        };

        animationFrame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animationFrame);
    }, []);

    // Pre-generate particle data
    const particleData = useMemo(() => {
        return Array.from({ length: NUM_PARTICLES }, (_, i) => ({
            baseAngle: (i / NUM_PARTICLES) * Math.PI * 2,
            radiusOffset: (Math.random() - 0.5) * JITTER_AMOUNT,
            angleOffset: (Math.random() - 0.5) * 0.4,
            speedMultiplier: 0.7 + Math.random() * 0.6,
            phaseOffset: Math.random() * Math.PI * 2,
            radiusRatio: 0.3 + Math.random() * 0.7, // Some particles closer to center
        }));
    }, []);

    // Calculate particle positions
    const particles = useMemo(() => {
        // Blob center floats autonomously using Lissajous-like curves
        const centerX = SCREEN_WIDTH / 2 + Math.sin(time * FLOAT_SPEED_X) * FLOAT_RANGE_X;
        const centerY = SCREEN_HEIGHT * 0.35 + Math.sin(time * FLOAT_SPEED_Y + 0.5) * FLOAT_RANGE_Y;

        // Breathing cycle
        const breathCycle = Math.sin(time * 0.6);
        const currentRadius = BLOB_RADIUS + breathCycle * BLOB_AMPLITUDE;

        // Ring rotation
        const rotation = time * 0.08;

        return particleData.map((p, i) => {
            // Angle with rotation and oscillation
            const angle = p.baseAngle + rotation + Math.sin(time * 0.5 + p.phaseOffset) * 0.15;

            // Base radius with layer variation
            const baseRadius = currentRadius * p.radiusRatio;

            // Alive drift - particles oscillate
            const driftPhase = time * 0.4 * p.speedMultiplier + p.phaseOffset;
            const driftRadius = baseRadius + p.radiusOffset + Math.sin(driftPhase * 1.5) * 6;

            // Spark effect
            const sparkPhase = Math.sin(driftPhase * 2.5 + p.phaseOffset);
            const sparkBoost = sparkPhase > 0.8 ? (sparkPhase - 0.8) * 25 : 0;
            const finalRadius = driftRadius + sparkBoost;

            // Final position
            const x = centerX + Math.cos(angle) * finalRadius;
            const y = centerY + Math.sin(angle) * finalRadius;

            // Dynamic opacity
            const distRatio = finalRadius / (currentRadius + JITTER_AMOUNT);
            const baseOpacity = PARTICLE_OPACITY * (0.6 + distRatio * 0.4);
            const sparkOpacity = sparkBoost > 0 ? 0.3 : 0;

            return {
                x,
                y,
                opacity: Math.min(1, baseOpacity + sparkOpacity),
                key: i,
            };
        });
    }, [time, particleData]);

    return (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {particles.map((p) => (
                <Circle
                    key={p.key}
                    cx={p.x}
                    cy={p.y}
                    r={PARTICLE_RADIUS}
                    fill={PARTICLE_COLOR}
                    opacity={p.opacity}
                />
            ))}
        </Svg>
    );
}
