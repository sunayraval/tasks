"use client";

import React, { useEffect, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";
import { VideoPresetName } from "@/types/taskit";
import { BatteryCharging, PauseCircle, PlayCircle, Sparkles } from "lucide-react";

export const IDB_VIDEO_KEY = "custom_video_bg";

interface VideoBackgroundProps {
  preset: VideoPresetName;
  dim: number; // 0.2 to 0.85
  blur: number; // 0 to 24 (px)
  customVideoVersion?: number; // bumped when user uploads a new custom blob
  showQuickControls?: boolean;
  onUpdateDim?: (dim: number) => void;
  onUpdateBlur?: (blur: number) => void;
}

export async function saveCustomVideoToIDB(file: File): Promise<void> {
  await set(IDB_VIDEO_KEY, file);
}

export async function clearCustomVideoFromIDB(): Promise<void> {
  await del(IDB_VIDEO_KEY);
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  preset,
  dim,
  blur,
  customVideoVersion = 0,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>(`/bg/${preset}.webm`);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [isPausedBySaver, setIsPausedBySaver] = useState<boolean>(false);
  const [batterySaverActive, setBatterySaverActive] = useState<boolean>(false);

  // Load either custom IndexedDB blob or preset path
  useEffect(() => {
    let objectUrl: string | null = null;
    let isMounted = true;

    async function resolveSource() {
      setVideoLoaded(false);
      if (preset === "custom") {
        try {
          const blob = await get<Blob>(IDB_VIDEO_KEY);
          if (blob && isMounted) {
            objectUrl = URL.createObjectURL(blob);
            setVideoSrc(objectUrl);
            return;
          }
        } catch (err) {
          console.error("Failed reading custom video from IndexedDB:", err);
        }
      }
      if (isMounted) {
        setVideoSrc(`/bg/${preset === "custom" ? "rain" : preset}.webm`);
      }
    }

    resolveSource();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [preset, customVideoVersion]);

  // Battery-saver & Window Blur / Visibility auto-pause listener
  useEffect(() => {
    const handleVisibilityOrBlur = () => {
      const shouldPause = document.hidden;
      setIsPausedBySaver(shouldPause || batterySaverActive);
      if (videoRef.current) {
        if (shouldPause || batterySaverActive) {
          videoRef.current.pause();
        } else {
          videoRef.current.play().catch(() => {
            // Autoplay blocked or fallback active
          });
        }
      }
    };

    const handleWindowBlur = () => {
      setIsPausedBySaver(true);
      videoRef.current?.pause();
    };

    const handleWindowFocus = () => {
      if (!batterySaverActive) {
        setIsPausedBySaver(false);
        videoRef.current?.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    // Check Web Battery API for low battery auto-pause
    let batteryObj: {
      level: number;
      charging: boolean;
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    } | null = null;

    const checkBattery = () => {
      if (!batteryObj) return;
      const isLow = !batteryObj.charging && batteryObj.level <= 0.2;
      setBatterySaverActive(isLow);
      if (isLow) {
        setIsPausedBySaver(true);
        videoRef.current?.pause();
      }
    };

    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (
        navigator as Navigator & {
          getBattery: () => Promise<typeof batteryObj>;
        }
      )
        .getBattery()
        .then((bat) => {
          batteryObj = bat;
          checkBattery();
          bat?.addEventListener("levelchange", checkBattery);
          bat?.addEventListener("chargingchange", checkBattery);
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      if (batteryObj) {
        batteryObj.removeEventListener("levelchange", checkBattery);
        batteryObj.removeEventListener("chargingchange", checkBattery);
      }
    };
  }, [batterySaverActive]);

  // Zero-bandwidth procedural ambient canvas engine (renders seamlessly behind/when WebM is not loaded)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Create particles tailored to preset
    const count = preset === "rain" ? 110 : preset === "cyber" ? 65 : 55;
    const items = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 14 + Math.random() * 26,
      speedX:
        preset === "rain"
          ? -0.6
          : preset === "cyber"
          ? (Math.random() - 0.5) * 0.9
          : (Math.random() - 0.5) * 0.35,
      speedY:
        preset === "rain"
          ? 7 + Math.random() * 6
          : preset === "cyber"
          ? (Math.random() - 0.5) * 0.9
          : -0.3 - Math.random() * 0.5,
      radius: 1.5 + Math.random() * 3.5,
      alpha: 0.15 + Math.random() * 0.45,
      phase: idx * 0.4,
    }));

    let tick = 0;

    const render = () => {
      if (!isPausedBySaver && !videoLoaded) {
        tick += 0.012;
        ctx.clearRect(0, 0, width, height);

        const computedStyle = getComputedStyle(document.documentElement);
        const primary =
          computedStyle.getPropertyValue("--primary").trim() || "#0FA4AF";
        const highlight =
          computedStyle.getPropertyValue("--highlight").trim() || "#AFDDE5";
        const surface =
          computedStyle.getPropertyValue("--surface").trim() || "#024950";

        // Ambient radial aurora gradient
        const grad = ctx.createRadialGradient(
          width * (0.5 + Math.sin(tick * 0.5) * 0.18),
          height * (0.35 + Math.cos(tick * 0.4) * 0.12),
          40,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.85
        );
        grad.addColorStop(0, `${surface}aa`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        if (preset === "rain") {
          ctx.strokeStyle = highlight;
          ctx.lineWidth = 1.2;
          for (const drop of items) {
            ctx.globalAlpha = drop.alpha * 0.65;
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + drop.speedX * 3, drop.y + drop.len);
            ctx.stroke();

            drop.x += drop.speedX;
            drop.y += drop.speedY;
            if (drop.y > height) {
              drop.y = -25;
              drop.x = Math.random() * width;
            }
            if (drop.x < 0) drop.x = width;
          }
        } else if (preset === "cyber") {
          // Futuristic cyber grid & nodes
          ctx.strokeStyle = primary;
          for (let i = 0; i < items.length; i++) {
            const a = items[i];
            a.x += a.speedX;
            a.y += a.speedY;
            if (a.x < 0 || a.x > width) a.speedX *= -1;
            if (a.y < 0 || a.y > height) a.speedY *= -1;

            ctx.globalAlpha = a.alpha;
            ctx.fillStyle = highlight;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.radius * 0.75, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < items.length; j++) {
              const b = items[j];
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 130) {
                ctx.globalAlpha = (1 - dist / 130) * 0.22;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        } else if (preset === "lofi") {
          // Warm floating bokeh orbs
          for (const orb of items) {
            orb.x += Math.sin(tick + orb.phase) * 0.35;
            orb.y += orb.speedY * 0.45;
            if (orb.y < -40) {
              orb.y = height + 40;
              orb.x = Math.random() * width;
            }
            ctx.globalAlpha =
              orb.alpha * (0.45 + 0.25 * Math.sin(tick * 2 + orb.phase));
            const orbGrad = ctx.createRadialGradient(
              orb.x,
              orb.y,
              1,
              orb.x,
              orb.y,
              orb.radius * 9
            );
            orbGrad.addColorStop(0, highlight);
            orbGrad.addColorStop(0.5, primary);
            orbGrad.addColorStop(1, "transparent");
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.radius * 9, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Particles / Custom fallback
          for (const p of items) {
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.y < -10) p.y = height + 10;
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.globalAlpha =
              p.alpha * (0.6 + 0.4 * Math.sin(tick * 3 + p.phase));
            ctx.fillStyle = highlight;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [preset, isPausedBySaver, videoLoaded]);

  // Clamp dim between 0.20 and 0.85 as specified
  const safeDim = Math.min(0.85, Math.max(0.2, dim));
  // Clamp blur between 0 and 24px
  const safeBlur = Math.min(24, Math.max(0, blur));

  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Base theme gradient backdrop */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, var(--surface) 0%, var(--bg-base) 70%)",
        }}
      />

      {/* Zero-bandwidth procedural canvas layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover opacity-90"
      />

      {/* Fullscreen fixed HTML5 Video element for WebM presets & IndexedDB custom uploads */}
      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        onError={() => setVideoLoaded(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          videoLoaded ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Frosted glass & dim overlay */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${safeDim})`,
          backdropFilter: `blur(${safeBlur}px)`,
          WebkitBackdropFilter: `blur(${safeBlur}px)`,
        }}
      />

      {/* Subtle status badge in bottom-left when battery-saver / auto-pause is active */}
      {isPausedBySaver && (
        <div className="fixed bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-3 py-1 text-[11px] text-white/70 backdrop-blur-md">
          {batterySaverActive ? (
            <>
              <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
              <span>Battery Saver: Background Paused</span>
            </>
          ) : (
            <>
              <PauseCircle className="w-3.5 h-3.5 text-primary" />
              <span>Eco Mode: Background Paused</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

