"use client";

import React, { useState, useEffect } from "react";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_MODEL_OPTIONS,
} from "@/types/taskit";
import {
  Badge,
  Button,
  Caption,
  Card,
  Code,
  Dialog,
  Input,
  Label,
  Tabs,
} from "@/components/tailus-ui";
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

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      setErrorMsg(
        provider === "nvidia"
          ? "Please paste your NVIDIA NIM API key (starts with nvapi-)."
          : "Please paste your Google Gemini API key (starts with AIza)."
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
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !verifying) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          fancy
          className="w-[calc(100vw-1.25rem)] max-w-xl max-h-[94vh] sm:max-h-[92vh] overflow-y-auto p-0 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
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
          <Dialog.CloseButton
            type="button"
            onClick={onClose}
            disabled={verifying}
            aria-label="Close setup dialog"
            className="top-4 right-4 rounded-full"
          >
            <X className="w-4 h-4" />
          </Dialog.CloseButton>

          <div className="p-4 sm:p-8 space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="space-y-2 pr-6">
              <Badge
                variant="soft"
                intent="primary"
                size="sm"
                className="gap-1.5 w-fit"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Workspace Agent Setup</span>
              </Badge>
              <Dialog.Title
                id="gemini-setup-title"
                size="2xl"
                weight="bold"
                className="tracking-tight"
              >
                Connect NVIDIA NIM or Google Gemini
              </Dialog.Title>
              <Dialog.Description
                size="sm"
                className="leading-relaxed text-body"
              >
                Pair <strong className="text-title">NVIDIA NIM</strong> (free
                inference with leading models at{" "}
                <Code>build.nvidia.com</Code>) with{" "}
                <strong className="text-title">Google Gemini</strong> for
                intelligent task management, live scheduling, and Q&amp;A day
                planning.
              </Dialog.Description>
            </div>

            {/* 2-Provider Selector Tabs */}
            <Tabs.Root
              value={provider}
              onValueChange={(val) => {
                setProvider(val as AIProvider);
                setErrorMsg(null);
              }}
            >
              <Tabs.List
                variant="mixed"
                triggerVariant="softToSoft"
                intent="primary"
                className="grid grid-cols-2 gap-2 p-1.5 h-auto rounded-[--card-radius]"
              >
                <Tabs.Trigger
                  value="nvidia"
                  className="flex flex-col items-start gap-0.5 rounded-[--btn-radius] px-3.5 py-2.5 text-left h-auto data-[state=active]:bg-primary-500/20 data-[state=active]:ring-1 data-[state=active]:ring-primary-500/50"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-title">
                    <span>NVIDIA NIM</span>
                    <Badge
                      variant="soft"
                      intent="success"
                      size="xs"
                      className="text-[9px] font-bold uppercase tracking-wider"
                    >
                      Free Inference
                    </Badge>
                  </div>
                  <span className="text-[10px] text-caption">
                    Nemotron • DeepSeek • Mistral • Kimi
                  </span>
                </Tabs.Trigger>

                <Tabs.Trigger
                  value="gemini"
                  className="flex flex-col items-start gap-0.5 rounded-[--btn-radius] px-3.5 py-2.5 text-left h-auto data-[state=active]:bg-primary-500/20 data-[state=active]:ring-1 data-[state=active]:ring-primary-500/50"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-title">
                    <span>Google Gemini</span>
                    <Badge
                      variant="soft"
                      intent="info"
                      size="xs"
                      className="text-[9px] font-bold uppercase tracking-wider"
                    >
                      Paired
                    </Badge>
                  </div>
                  <span className="text-[10px] text-caption">
                    Gemini 3.8 Flash &amp; Pro
                  </span>
                </Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>

            {/* Step Guide for Selected Provider */}
            {provider === "nvidia" ? (
              <div className="space-y-3">
                <Card variant="soft" className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-caption">
                      30-Second NVIDIA NIM Setup (build.nvidia.com)
                    </span>
                    <a
                      href="https://build.nvidia.com/models"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[--ui-bg] hover:bg-[--ui-soft-bg] border border-[--ui-border-color] px-3 py-1 text-xs font-semibold text-primary-300 transition-all"
                    >
                      <span>Open NVIDIA Build Catalog</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <ol className="space-y-2 text-xs text-body">
                    <li className="flex items-start gap-2.5">
                      <Badge
                        variant="soft"
                        intent="primary"
                        size="xs"
                        className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                      >
                        1
                      </Badge>
                      <span>
                        Open{" "}
                        <a
                          href="https://build.nvidia.com/models"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-400 underline underline-offset-2 hover:brightness-125"
                        >
                          build.nvidia.com/models
                        </a>{" "}
                        and sign in with your free NVIDIA account.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Badge
                        variant="soft"
                        intent="primary"
                        size="xs"
                        className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                      >
                        2
                      </Badge>
                      <span>
                        Click{" "}
                        <strong className="text-title">
                          &ldquo;Get API Key&rdquo;
                        </strong>{" "}
                        (or click any model →{" "}
                        <strong className="text-title">
                          &ldquo;Build with this NIM&rdquo; → &ldquo;Generate API
                          Key&rdquo;
                        </strong>
                        ).
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Badge
                        variant="soft"
                        intent="primary"
                        size="xs"
                        className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                      >
                        3
                      </Badge>
                      <span>
                        Copy your key (starts with <Code>nvapi-...</Code>) and
                        paste it below.
                      </span>
                    </li>
                  </ol>
                </Card>

                {/* NVIDIA Model Selector */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="setup-nvidia-model-select"
                    size="sm"
                    className="flex items-center gap-1.5 text-title"
                  >
                    <Cpu className="w-3.5 h-3.5 text-primary-400" />
                    <span>
                      Default NVIDIA Model (switchable anytime in chat bar)
                    </span>
                  </Label>
                  <select
                    id="setup-nvidia-model-select"
                    value={nvidiaModel}
                    onChange={(e) => setNvidiaModel(e.target.value)}
                    className="w-full rounded-[--input-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] px-3.5 py-2.5 text-xs text-title focus:border-primary-500 focus:outline-none"
                  >
                    {NVIDIA_MODEL_OPTIONS.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        className="bg-gray-900 text-white"
                      >
                        {m.name} ({m.badge}) — {m.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <Card variant="soft" className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-caption">
                    Quick 30-Second Google AI Setup (Free Tier)
                  </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[--ui-bg] hover:bg-[--ui-soft-bg] border border-[--ui-border-color] px-3 py-1 text-xs font-semibold text-primary-300 transition-all"
                  >
                    <span>Open Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="space-y-2 text-xs text-body">
                  <li className="flex items-start gap-2.5">
                    <Badge
                      variant="soft"
                      intent="primary"
                      size="xs"
                      className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                    >
                      1
                    </Badge>
                    <span>
                      Go to{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-400 underline underline-offset-2 hover:brightness-125"
                      >
                        aistudio.google.com/app/apikey
                      </a>{" "}
                      and sign in with your Google account.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Badge
                      variant="soft"
                      intent="primary"
                      size="xs"
                      className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                    >
                      2
                    </Badge>
                    <span>
                      Click{" "}
                      <strong className="text-title">
                        &ldquo;Create API key&rdquo;
                      </strong>{" "}
                      (free tier includes Gemini 3.8 Flash &amp; Pro).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Badge
                      variant="soft"
                      intent="primary"
                      size="xs"
                      className="h-5 w-5 rounded-full justify-center p-0 shrink-0 font-bold"
                    >
                      3
                    </Badge>
                    <span>
                      Copy the key (starts with <Code>AIza...</Code>) and paste
                      it below.
                    </span>
                  </li>
                </ol>
              </Card>
            )}

            {/* API Key Input Form */}
            <form onSubmit={handleVerifyAndSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="gemini-api-key-input"
                  size="sm"
                  className="text-title"
                >
                  {provider === "nvidia"
                    ? "NVIDIA NIM API Key (nvapi-...)"
                    : "Google Gemini API Key (AIza...)"}
                </Label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-placeholder absolute left-3.5 pointer-events-none z-10" />
                  <Input
                    id="gemini-api-key-input"
                    type={showKey ? "text" : "password"}
                    variant="soft"
                    size="lg"
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
                    className="pl-10 pr-11 font-mono text-xs sm:text-sm"
                  />
                  <Button.Root
                    type="button"
                    variant="ghost"
                    intent="gray"
                    size="xs"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    className="absolute right-2"
                  >
                    <Button.Icon type="only">
                      {showKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button.Icon>
                  </Button.Root>
                </div>
              </div>

              {errorMsg && (
                <Card
                  variant="outlined"
                  className="flex items-start gap-2 border-danger-500/35 bg-danger-500/10 px-3.5 py-2.5 text-xs text-danger-200"
                >
                  <AlertCircle className="w-4 h-4 text-danger-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </Card>
              )}

              {verifiedSuccess && (
                <Card
                  variant="outlined"
                  className="flex items-center gap-2 border-success-500/35 bg-success-500/10 px-3.5 py-2.5 text-xs font-medium text-success-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-success-400 shrink-0" />
                  <span>
                    Connected to{" "}
                    {provider === "nvidia" ? "NVIDIA NIM" : "Google Gemini"}!
                    Launching workspace...
                  </span>
                </Card>
              )}

              <div className="flex items-center gap-1.5 text-[11px] text-caption">
                <ShieldCheck className="w-3.5 h-3.5 text-success-400/80 shrink-0" />
                <span>
                  Stored privately in your profile &amp; browser. You can save
                  both NVIDIA &amp; Gemini keys for automatic failover.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <Button.Root
                  type="submit"
                  variant="solid"
                  intent="primary"
                  size="md"
                  disabled={verifying || verifiedSuccess || !keyDraft.trim()}
                  className="flex-1 shadow-neon"
                >
                  {verifying ? (
                    <>
                      <Button.Icon type="leading">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </Button.Icon>
                      <Button.Label>Verifying Key...</Button.Label>
                    </>
                  ) : (
                    <>
                      <Button.Icon type="leading">
                        <Sparkles className="w-4 h-4" />
                      </Button.Icon>
                      <Button.Label>
                        Verify &amp; Enable AI Agent
                      </Button.Label>
                    </>
                  )}
                </Button.Root>

                <Button.Root
                  type="button"
                  variant="soft"
                  intent="gray"
                  size="md"
                  disabled={verifying}
                  onClick={onOptOutTemporary}
                >
                  <Button.Icon type="leading">
                    <Table2 className="w-4 h-4 text-caption" />
                  </Button.Icon>
                  <Button.Label>Don&apos;t use AI for now</Button.Label>
                </Button.Root>
              </div>

              <Caption className="block text-center pt-0.5">
                Choosing &ldquo;Don&apos;t use AI for now&rdquo; is temporary
                and hides AI chats for this session. You can switch AI on
                anytime in <strong className="text-body">Settings → AI</strong>.
              </Caption>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
