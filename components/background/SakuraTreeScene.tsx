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
  hueShift: number;
}

export const SakuraTreeScene: React.FC<SakuraTreeSceneProps> = ({
  paused = false,
}) => {
  const petalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = petalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const PETAL_COUNT = 52;
    const createPetal = (randomY = false): Petal => ({
      x: Math.random() * (width + 200) - 50,
      y: randomY ? Math.random() * height : -20 - Math.random() * 100,
      vx: -0.45 - Math.random() * 0.75, // Gentle breeze drifting right-to-left
      vy: 0.75 + Math.random() * 1.15,
      size: 6 + Math.random() * 9,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.035,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 0.4 + Math.random() * 0.85,
      flipPhase: Math.random() * Math.PI * 2,
      flipSpeed: 0.02 + Math.random() * 0.035,
      opacity: 0.45 + Math.random() * 0.45,
      hueShift: Math.random(),
    });

    const petals: Petal[] = Array.from({ length: PETAL_COUNT }, () =>
      createPetal(true)
    );

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      // 3D tumbling perspective scale
      const scaleY = 0.45 + 0.55 * Math.abs(Math.cos(p.flipPhase));
      ctx.scale(1, scaleY);

      ctx.globalAlpha = p.opacity;

      // Soft cherry blossom petal gradient
      const grad = ctx.createRadialGradient(0, -p.size * 0.2, 1, 0, 0, p.size);
      if (p.hueShift > 0.65) {
        grad.addColorStop(0, "#fff0f6");
        grad.addColorStop(1, "#ff9ec9");
      } else if (p.hueShift > 0.3) {
        grad.addColorStop(0, "#ffd6e7");
        grad.addColorStop(1, "#ff7eb6");
      } else {
        grad.addColorStop(0, "#ffc2dc");
        grad.addColorStop(1, "#ec4899");
      }

      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(255, 126, 182, 0.45)";
      ctx.shadowBlur = 8;

      // Draw authentic notched sakura petal shape
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.bezierCurveTo(-s * 0.75, s * 0.25, -s * 0.65, -s * 0.75, -s * 0.18, -s * 0.85);
      ctx.lineTo(0, -s * 0.6);
      ctx.lineTo(s * 0.18, -s * 0.85);
      ctx.bezierCurveTo(s * 0.65, -s * 0.75, s * 0.75, s * 0.25, 0, s * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.swayPhase += 0.022;
        p.flipPhase += p.flipSpeed;
        p.rotation += p.rotSpeed;

        p.x += p.vx + Math.sin(p.swayPhase) * p.swayAmp;
        p.y += p.vy;

        if (p.y > height + 30 || p.x < -80) {
          // Respawn either from the top or near the right-side sakura canopy
          if (Math.random() > 0.45) {
            petals[i] = {
              ...createPetal(false),
              x: width * (0.45 + Math.random() * 0.55),
              y: height * (0.05 + Math.random() * 0.35),
            };
          } else {
            petals[i] = createPetal(false);
          }
        }

        drawPetal(p);
      }

      if (!paused) {
        animId = requestAnimationFrame(render);
      }
    };

    if (!paused) {
      render();
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [paused]);

  return (
    <div className="sakura-ambient-backdrop pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-1000 overflow-hidden select-none">
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

        {/* Gnarled Sakura Trunk & Sweeping Branches */}
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

        {/* Soft Glowing Cherry Blossom Canopy Clusters */}
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
};
