'use client';

import { useEffect, useRef } from 'react';

export default function TechBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Configuration
        const GRID_SPACING = 40;
        const DOT_RADIUS_BASE = 1.5;
        const DOT_RADIUS_MAX = 6;
        const INFLUENCE_RADIUS = 200;

        // Colors
        const COLOR_BASE = 'rgba(0, 0, 0, 0.1)'; // Light Gray
        const COLOR_ACTIVE = 'rgba(0, 112, 243, 0.8)'; // Tech Blue

        interface Dot {
            x: number;
            y: number;
            baseX: number;
            baseY: number;
        }

        const dots: Dot[] = [];
        let mouseX = -1000;
        let mouseY = -1000;

        const init = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;

            dots.length = 0;
            const cols = Math.ceil(width / GRID_SPACING);
            const rows = Math.ceil(height / GRID_SPACING);

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const x = i * GRID_SPACING + GRID_SPACING / 2;
                    const y = j * GRID_SPACING + GRID_SPACING / 2;
                    dots.push({
                        x,
                        y,
                        baseX: x,
                        baseY: y
                    });
                }
            }
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            dots.forEach(dot => {
                // Calculate distance to mouse
                const dx = mouseX - dot.baseX;
                const dy = mouseY - dot.baseY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                let radius = DOT_RADIUS_BASE;
                let color = COLOR_BASE;
                let x = dot.baseX;
                let y = dot.baseY;

                if (dist < INFLUENCE_RADIUS) {
                    // Scale up based on proximity
                    const factor = (INFLUENCE_RADIUS - dist) / INFLUENCE_RADIUS;
                    radius = DOT_RADIUS_BASE + factor * (DOT_RADIUS_MAX - DOT_RADIUS_BASE);

                    // Move slightly away from mouse (Repulsion)
                    // x += (dx / dist) * factor * -10;
                    // y += (dy / dist) * factor * -10;

                    // Or move towards mouse (Attraction)
                    x -= (dx / dist) * factor * 10;
                    y -= (dy / dist) * factor * 10;

                    // Change color
                    // Interpolate between gray and blue
                    // Simple switch for now
                    color = COLOR_ACTIVE;
                }

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const handleResize = () => {
            init();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        init();
        draw();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{
                width: '100%',
                height: '100%',
                zIndex: 0 // Behind content
            }}
        />
    );
}
