"use client";

import React, { useEffect, useState } from "react";

interface KiteLogoMarkProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * Clean, geometric monoline kite mark used across brand headers, avatars, and badges.
 */
export const KiteLogoMark: React.FC<KiteLogoMarkProps> = ({
  className = "w-4 h-4",
  strokeWidth = 2,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Diamond kite frame tilted gracefully */}
      <path
        d="M19.5 3.5L6.5 7.5L10.5 16.5L19.5 3.5Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M19.5 3.5L6.5 7.5L10.5 16.5L15.8 13.2L19.5 3.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Internal cross spars */}
      <path
        d="M19.5 3.5L10.5 16.5"
        stroke="currentColor"
        strokeWidth={Math.max(1.3, strokeWidth - 0.4)}
        strokeLinecap="round"
      />
      <path
        d="M6.5 7.5L15.8 13.2"
        stroke="currentColor"
        strokeWidth={Math.max(1.3, strokeWidth - 0.4)}
        strokeLinecap="round"
      />
      {/* Minimalist flowing tail */}
      <path
        d="M10.5 16.5C9.2 18.4 6.8 18.6 5.4 20.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
};

interface KiteFlyingLoaderProps {
  elapsedSeconds?: number;
  label?: string;
  compact?: boolean;
}

const FLIGHT_PHRASES = [
  "catching the breeze",
  "gliding through your workspace",
  "aligning tasks & timelines",
  "shaping your response",
];

/**
 * Minimalistic kite-flying loading animation shown while chat responses stream/compute.
 * Uses GPU-composited transform & opacity animations with prefers-reduced-motion support.
 */
