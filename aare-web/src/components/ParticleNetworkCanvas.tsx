"use client";

import { useEffect, useRef, useCallback } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hub: boolean;
  hue: number;
  phase: number;
};

type Props = {
  className?: string;
  /** Base particle count on desktop; scaled down on mobile */
  density?: number;
  interactive?: boolean;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ParticleNetworkCanvas({
  className = "",
  density = 1,
  interactive = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const visibleRef = useRef(true);

  const initParticles = useCallback((w: number, h: number) => {
    const isMobile = w < 768;
    const base = Math.floor((isMobile ? 42 : 88) * density);
    const count = prefersReducedMotion() ? Math.min(24, base) : base;
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const hub = i < Math.max(4, Math.floor(count * 0.08));
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * (hub ? 0.25 : 0.45),
        vy: (Math.random() - 0.5) * (hub ? 0.25 : 0.45),
        r: hub ? 2.8 + Math.random() * 1.2 : 1 + Math.random() * 1.4,
        hub,
        hue: hub ? (Math.random() > 0.5 ? 195 : 265) : 210 + Math.random() * 40,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, [density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let dpr = 1;

    let lastW = 0;
    let lastH = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (
        particlesRef.current.length === 0 ||
        Math.abs(w - lastW) > 80 ||
        Math.abs(h - lastH) > 80
      ) {
        lastW = w;
        lastH = h;
        initParticles(w, h);
      }
    };

    const updateMouse = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        active: interactive && !reduced,
      };
    };

    const onMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);

    const onLeave = () => {
      mouseRef.current.active = false;
    };

    const onTouch = (e: TouchEvent) => {
      if (!interactive || reduced || !e.touches[0]) return;
      const t = e.touches[0];
      updateMouse(t.clientX, t.clientY);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    resize();
    const ro = new ResizeObserver(() => resize());
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("resize", resize);
    if (interactive) {
      window.addEventListener("mousemove", onMove);
      document.addEventListener("mouseleave", onLeave);
      window.addEventListener("touchmove", onTouch, { passive: true });
      window.addEventListener("touchend", onLeave);
    }

    const linkDist = w < 768 ? 100 : 140;
    const linkDistSq = linkDist * linkDist;
    const mouseRadius = 160;
    const mouseRadiusSq = mouseRadius * mouseRadius;

    const draw = (time: number) => {
      frameRef.current = requestAnimationFrame(draw);
      if (!visibleRef.current) return;

      const particles = particlesRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseOn = mouseRef.current.active;

      ctx.clearRect(0, 0, w, h);

      // Soft vignette pulse
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.0008);
      const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.75);
      grad.addColorStop(0, `rgba(59, 130, 246, ${0.04 + pulse * 0.03})`);
      grad.addColorStop(0.5, `rgba(34, 211, 238, ${0.02 + pulse * 0.02})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (!reduced) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -20) p.x = w + 20;
          if (p.x > w + 20) p.x = -20;
          if (p.y < -20) p.y = h + 20;
          if (p.y > h + 20) p.y = -20;

          if (mouseOn) {
            const dx = p.x - mx;
            const dy = p.y - my;
            const distSq = dx * dx + dy * dy;
            if (distSq < mouseRadiusSq && distSq > 1) {
              const force = (mouseRadiusSq - distSq) / mouseRadiusSq;
              p.vx += (dx / Math.sqrt(distSq)) * force * 0.08;
              p.vy += (dy / Math.sqrt(distSq)) * force * 0.08;
            }
          }

          p.vx *= 0.995;
          p.vy *= 0.995;
          const speed = Math.hypot(p.vx, p.vy);
          const max = p.hub ? 0.7 : 1.1;
          if (speed > max) {
            p.vx = (p.vx / speed) * max;
            p.vy = (p.vy / speed) * max;
          }
        }
      }

      // Links
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > linkDistSq) continue;

          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / linkDist) * (a.hub || b.hub ? 0.55 : 0.28);
          const isHot =
            mouseOn &&
            ((a.x - mx) ** 2 + (a.y - my) ** 2 < mouseRadiusSq ||
              (b.x - mx) ** 2 + (b.y - my) ** 2 < mouseRadiusSq);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = isHot
            ? `rgba(34, 211, 238, ${alpha * 1.2})`
            : `rgba(59, 130, 246, ${alpha})`;
          ctx.lineWidth = isHot ? 1.2 : 0.6;
          ctx.stroke();
        }
      }

      // Mouse hub glow
      if (mouseOn && !reduced) {
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mouseRadius);
        mg.addColorStop(0, "rgba(34, 211, 238, 0.12)");
        mg.addColorStop(0.4, "rgba(59, 130, 246, 0.06)");
        mg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, mouseRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(mx, my, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34, 211, 238, 0.9)";
        ctx.shadowColor = "rgba(34, 211, 238, 0.8)";
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Particles
      for (const p of particles) {
        const glow = p.hub ? 0.65 + 0.35 * Math.sin(time * 0.003 + p.phase) : 0.45;
        const pr = p.r * (p.hub ? glow : 1);

        if (p.hub) {
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * 6);
          hg.addColorStop(0, `hsla(${p.hue}, 90%, 65%, 0.35)`);
          hg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr * 6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = p.hub
          ? `hsla(${p.hue}, 85%, 72%, ${0.85 * glow})`
          : `hsla(${p.hue}, 70%, 78%, 0.55)`;
        if (p.hub) {
          ctx.shadowColor = `hsla(${p.hue}, 100%, 70%, 0.9)`;
          ctx.shadowBlur = 12;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Occasional data pulse along a random link (hub to hub)
      if (!reduced && Math.floor(time / 1200) % 3 === 0) {
        const hubs = particles.filter((p) => p.hub);
        if (hubs.length >= 2) {
          const idxA = Math.floor(time / 1800) % hubs.length;
          const idxB = (idxA + 1 + Math.floor(time / 3600)) % hubs.length;
          const a = hubs[idxA];
          const b = hubs[idxB];
          const t = (time % 1200) / 1200;
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onLeave);
      observer.disconnect();
      ro.disconnect();
    };
  }, [density, initParticles, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    />
  );
}
