"use client";

import React, { useEffect, useRef } from "react";

interface SkyOceanSceneProps {
  paused?: boolean;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
}

interface Sparkle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

function buildCloudSprite(): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = 240;
  off.height = 140;
  const octx = off.getContext("2d");
  if (!octx) return off;

  octx.translate(82, 76);
  octx.fillStyle = "#ffffff";
  octx.shadowColor = "rgba(255, 255, 255, 0.65)";
  octx.shadowBlur = 16;

  octx.beginPath();
  octx.arc(0, 0, 36, 0, Math.PI * 2);
  octx.arc(32, -10, 44, 0, Math.PI * 2);
  octx.arc(72, -4, 36, 0, Math.PI * 2);
  octx.arc(102, 6, 26, 0, Math.PI * 2);
  octx.arc(-28, 8, 26, 0, Math.PI * 2);
  octx.closePath();
  octx.fill();
  return off;
}

function buildSparkleSprite(): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = 24;
  off.height = 24;
  const octx = off.getContext("2d");
  if (!octx) return off;

  const grad = octx.createRadialGradient(12, 12, 1, 12, 12, 11);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.45, "rgba(224, 242, 254, 0.7)");
  grad.addColorStop(1, "rgba(224, 242, 254, 0)");
  octx.fillStyle = grad;
  octx.fillRect(0, 0, 24, 24);
  return off;
}

