"use client";

import React, { useId, useState } from "react";

export interface SharinganIconProps {
  className?: string;
  size?: number | string;
  animate?: boolean;
  speed?: "normal" | "fast" | "slow";
  glow?: boolean;
  interactive?: boolean;
  title?: string;
}

/**
 * Authentic 3-Tomoe Sharingan (写輪眼) ocular component.
 * Features vector iris gradients, concentric tomoe tracks, and smooth GPU-accelerated spin.
 */
export const SharinganIcon: React.FC<SharinganIconProps> = ({
  className = "w-6 h-6",
  size,
  animate = true,
  speed = "normal",
  glow = true,
  interactive = true,
  title = "Uchiha Clan Sharingan Eye",
}) => {
  const id = useId();
  const [isHovered, setIsHovered] = useState(false);

  // Determine active animation class
  const activeSpinClass = !animate
    ? ""
    : isHovered
    ? "animate-sharingan-spin-fast"
    : speed === "fast"
    ? "animate-sharingan-spin-fast"
    : "animate-sharingan-spin";

  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        glow ? "animate-sharingan-pulse" : ""
      } ${className}`}
      style={sizeStyle}
      onMouseEnter={() => interactive && setIsHovered(true)}
      onMouseLeave={() => interactive && setIsHovered(false)}
      title={title}
      role="img"
      aria-label={title}
    >
      {/* Outer Crimson Chakra Glow Halo */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-[6px] opacity-75 pointer-events-none transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle, rgba(255, 31, 56, 0.85) 0%, rgba(220, 20, 45, 0.35) 65%, transparent 100%)",
            transform: isHovered ? "scale(1.3)" : "scale(1.1)",
          }}
        />
      )}

      {/* Main Vector SVG */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full relative z-10 overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial Iris Gradient */}
          <radialGradient
            id={`iris-grad-${id}`}
            cx="48%"
            cy="48%"
            r="52%"
            fx="44%"
            fy="44%"
          >
            <stop offset="0%" stopColor="#ff405b" />
            <stop offset="42%" stopColor="#e50e2c" />
            <stop offset="78%" stopColor="#ab061a" />
            <stop offset="100%" stopColor="#4a010a" />
          </radialGradient>

          {/* Ocular Shadow Ring */}
          <linearGradient
            id={`ring-grad-${id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#000000" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#250207" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* 1. Base Iris Circle with Deep Crimson Gradient */}
        <circle
          cx="50"
          cy="50"
          r="47"
          fill={`url(#iris-grad-${id})`}
          stroke="#000000"
          strokeWidth="3.2"
        />

        {/* 2. Outer Subtle Vignette Rim */}
        <circle
          cx="50"
          cy="50"
          r="45.5"
          fill="none"
          stroke="#1a0205"
          strokeWidth="1.6"
          strokeOpacity="0.6"
        />

        {/* 3. Spinning Inner Assembly: Concentric Track, Pupil & 3 Tomoe */}
        <g className={activeSpinClass} style={{ transformOrigin: "50px 50px" }}>
          {/* Concentric Tomoe Connection Ring */}
          <circle
            cx="50"
            cy="50"
            r="27.5"
            fill="none"
            stroke="#000000"
            strokeWidth="2.4"
            strokeOpacity="0.9"
          />

          {/* Center Black Pupil */}
          <circle cx="50" cy="50" r="9.5" fill="#000000" />

          {/* Specular Iris Glint */}
          <circle
            cx="46.5"
            cy="46.5"
            r="2.2"
            fill="#ffffff"
            fillOpacity="0.75"
          />

          {/* --- TOMOE 1 (Top / 0°) --- */}
          <g transform="rotate(0 50 50)">
            <circle cx="50" cy="22.5" r="5.2" fill="#000000" />
            <path
              d="M 45 22.5 C 45 27.5 49 33.5 54.5 35.5 C 51.5 32 50.5 27 52.8 24 Z"
              fill="#000000"
            />
          </g>

          {/* --- TOMOE 2 (Bottom-Right / 120°) --- */}
          <g transform="rotate(120 50 50)">
            <circle cx="50" cy="22.5" r="5.2" fill="#000000" />
            <path
              d="M 45 22.5 C 45 27.5 49 33.5 54.5 35.5 C 51.5 32 50.5 27 52.8 24 Z"
              fill="#000000"
            />
          </g>

          {/* --- TOMOE 3 (Bottom-Left / 240°) --- */}
          <g transform="rotate(240 50 50)">
            <circle cx="50" cy="22.5" r="5.2" fill="#000000" />
            <path
              d="M 45 22.5 C 45 27.5 49 33.5 54.5 35.5 C 51.5 32 50.5 27 52.8 24 Z"
              fill="#000000"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
