"use client";

import { useEffect, useRef } from "react";

type Point3D = {
  x: number;
  y: number;
  z: number;
};

type Props = {
  className?: string;
  size?: number;
  particleCount?: number;
};

function fibonacciSphere(n: number, radius: number): Point3D[] {
  const pts: Point3D[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({
      x: Math.cos(theta) * ring * radius,
      y: y * radius,
      z: Math.sin(theta) * ring * radius,
    });
  }
  return pts;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InteractiveSphere({ className = "", size = 280, particleCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const rotationRef = useRef({ x: 0.25, y: 0 });
  const targetRef = useRef({ x: 0.25, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const count = particleCount ?? (size < 240 ? 72 : 110);
    const radius = size * 0.36;
    const basePoints = fibonacciSphere(count, radius);
    const linkDist = radius * 0.55;
    const linkDistSq = linkDist * linkDist;

    let dpr = 1;
    let w = size;
    let h = size;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth || size;
      h = parent.clientHeight || size;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((clientY - rect.top) / rect.height) * 2 - 1;
      pointerRef.current = { x: nx, y: ny, active: true };
      targetRef.current = {
        x: 0.2 + ny * 0.45,
        y: nx * 0.65,
      };
    };

    const onMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onLeave = () => {
      pointerRef.current.active = false;
      targetRef.current = { x: 0.25, y: 0 };
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchstart", onTouch, { passive: true });
    canvas.addEventListener("touchmove", onTouch, { passive: true });
    canvas.addEventListener("touchend", onLeave);

    const rotateY = (p: Point3D, a: number): Point3D => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    };

    const rotateX = (p: Point3D, a: number): Point3D => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    };

    const draw = (time: number) => {
      frameRef.current = requestAnimationFrame(draw);

      const rot = rotationRef.current;
      const target = targetRef.current;
      const lerp = reduced ? 1 : 0.06;
      rot.x += (target.x - rot.x) * lerp;
      rot.y += (target.y - rot.y) * lerp;
      if (!pointerRef.current.active && !reduced) {
        rot.y += 0.0035;
      }

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.0012);

      const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.6);
      glow.addColorStop(0, `rgba(34, 211, 238, ${0.08 + pulse * 0.05})`);
      glow.addColorStop(0.45, `rgba(59, 130, 246, ${0.04 + pulse * 0.03})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const projected: { x: number; y: number; z: number; i: number }[] = [];

      for (let i = 0; i < basePoints.length; i++) {
        let p = basePoints[i];
        p = rotateY(p, rot.y + (reduced ? 0 : time * 0.0004));
        p = rotateX(p, rot.x);
        const depth = (p.z + radius) / (radius * 2);
        const scale = 1 + depth * 0.35;
        projected.push({
          x: cx + p.x * scale,
          y: cy + p.y * scale,
          z: p.z,
          i,
        });
      }

      projected.sort((a, b) => a.z - b.z);

      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > linkDistSq) continue;

          const dist = Math.sqrt(distSq);
          const depth = ((a.z + b.z) / 2 + radius) / (radius * 2);
          const alpha = (1 - dist / linkDist) * (0.15 + depth * 0.45);
          const hot =
            pointerRef.current.active &&
            Math.hypot(a.x - cx - pointerRef.current.x * radius * 0.5, a.y - cy - pointerRef.current.y * radius * 0.5) <
              radius * 0.55;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = hot
            ? `rgba(34, 211, 238, ${alpha * 1.4})`
            : `rgba(148, 163, 184, ${alpha})`;
          ctx.lineWidth = hot ? 1.1 : 0.55;
          ctx.stroke();
        }
      }

      for (const p of projected) {
        const depth = (p.z + radius) / (radius * 2);
        const pr = 1.2 + depth * 2.2;
        const alpha = 0.25 + depth * 0.75;

        if (depth > 0.55) {
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * 5);
          hg.addColorStop(0, `rgba(34, 211, 238, ${alpha * 0.35})`);
          hg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
        if (depth > 0.6) {
          ctx.shadowColor = "rgba(34, 211, 238, 0.9)";
          ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.02, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 + pulse * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("touchstart", onTouch);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchend", onLeave);
      ro.disconnect();
    };
  }, [size, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`touch-none cursor-grab active:cursor-grabbing ${className}`}
      aria-hidden
    />
  );
}
