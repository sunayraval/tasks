"use client";

import React from "react";

interface SakuraIconProps {
  size?: number | string;
  animate?: boolean;
  glow?: boolean;
  className?: string;
}

export const SakuraIcon: React.FC<SakuraIconProps> = ({
  size = 20,
  animate = true,
  glow = true,
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animate ? "animate-sakura-spin" : ""} ${
        glow ? "drop-shadow-[0_0_8px_rgba(255,126,182,0.8)]" : ""
      } ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="sakuraPetalGrad" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffd6e7" />
          <stop offset="55%" stopColor="#ff8ec4" />
          <stop offset="100%" stopColor="#e84a8a" />
        </radialGradient>
      </defs>

      {/* 5 Cherry Blossom Petals with signature notched tips */}
      {[0, 72, 144, 216, 288].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 32 32)`}>
          <path
            d="M32 30 C25 22, 22 12, 28 7 C30 5.5, 31 8, 32 10.5 C33 8, 34 5.5, 36 7 C42 12, 39 22, 32 30 Z"
            fill="url(#sakuraPetalGrad)"
            stroke="#ffe4f0"
            strokeWidth="0.8"
          />
        </g>
      ))}

      {/* Blossom Center & Stamens */}
      <circle cx="32" cy="32" r="5" fill="#9d174d" />
      <circle cx="32" cy="32" r="2.6" fill="#fde047" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="32"
          y1="32"
          x2={32 + Math.cos((deg * Math.PI) / 180) * 8}
          y2={32 + Math.sin((deg * Math.PI) / 180) * 8}
          stroke="#fef08a"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};