export const KiteFlyingLoader: React.FC<KiteFlyingLoaderProps> = ({
  elapsedSeconds = 0,
  label,
  compact = false,
}) => {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (label) return;
    const timer = setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % FLIGHT_PHRASES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [label]);

  const activePhrase = label || FLIGHT_PHRASES[phraseIdx];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-3.5 rounded-2xl border border-white/[0.09] bg-[#16181f]/85 backdrop-blur-xl ${
        compact ? "px-3.5 py-2" : "px-4 py-3"
      } shadow-[0_12px_36px_rgba(0,0,0,0.45)] select-none`}
    >
      {/* Minimalistic Kite Sky Stage */}
      <div className="relative flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/35 border border-white/[0.06]">
        {/* Soft Ambient Horizon Glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-25 blur-md"
          style={{
            background:
              "radial-gradient(circle at 65% 35%, var(--primary), transparent 70%)",
          }}
        />

        <svg
          viewBox="0 0 96 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          {/* Minimalist Wind Wisps drifting right-to-left */}
          <line
            x1="88"
            y1="10"
            x2="66"
            y2="10"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="text-white/30 kite-wind-1"
          />
          <line
            x1="92"
            y1="26"
            x2="62"
            y2="26"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            className="text-primary/45 kite-wind-2"
          />
          <line
            x1="82"
            y1="36"
            x2="64"
            y2="36"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            className="text-white/20 kite-wind-3"
          />

          {/* Soaring Kite + Undulating Ribbon Tail Group */}
          <g className="kite-glider">
            {/* Flowing Ribbon String */}
            <path
              d="M46 23 C 36 27, 29 21, 20 26 C 14 29, 10 26, 5 29"
              stroke="var(--primary)"
              strokeOpacity="0.7"
              strokeWidth="1.35"
              strokeLinecap="round"
              fill="none"
              className="kite-tail-ribbon"
            />

            {/* Tiny Minimalist Tail Bow-Ties */}
            <path
              d="M32 23.2 L34.2 21.2 M32 23.2 L34.2 25.2"
              stroke="var(--highlight)"
              strokeWidth="1.2"
              strokeLinecap="round"
              className="kite-tail-knot-1"
            />
            <path
              d="M19 25.8 L21.2 23.8 M19 25.8 L21.2 27.8"
              stroke="var(--highlight)"
              strokeOpacity="0.75"
              strokeWidth="1.15"
              strokeLinecap="round"
              className="kite-tail-knot-2"
            />

            {/* Geometric Delta/Diamond Kite Body */}
            <polygon
              points="66,11 49,14 46,23 59,25"
              fill="var(--primary)"
              fillOpacity="0.2"
            />
            <polygon
              points="66,11 49,14 46,23"
              fill="var(--highlight)"
              fillOpacity="0.24"
            />
            <polygon
              points="66,11 49,14 46,23 59,25"
              stroke="var(--highlight)"
              strokeWidth="1.45"
              strokeLinejoin="round"
            />
            {/* Kite Cross Spars */}
            <line
              x1="66"
              y1="11"
              x2="46"
              y2="23"
              stroke="var(--primary)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <line
              x1="49"
              y1="14"
              x2="59"
              y2="25"
              stroke="var(--primary)"
              strokeOpacity="0.85"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>

      {/* Minimalist Typography + Elapsed Counter */}
      <div className="flex flex-col min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-[13px] font-medium text-white/90 tracking-tight kite-text-shimmer">
            {activePhrase}
          </span>
          <span className="inline-flex gap-0.5 text-primary text-xs font-bold">
            <span className="kite-dot-1">.</span>
            <span className="kite-dot-2">.</span>
            <span className="kite-dot-3">.</span>
          </span>
        </div>
        <div className="text-[10px] font-mono text-white/40 flex items-center gap-1.5 mt-0.5">
          <span>kite agent</span>
          {elapsedSeconds > 0 && (
            <>
              <span>•</span>
              <span className="text-highlight/80">{elapsedSeconds}s</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Large ambient minimalistic soaring kite graphic for the Marketing Hero & CTA cards.
 */
export const HeroSoaringKite: React.FC<{ className?: string }> = ({
  className = "w-64 h-64",
}) => {
  return (
    <svg
      viewBox="0 0 260 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kiteFacetA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--highlight)" stopOpacity="0.48" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="kiteFacetB" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id="kiteTailGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--highlight)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Subtle Wind Stream Arcs */}
      <path
        d="M245 42 Q 185 52, 130 38"
        stroke="white"
        strokeOpacity="0.14"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="4 8"
        className="kite-wind-1"
      />
      <path
        d="M250 124 Q 170 138, 95 122"
        stroke="var(--primary)"
        strokeOpacity="0.28"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeDasharray="6 10"
        className="kite-wind-2"
      />

      {/* Main Floating Kite Assembly */}
      <g className="kite-hero-float">
        {/* Long Graceful S-Curve Ribbon Tail */}
        <path
          d="M126 112 C 98 138, 72 118, 48 152 C 32 174, 18 168, 6 196"
          stroke="url(#kiteTailGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Minimalist Geometric Tail Bows */}
        <g transform="translate(92, 126) rotate(-18)">
          <polygon
            points="-6,-4 0,0 -6,4"
            fill="var(--highlight)"
            fillOpacity="0.7"
          />
          <polygon
            points="6,-4 0,0 6,4"
            fill="var(--primary)"
            fillOpacity="0.7"
          />
        </g>
        <g transform="translate(58, 141) rotate(-32)">
          <polygon
            points="-5,-3.5 0,0 -5,3.5"
            fill="var(--highlight)"
            fillOpacity="0.55"
          />
          <polygon
            points="5,-3.5 0,0 5,3.5"
            fill="var(--primary)"
            fillOpacity="0.55"
          />
        </g>
        <g transform="translate(29, 169) rotate(-22)">
          <polygon
            points="-4,-3 0,0 -4,3"
            fill="var(--highlight)"
            fillOpacity="0.35"
          />
          <polygon
            points="4,-3 0,0 4,3"
            fill="var(--primary)"
            fillOpacity="0.35"
          />
        </g>

        {/* 4-Facet Minimalist Kite Sail */}
        <polygon points="212,28 136,52 126,112" fill="url(#kiteFacetA)" />
        <polygon points="212,28 126,112 184,102" fill="url(#kiteFacetB)" />
        <polygon
          points="212,28 136,52 126,112 184,102"
          stroke="var(--highlight)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Spine & Cross-Spar */}
        <line
          x1="212"
          y1="28"
          x2="126"
          y2="112"
          stroke="white"
          strokeOpacity="0.8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <line
          x1="136"
          y1="52"
          x2="184"
          y2="102"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Nose Glow Point */}
        <circle cx="212" cy="28" r="3" fill="var(--highlight)" />
      </g>
    </svg>
  );
};
