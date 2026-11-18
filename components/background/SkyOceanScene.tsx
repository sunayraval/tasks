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

export const SkyOceanScene: React.FC<SkyOceanSceneProps> = ({
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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

    // Fluffy drifting pastel clouds
    const clouds: Cloud[] = Array.from({ length: 7 }, (_, i) => ({
      x: (width / 6) * i + Math.random() * 120,
      y: height * (0.08 + Math.random() * 0.34),
      scale: 0.7 + Math.random() * 0.85,
      speed: 0.18 + Math.random() * 0.25,
      opacity: 0.28 + Math.random() * 0.25,
    }));

    // Sunlit ocean sparkles
    const sparkles: Sparkle[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: height * (0.62 + Math.random() * 0.36),
      r: 1.5 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.03 + Math.random() * 0.04,
    }));

    let t = 0;

    const drawCloud = (c: Cloud) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.globalAlpha = c.opacity;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.arc(34, -10, 46, 0, Math.PI * 2);
      ctx.arc(76, -4, 38, 0, Math.PI * 2);
      ctx.arc(108, 6, 28, 0, Math.PI * 2);
      ctx.arc(-30, 8, 28, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawWaveLayer = (
      baseY: number,
      amp: number,
      freq: number,
      speedMult: number,
      topColor: string,
      bottomColor: string,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(0, baseY - amp, 0, height);
      grad.addColorStop(0, topColor);
      grad.addColorStop(1, bottomColor);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width + 20; x += 20) {
        const y =
          baseY +
          Math.sin(x * freq + t * speedMult) * amp +
          Math.cos(x * freq * 0.6 - t * speedMult * 0.7) * (amp * 0.45);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      t += 0.022;

      // 1. Draw drifting pastel sky clouds
      for (const c of clouds) {
        c.x += c.speed;
        if (c.x - 160 > width) {
          c.x = -180;
          c.y = height * (0.08 + Math.random() * 0.34);
        }
        drawCloud(c);
      }

      // 2. Draw 4 layered animated pastel ocean waves
      drawWaveLayer(
        height * 0.64,
        16,
        0.0045,
        0.9,
        "#7dd3fc",
        "#38bdf8",
        0.55
      );
      drawWaveLayer(
        height * 0.71,
        20,
        0.0055,
        -1.15,
        "#60a5fa",
        "#0284c7",
        0.55
      );
      drawWaveLayer(
        height * 0.79,
        18,
        0.0065,
        1.35,
        "#93c5fd",
        "#0369a1",
        0.6
      );
      drawWaveLayer(
        height * 0.87,
        14,
        0.008,
        -1.6,
        "#bae6fd",
        "#0284c7",
        0.5
      );

      // 3. Draw shimmering water sparkles
      for (const s of sparkles) {
        s.phase += s.speed;
        const alpha = 0.2 + 0.7 * Math.pow(Math.sin(s.phase), 2);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#e0f2fe";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(
          s.x + Math.sin(t + s.phase) * 6,
          s.y,
          s.r,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
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
    <div className="sky-ocean-ambient-backdrop pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-1000 overflow-hidden select-none">
      {/* Bright Pastel Sky Blue & Coastal Horizon Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #60b6fb 0%, #86cdfd 38%, #aee2ff 64%, #52b6f7 82%, #2994e2 100%)",
        }}
      />

      {/* Warm Sunlit Pastel Halo at Horizon */}
      <div
        className="absolute left-1/2 top-[18%] -translate-x-1/2 h-72 w-72 sm:h-[420px] sm:w-[420px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, #ffffff 0%, #e0f2fe 45%, transparent 75%)",
        }}
      />

      {/* Animated Clouds, Rolling Pastel Waves & Shimmering Ocean Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
