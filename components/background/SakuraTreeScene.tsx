"use client";

import React, { useEffect, useRef } from "react";

interface SakuraTreeSceneProps {
  paused?: boolean;
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  swayPhase: number;
  swayAmp: number;
  flipPhase: number;
  flipSpeed: number;
  opacity: number;
  spriteIdx: number;
}

/**
 * Pre-renders 3 cherry-blossom petal sprites once onto tiny offscreen canvases.
 * Eliminates expensive per-frame createRadialGradient() + ctx.shadowBlur software blurs (~20x faster).
 */
function buildPetalSprites(): HTMLCanvasElement[] {
  const palettes: Array<[string, string]> = [
    ["#fff0f6", "#ff9ec9"],
    ["#ffd6e7", "#ff7eb6"],
    ["#ffc2dc", "#ec4899"],
  ];

  return palettes.map(([c0, c1]) => {
    const off = document.createElement("canvas");
    const dim = 48;
    off.width = dim;
    off.height = dim;
    const octx = off.getContext("2d");
    if (!octx) return off;

    octx.translate(dim / 2, dim / 2);
    const s = 14;
    const grad = octx.createRadialGradient(0, -s * 0.2, 1, 0, 0, s);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);

    octx.fillStyle = grad;
    octx.shadowColor = "rgba(255, 126, 182, 0.45)";
    octx.shadowBlur = 7;

    octx.beginPath();
    octx.moveTo(0, s * 0.85);
    octx.bezierCurveTo(-s * 0.75, s * 0.25, -s * 0.65, -s * 0.75, -s * 0.18, -s * 0.85);
    octx.lineTo(0, -s * 0.6);
    octx.lineTo(s * 0.18, -s * 0.85);
    octx.bezierCurveTo(s * 0.65, -s * 0.75, s * 0.75, s * 0.25, 0, s * 0.85);
    octx.closePath();
    octx.fill();
    return off;
  });
}

