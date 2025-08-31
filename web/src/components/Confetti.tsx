import React, { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; ttl: number; spin: number; angle: number };

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

export default function Confetti({ duration = 2400 }: { duration?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

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
      const count = 120;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI - Math.PI / 2; // upward
        const speed = 3 + Math.random() * 3;
        particles.push({
          x: canvas.width / 2,
          y: canvas.height + 10,
          vx: Math.cos(angle) * speed,
          vy: -Math.sin(angle) * speed - 6,
          size: 2 + Math.random() * 4,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 0,
          ttl: 90 + (Math.random() * 40),
          spin: (Math.random() - 0.5) * 0.2,
          angle: Math.random() * Math.PI * 2,
        });
      }
    }

    spawnBurst();

    function frame(t: number) {
      if (!running) return;
      const dt = 1; // simple step
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // gravity
      for (const p of particles) {
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
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
        if (p.life > p.ttl || p.y > canvas.height + 50) particles.splice(i, 1);
      }
      if (t - start < duration) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [duration]);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true" />;
}

