"use client";

import React, { useState, useEffect } from "react";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_MODEL_OPTIONS,
} from "@/types/taskit";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  X,
  AlertCircle,
  Table2,
  Cpu,
} from "lucide-react";

interface GeminiSetupModalProps {
  isOpen: boolean;
  initialKey?: string;
  initialProvider?: AIProvider;
  initialNvidiaModel?: string;
  onSaveApiKey: (
    apiKey: string,
    provider?: AIProvider,
    nvidiaModel?: string
  ) => void;
  onOptOutTemporary: () => void;
  onClose: () => void;
}

export const GeminiSetupModal: React.FC<GeminiSetupModalProps> = ({
  isOpen,
  initialKey = "",
  initialProvider = "nvidia",
  initialNvidiaModel = DEFAULT_NVIDIA_MODEL,
  onSaveApiKey,
  onOptOutTemporary,
  onClose,
}) => {
  const [provider, setProvider] = useState<AIProvider>(initialProvider);
  const [nvidiaModel, setNvidiaModel] = useState<string>(
    initialNvidiaModel || DEFAULT_NVIDIA_MODEL
  );
  const [keyDraft, setKeyDraft] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyDraft(initialKey || "");
      if (initialKey.startsWith("nvapi-")) {
        setProvider("nvidia");
      } else if (initialKey.startsWith("AIza")) {
        setProvider("gemini");
      } else {
        setProvider(initialProvider);
      }
      if (initialNvidiaModel) {
        setNvidiaModel(initialNvidiaModel);
      }
      setErrorMsg(null);
      setVerifiedSuccess(false);
    }
  }, [isOpen, initialKey, initialProvider, initialNvidiaModel]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !verifying) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, verifying, onClose]);

  if (!isOpen) return null;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      setErrorMsg(
        provider === "nvidia"
          ? "Please paste your NVIDIA NIM API key (nvapi-...) first."
          : "Please paste your Google Gemini API key (AIza...) first."
      );
      return;
    }

    setVerifying(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          customApiKey: trimmed,
          aiProvider: provider,
          nvidiaModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setErrorMsg(
          data.error ||
            (provider === "nvidia"
              ? "Could not verify this NVIDIA NIM API key (starts with nvapi-...)."
              : "Could not verify this Google Gemini API key (starts with AIza...).")
        );
        setVerifying(false);
        return;
      }

      setVerifiedSuccess(true);
      setTimeout(() => {
        onSaveApiKey(trimmed, provider, nvidiaModel);
      }, 350);
    } catch {
      setErrorMsg("Network error while verifying key. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (!verifying) onClose();
      }}
    >
      <div
        role="dialog"
        aria-labelledby="gemini-setup-title"
        className="relative w-full max-w-xl max-h-[94vh] sm:max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#121318]/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Ambient Accent Glow */}
        <div
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--primary), #76b900, #60a5fa, var(--primary))",
          }}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={verifying}
          aria-label="Close setup dialog"
          className="absolute right-4 top-4 rounded-full p-2 text-white/45 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="space-y-2 pr-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/15 px-3 py-1 text-[11px] font-semibold text-highlight">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>AI Workspace Agent Setup</span>
            </div>
            <h2
              id="gemini-setup-title"
              className="text-xl sm:text-2xl font-bold tracking-tight text-white"
            >
              Connect NVIDIA NIM or Google Gemini
            </h2>
            <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
              Pair <strong className="text-white/90">NVIDIA NIM</strong> (free inference with leading models at{" "}
              <code className="text-highlight">build.nvidia.com</code>) with{" "}
              <strong className="text-white/90">Google Gemini</strong> for intelligent task management, live scheduling, and Q&amp;A day planning.
            </p>
          </div>

          {/* 2-Provider Selector Tabs */}
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-white/[0.04] p-1.5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setProvider("nvidia");
                setErrorMsg(null);
              }}
              className={`flex flex-col items-start gap-0.5 rounded-xl px-3.5 py-2.5 text-left transition-all ${
                provider === "nvidia"
                  ? "bg-primary text-black font-semibold shadow-neon"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span>NVIDIA NIM</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                    provider === "nvidia"
                      ? "bg-black/20 text-black"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  Free Inference
                </span>
              </div>
              <span
                className={`text-[10px] ${
                  provider === "nvidia" ? "text-black/80" : "text-white/45"
                }`}
              >
                Nemotron • DeepSeek • Mistral • Kimi
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProvider("gemini");
                setErrorMsg(null);
              }}
              className={`flex flex-col items-start gap-0.5 rounded-xl px-3.5 py-2.5 text-left transition-all ${
                provider === "gemini"
                  ? "bg-primary text-black font-semibold shadow-neon"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span>Google Gemini</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                    provider === "gemini"
                      ? "bg-black/20 text-black"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  Paired
                </span>
              </div>
              <span
                className={`text-[10px] ${
                  provider === "gemini" ? "text-black/80" : "text-white/45"
                }`}
              >
                Gemini 3.8 Flash &amp; Pro
              </span>
            </button>
          </div>

          {/* Step Guide for Selected Provider */}
          {provider === "nvidia" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                    30-Second NVIDIA NIM Setup (build.nvidia.com)
                  </span>
                  <a
                    href="https://build.nvidia.com/models"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1 text-xs font-semibold text-highlight transition-all"
                  >
                    <span>Open NVIDIA Build Catalog</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="space-y-2 text-xs text-white/75">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                      1
                    </span>
                    <span>
                      Open{" "}
                      <a
                        href="https://build.nvidia.com/models"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline underline-offset-2 hover:brightness-125"
                      >
                        build.nvidia.com/models
                      </a>{" "}
                      and sign in with your free NVIDIA account.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                      2
                    </span>
                    <span>
                      Click <strong className="text-white">&ldquo;Get API Key&rdquo;</strong>{" "}
                      (or click any model → <strong className="text-white">&ldquo;Build with this NIM&rdquo; → &ldquo;Generate API Key&rdquo;</strong>).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                      3
                    </span>
                    <span>
                      Copy your key (starts with{" "}
                      <code className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                        nvapi-...
                      </code>
                      ) and paste it below.
                    </span>
                  </li>
                </ol>
              </div>

              {/* NVIDIA Model Selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="setup-nvidia-model-select"
                  className="flex items-center justify-between text-xs font-semibold text-white/85"
                >
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-primary" />
                    <span>Default NVIDIA Model (switchable anytime in chat bar)</span>
                  </span>
                </label>
                <select
                  id="setup-nvidia-model-select"
                  value={nvidiaModel}
                  onChange={(e) => setNvidiaModel(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs text-white focus:border-primary focus:outline-none"
                >
                  {NVIDIA_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#121318] text-white">
                      {m.name} ({m.badge}) — {m.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Quick 30-Second Google AI Setup (Free Tier)
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1 text-xs font-semibold text-highlight transition-all"
                >
                  <span>Open Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="space-y-2 text-xs text-white/75">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                    1
                  </span>
                  <span>
                    Go to{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2 hover:brightness-125"
                    >
                      aistudio.google.com/app/apikey
                    </a>{" "}
                    and sign in with your Google account.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                    2
                  </span>
                  <span>
                    Click <strong className="text-white">&ldquo;Create API key&rdquo;</strong>{" "}
                    (free tier includes Gemini 3.8 Flash &amp; Pro).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-highlight">
                    3
                  </span>
                  <span>
                    Copy the key (starts with{" "}
                    <code className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white/90">
                      AIza...
                    </code>
                    ) and paste it below.
                  </span>
                </li>
              </ol>
            </div>
          )}

          {/* API Key Input Form */}
          <form onSubmit={handleVerifyAndSave} className="space-y-3">
            <div>
              <label
                htmlFor="gemini-api-key-input"
                className="block text-xs font-semibold text-white/85 mb-1.5"
              >
                {provider === "nvidia"
                  ? "NVIDIA NIM API Key (nvapi-...)"
                  : "Google Gemini API Key (AIza...)"}
              </label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-white/40 absolute left-3.5 pointer-events-none" />
                <input
                  id="gemini-api-key-input"
                  type={showKey ? "text" : "password"}
                  autoFocus
                  value={keyDraft}
                  onChange={(e) => {
                    const val = e.target.value;
                    setKeyDraft(val);
                    if (val.startsWith("nvapi-")) setProvider("nvidia");
                    else if (val.startsWith("AIza")) setProvider("gemini");
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.nativeEvent.isComposing || e.keyCode === 229)
                    ) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={
                    provider === "nvidia"
                      ? "Paste NVIDIA NIM key (nvapi-...)"
                      : "Paste Google Gemini key (AIzaSy...)"
                  }
                  className="w-full rounded-2xl border border-white/15 bg-black/60 pl-10 pr-11 py-3 text-xs sm:text-sm font-mono text-white placeholder-white/30 focus:border-primary focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  className="absolute right-3 rounded-lg p-1.5 text-white/45 hover:text-white transition-colors"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {verifiedSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Connected to{" "}
                  {provider === "nvidia" ? "NVIDIA NIM" : "Google Gemini"}!
                  Launching workspace...
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-white/45">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
              <span>
                Stored privately in your profile &amp; browser. You can save both
                NVIDIA &amp; Gemini keys for automatic failover.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="submit"
                disabled={verifying || verifiedSuccess || !keyDraft.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs sm:text-sm font-bold text-black shadow-neon hover:brightness-110 disabled:opacity-45 transition-all"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Key...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Verify &amp; Enable AI Agent</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={verifying}
                onClick={onOptOutTemporary}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.09] px-4 py-3 text-xs sm:text-sm font-medium text-white/75 hover:text-white transition-all"
              >
                <Table2 className="w-4 h-4 text-white/55" />
                <span>Don&apos;t use AI for now</span>
              </button>
            </div>

            <p className="text-center text-[11px] text-white/40 pt-0.5">
              Choosing &ldquo;Don&apos;t use AI for now&rdquo; is temporary and hides AI
              chats for this session. You can switch AI on anytime in{" "}
              <strong className="text-white/65">Settings → AI</strong>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
