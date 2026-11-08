"use client";

import React, { useEffect, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";
import { normalizeVideoPreset, VideoPresetName } from "@/types/taskit";
import { BatteryCharging, PauseCircle } from "lucide-react";

export const IDB_VIDEO_KEY = "custom_video_bg";

interface VideoBackgroundProps {
  preset: VideoPresetName | string;
  dim: number; // 0.1 to 0.85
  blur: number; // 0 to 24 (px)
  customVideoVersion?: number;
}

export async function saveCustomVideoToIDB(file: File): Promise<void> {
  await set(IDB_VIDEO_KEY, file);
}

export async function clearCustomVideoFromIDB(): Promise<void> {
  await del(IDB_VIDEO_KEY);
}

export const VideoBackground: React.FC<VideoBackgroundProps> = ({
  preset: rawPreset,
  dim,
  blur,
  customVideoVersion = 0,
}) => {
  const preset = normalizeVideoPreset(rawPreset);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [isPausedBySaver, setIsPausedBySaver] = useState<boolean>(false);
  const [batterySaverActive, setBatterySaverActive] = useState<boolean>(false);

  // Load custom IndexedDB blob when preset === "custom"
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
        setVideoSrc("");
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
          videoRef.current.play().catch(() => {});
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

  // Zero-bandwidth procedural ambient canvas engine (rain animation completely removed)
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

    const count = preset === "aurora" ? 0 : preset === "cyber" ? 70 : 60;
    const items = Array.from({ length: count }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speedX:
        preset === "cyber"
          ? (Math.random() - 0.5) * 0.9
          : (Math.random() - 0.5) * 0.35,
      speedY:
        preset === "cyber"
          ? (Math.random() - 0.5) * 0.9
          : -0.3 - Math.random() * 0.5,
      radius: 1.8 + Math.random() * 4,
      alpha: 0.22 + Math.random() * 0.5,
      phase: idx * 0.4,
    }));

    let tick = 0;

    const render = () => {
      if (!isPausedBySaver && !videoLoaded) {
        tick += 0.012;
        ctx.clearRect(0, 0, width, height);

        const computedStyle = getComputedStyle(document.documentElement);
        const primary =
          computedStyle.getPropertyValue("--primary").trim() || "#00e5ff";
        const highlight =
          computedStyle.getPropertyValue("--highlight").trim() || "#a8f9ff";
        const surface =
          computedStyle.getPropertyValue("--surface").trim() || "#0a3c44";
        const accent =
          computedStyle.getPropertyValue("--accent").trim() || "#136f7a";

        // Primary moving aurora glow
        const grad1 = ctx.createRadialGradient(
          width * (0.35 + Math.sin(tick * 0.5) * 0.2),
          height * (0.28 + Math.cos(tick * 0.4) * 0.15),
          20,
          width * 0.4,
          height * 0.4,
          Math.max(width, height) * 0.75
        );
        grad1.addColorStop(0, `${accent}99`);
        grad1.addColorStop(0.5, `${surface}66`);
        grad1.addColorStop(1, "transparent");
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);

        // Secondary accent glow
        const grad2 = ctx.createRadialGradient(
          width * (0.72 + Math.cos(tick * 0.35) * 0.15),
          height * (0.68 + Math.sin(tick * 0.45) * 0.15),
          30,
          width * 0.7,
          height * 0.7,
          Math.max(width, height) * 0.65
        );
        grad2.addColorStop(0, `${primary}44`);
        grad2.addColorStop(0.6, `${surface}44`);
        grad2.addColorStop(1, "transparent");
        ctx.fillStyle = grad2;
        ctx.fillRect(0, 0, width, height);

        if (preset === "cyber") {
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
            ctx.arc(a.x, a.y, a.radius * 0.85, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < items.length; j++) {
              const b = items[j];
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 140) {
                ctx.globalAlpha = (1 - dist / 140) * 0.3;
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        } else if (preset === "lofi") {
          for (const orb of items) {
            orb.x += Math.sin(tick + orb.phase) * 0.35;
            orb.y += orb.speedY * 0.45;
            if (orb.y < -40) {
              orb.y = height + 40;
              orb.x = Math.random() * width;
            }
            ctx.globalAlpha =
              orb.alpha * (0.55 + 0.3 * Math.sin(tick * 2 + orb.phase));
            const orbGrad = ctx.createRadialGradient(
              orb.x,
              orb.y,
              1,
              orb.x,
              orb.y,
              orb.radius * 10
            );
            orbGrad.addColorStop(0, highlight);
            orbGrad.addColorStop(0.5, primary);
            orbGrad.addColorStop(1, "transparent");
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.radius * 10, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (preset === "particles") {
          for (const p of items) {
            p.x += p.speedX;
            p.y += p.speedY;
            if (p.y < -10) p.y = height + 10;
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.globalAlpha =
              p.alpha * (0.65 + 0.35 * Math.sin(tick * 3 + p.phase));
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

  const safeDim = Math.min(0.85, Math.max(0.1, dim));
  const safeBlur = Math.min(24, Math.max(0, blur));

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Rich multi-stop theme gradient backdrop */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `
            radial-gradient(circle at 15% 15%, var(--accent) 0%, transparent 45%),
            radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--primary) 35%, transparent) 0%, transparent 45%),
            radial-gradient(circle at 50% 85%, var(--surface) 0%, var(--bg-base) 75%),
            var(--bg-base)
          `,
        }}
      />

      {/* Zero-bandwidth procedural canvas layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover opacity-95"
      />

      {/* Fullscreen fixed HTML5 Video element for IndexedDB custom uploads */}
      {videoSrc && (
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
      )}

      {/* Theme-tinted Frosted Glass & Dim Overlay */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          backgroundColor: `color-mix(in srgb, var(--bg-base) ${Math.round(
            safeDim * 100
          )}%, transparent)`,
          backdropFilter: `blur(${safeBlur}px)`,
          WebkitBackdropFilter: `blur(${safeBlur}px)`,
        }}
      />

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