export const SkyOceanScene: React.FC<SkyOceanSceneProps> = React.memo(
  ({ paused = false }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (paused) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;

      const SCALE = 0.5; // Soft ambient ocean scene: 75% lower GPU pixel fill-rate
      let width = Math.max(1, Math.floor(window.innerWidth * SCALE));
      let height = Math.max(1, Math.floor(window.innerHeight * SCALE));
      canvas.width = width;
      canvas.height = height;

      const cloudSprite = buildCloudSprite();
      const sparkleSprite = buildSparkleSprite();

      const waveDefs = [
        { yRatio: 0.64, amp: 14, freq: 0.006, speedMult: 0.9, top: "#7dd3fc", bottom: "#38bdf8", alpha: 0.55 },
        { yRatio: 0.71, amp: 17, freq: 0.0072, speedMult: -1.15, top: "#60a5fa", bottom: "#0284c7", alpha: 0.55 },
        { yRatio: 0.79, amp: 15, freq: 0.0085, speedMult: 1.35, top: "#93c5fd", bottom: "#0369a1", alpha: 0.6 },
        { yRatio: 0.87, amp: 12, freq: 0.0105, speedMult: -1.6, top: "#bae6fd", bottom: "#0284c7", alpha: 0.5 },
      ];

      // Cache wave gradients (only recomputed on resize instead of 240x/sec!)
      let waveGrads: CanvasGradient[] = [];
      const rebuildWaveGrads = () => {
        waveGrads = waveDefs.map((w) => {
          const baseY = height * w.yRatio;
          const g = ctx.createLinearGradient(0, baseY - w.amp, 0, height);
          g.addColorStop(0, w.top);
          g.addColorStop(1, w.bottom);
          return g;
        });
      };
      rebuildWaveGrads();

      let resizeTimer: number | null = null;
      const handleResize = () => {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          if (!canvas) return;
          width = Math.max(1, Math.floor(window.innerWidth * SCALE));
          height = Math.max(1, Math.floor(window.innerHeight * SCALE));
          canvas.width = width;
          canvas.height = height;
          rebuildWaveGrads();
        }, 150);
      };
      window.addEventListener("resize", handleResize, { passive: true });

      const clouds: Cloud[] = Array.from({ length: 5 }, (_, i) => ({
        x: (width / 4.8) * i + Math.random() * 80,
        y: height * (0.06 + Math.random() * 0.32),
        scale: (0.65 + Math.random() * 0.75) * SCALE,
        speed: (0.18 + Math.random() * 0.24) * SCALE,
        opacity: 0.28 + Math.random() * 0.24,
      }));

      const sparkles: Sparkle[] = Array.from({ length: 22 }, () => ({
        x: Math.random() * width,
        y: height * (0.63 + Math.random() * 0.34),
        r: (4.5 + Math.random() * 5.5) * SCALE,
        phase: Math.random() * Math.PI * 2,
        speed: 0.03 + Math.random() * 0.038,
      }));

      let t = 0;
      let animId = 0;
      let lastFrameTime = performance.now();
      const FRAME_INTERVAL = 1000 / 20; // Gentle 20fps cap for ambient waves

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        const elapsed = now - lastFrameTime;
        if (elapsed < FRAME_INTERVAL) return;
        const dt = Math.min(2.5, elapsed / 16.67);
        lastFrameTime = now - (elapsed % FRAME_INTERVAL);

        ctx.clearRect(0, 0, width, height);
        t += 0.022 * dt;

        // 1. Pre-rendered drifting pastel sky clouds (zero shadowBlur cost!)
        for (let i = 0; i < clouds.length; i++) {
          const c = clouds[i];
          c.x += c.speed * dt;
          if (c.x - 140 > width) {
            c.x = -190;
            c.y = height * (0.06 + Math.random() * 0.32);
          }
          ctx.globalAlpha = c.opacity;
          ctx.drawImage(
            cloudSprite,
            c.x,
            c.y,
            cloudSprite.width * c.scale,
            cloudSprite.height * c.scale
          );
        }

        // 2. 4 layered animated pastel ocean waves using cached gradients
        const stepX = 36;
        for (let wIdx = 0; wIdx < waveDefs.length; wIdx++) {
          const w = waveDefs[wIdx];
          const baseY = height * w.yRatio;
          const amp = w.amp * SCALE;
          ctx.globalAlpha = w.alpha;
          ctx.fillStyle = waveGrads[wIdx];

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width + stepX; x += stepX) {
            const y =
              baseY +
              Math.sin(x * w.freq + t * w.speedMult) * amp +
              Math.cos(x * w.freq * 0.6 - t * w.speedMult * 0.7) * (amp * 0.45);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        }

        // 3. Pre-rendered shimmering ocean sparkles
        for (let i = 0; i < sparkles.length; i++) {
          const s = sparkles[i];
          s.phase += s.speed * dt;
          const sinVal = Math.sin(s.phase);
          ctx.globalAlpha = 0.2 + 0.7 * sinVal * sinVal;
          const sx = s.x + Math.sin(t + s.phase) * 5 * SCALE;
          const size = s.r * 2;
          ctx.drawImage(sparkleSprite, sx - s.r, s.y - s.r, size, size);
        }

        ctx.globalAlpha = 1;
      };

      animId = requestAnimationFrame(render);

      return () => {
        cancelAnimationFrame(animId);
        if (resizeTimer) window.clearTimeout(resizeTimer);
        window.removeEventListener("resize", handleResize);
      };
    }, [paused]);

    return (
      <div className="sky-ocean-ambient-backdrop pointer-events-none fixed inset-0 z-0 opacity-100 transition-opacity duration-700 overflow-hidden select-none">
        {/* Bright Pastel Sky Blue & Coastal Horizon Backdrop */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #60b6fb 0%, #86cdfd 38%, #aee2ff 64%, #52b6f7 82%, #2994e2 100%)",
          }}
        />

        {/* Warm Sunlit Pastel Halo at Horizon (soft radial gradient — zero blur filter needed) */}
        <div
          className="absolute left-1/2 top-[14%] -translate-x-1/2 h-80 w-80 sm:h-[520px] sm:w-[520px] rounded-full opacity-50"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(224,242,254,0.45) 38%, transparent 72%)",
          }}
        />

        {/* Animated Clouds, Rolling Pastel Waves & Shimmering Ocean Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    );
  }
);

SkyOceanScene.displayName = "SkyOceanScene";
