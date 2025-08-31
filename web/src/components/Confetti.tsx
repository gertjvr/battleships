import React, { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; ttl: number; spin: number; angle: number };

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

type Props = { duration?: number; loop?: boolean; origin?: 'center' | 'bottom' };

export default function Confetti({ duration = 2400, loop = false, origin = 'bottom' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let running = true;
    let start = performance.now();
    const particles: Particle[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnBurst() {
      const count = 140;
      for (let i = 0; i < count; i++) {
        const cx = canvas.width / 2;
        const cy = origin === 'center' ? canvas.height / 2 : canvas.height + 10;
        let angle: number;
        let speed: number;
        if (origin === 'center') {
          angle = Math.random() * Math.PI * 2; // radial
          speed = 2.5 + Math.random() * 3.5;
        } else {
          angle = Math.random() * Math.PI - Math.PI / 2; // upward
          speed = 3 + Math.random() * 3;
        }
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed * (origin === 'center' ? 1 : -1) - (origin === 'center' ? 0 : 6),
          size: 2 + Math.random() * 4,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 0,
          ttl: 110 + (Math.random() * 60),
          spin: (Math.random() - 0.5) * 0.25,
          angle: Math.random() * Math.PI * 2,
        });
      }
    }

    // Initial burst
    spawnBurst();
    // If looping, spawn repeated bursts
    if (loop) {
      timerRef.current = window.setInterval(spawnBurst, 900);
    }

    function frame(t: number) {
      if (!running) return;
      const dt = 1; // simple step
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // gravity / drift
      for (const p of particles) {
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        if (origin === 'center') {
          p.vx *= 0.992;
          p.vy *= 0.992;
        } else {
          p.vy += 0.15; // gravity
        }
        p.angle += p.spin;
      }
      // draw
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2 * 0.6);
        ctx.restore();
      }
      // cull
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.life > p.ttl || p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) particles.splice(i, 1);
      }
      if (loop || (t - start < duration)) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [duration, loop, origin]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true" />;
}
