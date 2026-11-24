"use client";

import React, { useEffect, useRef, useState } from "react";
import { get, set, del } from "idb-keyval";
import { normalizeVideoPreset, ThemeName, VideoPresetName } from "@/types/taskit";
import { BatteryCharging, PauseCircle } from "lucide-react";
import { SharinganIcon } from "@/components/ui/SharinganIcon";
import { SakuraTreeScene } from "@/components/background/SakuraTreeScene";
import { SkyOceanScene } from "@/components/background/SkyOceanScene";

export const IDB_VIDEO_KEY = "custom_video_bg";

interface VideoBackgroundProps {
  preset: VideoPresetName | string;
  theme?: ThemeName;
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

export const VideoBackground: React.FC<VideoBackgroundProps> = React.memo(
  ({ preset: rawPreset, theme, dim, blur, customVideoVersion = 0 }) => {
    const preset = normalizeVideoPreset(rawPreset);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [videoSrc, setVideoSrc] = useState<string>("");
    const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
    const [isPausedBySaver, setIsPausedBySaver] = useState<boolean>(false);
    const [batterySaverActive, setBatterySaverActive] = useState<boolean>(false);

    // Cache theme colors outside rAF so we NEVER call getComputedStyle() inside animation frames
    const themeColorsRef = useRef({
      primary: "#00e5ff",
      highlight: "#a8f9ff",
      surface: "#0a3c44",
      accent: "#136f7a",
    });

    const isSakura = theme === "sakura";
    const isSkyOcean = theme === "sky_ocean";
    const isSharingan = theme === "sharingan";
    const shouldRunProceduralCanvas =
      !isSakura && !isSkyOcean && !isPausedBySaver && !videoLoaded;

    // Refresh cached theme colors ONLY when theme or inline root styles change
    useEffect(() => {
      if (typeof window === "undefined") return;

      const syncColors = () => {
        const style = getComputedStyle(document.documentElement);
        themeColorsRef.current = {
          primary: style.getPropertyValue("--primary").trim() || "#00e5ff",
          highlight: style.getPropertyValue("--highlight").trim() || "#a8f9ff",
          surface: style.getPropertyValue("--surface").trim() || "#0a3c44",
          accent: style.getPropertyValue("--accent").trim() || "#136f7a",
        };
      };

      // Defer one micro-frame after data-theme attribute updates
      const raf = requestAnimationFrame(syncColors);
      const observer = new MutationObserver(syncColors);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "style"],
      });

      return () => {
        cancelAnimationFrame(raf);
        observer.disconnect();
      };
    }, [theme]);

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

    // Low-overhead 30fps procedural ambient canvas engine (only runs when active & visible)
    useEffect(() => {
      if (!shouldRunProceduralCanvas) return;
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

      const SCALE = 0.5; // Ambient aurora/particles look identical at 0.5x with 75% less GPU fill work
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

      const count = preset === "aurora" ? 0 : preset === "cyber" ? 32 : 28;
      const items = Array.from({ length: count }, (_, idx) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        speedX:
          (preset === "cyber"
            ? (Math.random() - 0.5) * 0.9
            : (Math.random() - 0.5) * 0.35) * SCALE,
        speedY:
          (preset === "cyber"
            ? (Math.random() - 0.5) * 0.9
            : -0.3 - Math.random() * 0.5) * SCALE,
        radius: (1.8 + Math.random() * 3.6) * SCALE,
        alpha: 0.22 + Math.random() * 0.5,
        phase: idx * 0.4,
      }));

      let tick = 0;
      let animationFrameId = 0;
      let lastFrame = performance.now();
      const FRAME_INTERVAL = 1000 / 20; // 20fps cap for smooth, ultra-low-CPU ambient motion
      const cyberDistMax = 135 * SCALE;
      const cyberDistMaxSq = cyberDistMax * cyberDistMax;

      const render = (now: number) => {
        animationFrameId = requestAnimationFrame(render);
        const elapsed = now - lastFrame;
        if (elapsed < FRAME_INTERVAL) return;
        const dt = Math.min(2.5, elapsed / 16.67);
        lastFrame = now - (elapsed % FRAME_INTERVAL);

        tick += 0.012 * dt;
        ctx.clearRect(0, 0, width, height);

        const { primary, highlight, surface, accent } = themeColorsRef.current;

        // Primary moving aurora glow
        const grad1 = ctx.createRadialGradient(
          width * (0.35 + Math.sin(tick * 0.5) * 0.2),
          height * (0.28 + Math.cos(tick * 0.4) * 0.15),
          15,
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
          20,
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
          ctx.lineWidth = 0.85;
          for (let i = 0; i < items.length; i++) {
            const a = items[i];
            a.x += a.speedX * dt;
            a.y += a.speedY * dt;
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
              const distSq = dx * dx + dy * dy;
              if (distSq < cyberDistMaxSq) {
                const dist = Math.sqrt(distSq);
                ctx.globalAlpha = (1 - dist / cyberDistMax) * 0.3;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        } else if (preset === "lofi") {
          for (let i = 0; i < items.length; i++) {
            const orb = items[i];
            orb.x += Math.sin(tick + orb.phase) * 0.35 * SCALE * dt;
            orb.y += orb.speedY * 0.45 * dt;
            if (orb.y < -30) {
              orb.y = height + 30;
              orb.x = Math.random() * width;
            }
            ctx.globalAlpha =
              orb.alpha * (0.55 + 0.3 * Math.sin(tick * 2 + orb.phase));
            const rOuter = orb.radius * 9;
            const orbGrad = ctx.createRadialGradient(
              orb.x,
              orb.y,
              1,
              orb.x,
              orb.y,
              rOuter
            );
            orbGrad.addColorStop(0, highlight);
            orbGrad.addColorStop(0.5, primary);
            orbGrad.addColorStop(1, "transparent");
            ctx.fillStyle = orbGrad;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, rOuter, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (preset === "particles") {
          ctx.fillStyle = highlight;
          for (let i = 0; i < items.length; i++) {
            const p = items[i];
            p.x += p.speedX * dt;
            p.y += p.speedY * dt;
            if (p.y < -10) p.y = height + 10;
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.globalAlpha =
              p.alpha * (0.65 + 0.35 * Math.sin(tick * 3 + p.phase));
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      };

      animationFrameId = requestAnimationFrame(render);
      return () => {
        cancelAnimationFrame(animationFrameId);
        if (resizeTimer) window.clearTimeout(resizeTimer);
        window.removeEventListener("resize", handleResize);
      };
    }, [preset, shouldRunProceduralCanvas]);

    const safeDim = Math.min(0.85, Math.max(0.1, dim));
    const safeBlur = Math.min(24, Math.max(0, blur));

    return (
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
        style={{ contain: "strict", transform: "translateZ(0)" }}
        aria-hidden="true"
      >
        {/* Background Visual Layer — NEVER apply CSS filter:blur() over an animating canvas */}
        <div className="absolute inset-0">
          {/* Rich multi-stop theme gradient backdrop */}
          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{
              background: `
                radial-gradient(circle at 15% 15%, var(--accent) 0%, transparent 45%),
                radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--primary) 35%, transparent) 0%, transparent 45%),
                radial-gradient(circle at 50% 85%, var(--surface) 0%, var(--bg-base) 75%),
                var(--bg-base)
              `,
            }}
          />

          {/* Only mount the active procedural canvas when neither Sakura nor Sky Ocean owns the scene */}
          {!isSakura && !isSkyOcean && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover opacity-95"
            />
          )}

          {/* Conditionally mounted Sharingan Seal — 0% GPU cost on other themes */}
          {isSharingan && (
            <div className="sharingan-ambient-seal pointer-events-none absolute right-[-100px] bottom-[-100px] sm:right-[-80px] sm:bottom-[-80px] w-[340px] h-[340px] sm:w-[560px] sm:h-[560px] opacity-100 transition-opacity duration-700 z-0 select-none">
              <SharinganIcon
                size="100%"
                animate={!isPausedBySaver}
                speed="slow"
                glow={false}
                interactive={false}
              />
            </div>
          )}

          {/* Conditionally mounted Sakura Scene — 0% CPU/GPU cost on other themes */}
          {isSakura && <SakuraTreeScene paused={isPausedBySaver} />}

          {/* Conditionally mounted Sky Ocean Scene — 0% CPU/GPU cost on other themes */}
          {isSkyOcean && <SkyOceanScene paused={isPausedBySaver} />}

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
              style={
                safeBlur > 0
                  ? {
                      filter: `blur(${Math.min(12, safeBlur)}px)`,
                      transform: "scale(1.03)",
                    }
                  : undefined
              }
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                videoLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}
        </div>

        {/* Lightweight Theme-tinted Dim Overlay (no per-frame full-viewport backdrop-filter blur pass!) */}
        <div
          className="absolute inset-0 transition-colors duration-300"
          style={{
            backgroundColor: `color-mix(in srgb, var(--bg-base) ${Math.round(
              safeDim * 100
            )}%, transparent)`,
          }}
        />

        {isPausedBySaver && (
          <div className="fixed bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/60 border border-white/10 px-3 py-1 text-[11px] text-white/70">
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
  }
);

VideoBackground.displayName = "VideoBackground";