export const SakuraTreeScene: React.FC<SakuraTreeSceneProps> = React.memo(
  ({ paused = false }) => {
    const petalCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (paused) return;
      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const canvas = petalCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;

      const SCALE = 0.75; // Soft ambient canvas: 56% fewer pixels to rasterize
      let width = Math.max(1, Math.floor(window.innerWidth * SCALE));
      let height = Math.max(1, Math.floor(window.innerHeight * SCALE));
      canvas.width = width;
      canvas.height = height;

      let resizeTimer: number | null = null;
      const handleResize = () => {
        if (resizeTimer) window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          if (!canvas) return;
          width = Math.max(1, Math.floor(window.innerWidth * SCALE));
          height = Math.max(1, Math.floor(window.innerHeight * SCALE));
          canvas.width = width;
          canvas.height = height;
        }, 150);
      };
      window.addEventListener("resize", handleResize, { passive: true });

      const sprites = buildPetalSprites();
      const PETAL_COUNT = 38;

      const createPetal = (randomY = false): Petal => ({
        x: Math.random() * (width + 160) - 40,
        y: randomY ? Math.random() * height : -20 - Math.random() * 80,
        vx: (-0.45 - Math.random() * 0.7) * SCALE,
        vy: (0.75 + Math.random() * 1.1) * SCALE,
        size: (12 + Math.random() * 14) * SCALE,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.035,
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: (0.4 + Math.random() * 0.8) * SCALE,
        flipPhase: Math.random() * Math.PI * 2,
        flipSpeed: 0.02 + Math.random() * 0.032,
        opacity: 0.48 + Math.random() * 0.44,
        spriteIdx: Math.floor(Math.random() * sprites.length),
      });

      const petals: Petal[] = Array.from({ length: PETAL_COUNT }, () =>
        createPetal(true)
      );

      let animId = 0;
      let lastFrameTime = performance.now();
      const FRAME_INTERVAL = 1000 / 30; // Silky 30fps cap for ambient background

      const render = (now: number) => {
        animId = requestAnimationFrame(render);
        const elapsed = now - lastFrameTime;
        if (elapsed < FRAME_INTERVAL) return;
        const dt = Math.min(2.5, elapsed / 16.67);
        lastFrameTime = now - (elapsed % FRAME_INTERVAL);

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < petals.length; i++) {
          const p = petals[i];
          p.swayPhase += 0.022 * dt;
          p.flipPhase += p.flipSpeed * dt;
          p.rotation += p.rotSpeed * dt;

          p.x += (p.vx + Math.sin(p.swayPhase) * p.swayAmp) * dt;
          p.y += p.vy * dt;

          if (p.y > height + 30 || p.x < -70) {
            if (Math.random() > 0.45) {
              petals[i] = {
                ...createPetal(false),
                x: width * (0.45 + Math.random() * 0.55),
                y: height * (0.05 + Math.random() * 0.35),
              };
            } else {
              petals[i] = createPetal(false);
            }
            continue;
          }

          const scaleY = 0.45 + 0.55 * Math.abs(Math.cos(p.flipPhase));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.scale(1, scaleY);
          ctx.globalAlpha = p.opacity;
          const half = p.size;
          ctx.drawImage(sprites[p.spriteIdx], -half, -half, half * 2, half * 2);
          ctx.restore();
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
      <div className="sakura-ambient-backdrop pointer-events-none fixed inset-0 z-0 opacity-100 transition-opacity duration-700 overflow-hidden select-none">
        {/* Moonlit Sakura Twilight Glow */}
        <div
          className="absolute right-[8%] top-[10%] h-56 w-56 sm:h-80 sm:w-80 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, #ffd6e7 0%, #ff7eb6 45%, transparent 75%)",
          }}
        />

        {/* Artistic Animated Sakura Cherry Blossom Tree Silhouette & Canopy (Bottom-Right) */}
        <svg
          viewBox="0 0 800 700"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-sakura-tree-sway absolute right-[-60px] bottom-[-20px] w-[440px] sm:w-[680px] lg:w-[820px] h-auto opacity-85"
        >
          <defs>
            <radialGradient id="blossomCloud1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd6e7" stopOpacity="0.92" />
              <stop offset="55%" stopColor="#ff7eb6" stopOpacity="0.72" />
              <stop offset="100%" stopColor="#be185d" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blossomCloud2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff0f6" stopOpacity="0.88" />
              <stop offset="55%" stopColor="#f472b6" stopOpacity="0.68" />
              <stop offset="100%" stopColor="#9d174d" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="trunkGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1b0912" />
              <stop offset="100%" stopColor="#3b1528" />
            </linearGradient>
          </defs>

          <path
            d="M660 700 C650 580, 635 490, 580 410 C530 335, 440 285, 340 245 C270 218, 210 210, 150 225 C220 200, 290 198, 365 225 C430 248, 495 280, 545 335 C565 270, 595 210, 650 160 C610 225, 590 290, 595 365 C645 315, 705 280, 770 260 C715 295, 665 340, 625 405 C675 495, 705 585, 725 700 Z"
            fill="url(#trunkGrad)"
          />
          <path
            d="M495 295 C440 245, 395 190, 355 130 C405 180, 455 230, 520 278 Z"
            fill="url(#trunkGrad)"
          />
          <path
            d="M360 232 C310 265, 255 290, 195 300 C255 275, 305 248, 345 218 Z"
            fill="url(#trunkGrad)"
          />

          <circle cx="340" cy="180" r="145" fill="url(#blossomCloud1)" />
          <circle cx="520" cy="155" r="160" fill="url(#blossomCloud2)" />
          <circle cx="655" cy="215" r="140" fill="url(#blossomCloud1)" />
          <circle cx="215" cy="235" r="115" fill="url(#blossomCloud2)" />
          <circle cx="445" cy="245" r="125" fill="url(#blossomCloud1)" />
          <circle cx="590" cy="285" r="110" fill="url(#blossomCloud2)" />
          <circle cx="715" cy="295" r="105" fill="url(#blossomCloud1)" />
        </svg>

        {/* Falling 3D-Tumbling Sakura Petals Canvas */}
        <canvas
          ref={petalCanvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }
);

SakuraTreeScene.displayName = "SakuraTreeScene";
