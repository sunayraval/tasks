"use client";

import React, { useMemo, useState } from "react";
import {
  AgentQAPrompt,
  QAQuestionItem,
  QASubmissionAnswer,
  QASubmissionPayload,
} from "@/types/taskit";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  ListChecks,
  MessageSquarePlus,
  Sparkles,
  X,
} from "lucide-react";

interface AgentQACardProps {
  qaPrompt: AgentQAPrompt;
  disabled?: boolean;
  onAcceptConsent: () => void;
  onDismiss: () => void;
  onReopen: () => void;
  onSubmitAnswers: (payload: QASubmissionPayload, summaryText: string) => void;
}

function format12hPreview(hhmm: string): string {
  const [hStr, mStr] = (hhmm || "09:00").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function computeNowRoundedHHMM(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const mins = d.getHours() * 60 + d.getMinutes();
  const rounded = (Math.ceil(mins / 15) * 15) % (24 * 60);
  const hh = Math.floor(rounded / 60);
  const mm = rounded % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const AgentQACard: React.FC<AgentQACardProps> = ({
  qaPrompt,
  disabled = false,
  onAcceptConsent,
  onDismiss,
  onReopen,
  onSubmitAnswers,
}) => {
  const status = qaPrompt.status || "consent";
  const questions = qaPrompt.questions || [];

  const [activeStep, setActiveStep] = useState(0);
  const [showAllAtOnce, setShowAllAtOnce] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Per-question answer state
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [singleChoices, setSingleChoices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) {
      if (q.inputType === "single_choice" && q.options && q.options.length > 0) {
        init[q.id] = q.options[0];
      }
    }
    return init;
  });
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>({});
  const [customChoiceNotes, setCustomChoiceNotes] = useState<Record<string, string>>(
    {}
  );

  // Timeframe state for "timeframe" inputType
  const defaultTimeframeQuestion = useMemo(
    () => questions.find((q) => q.inputType === "timeframe"),
    [questions]
  );

  const [startTime, setStartTime] = useState<string>(
    () => defaultTimeframeQuestion?.defaultStartTime || computeNowRoundedHHMM(0)
  );
  const [endTime, setEndTime] = useState<string>(
    () => defaultTimeframeQuestion?.defaultEndTime || computeNowRoundedHHMM(240)
  );
  const [timeframePreset, setTimeframePreset] = useState<string>("now_4h");

  const applyTimeframePreset = (presetId: string) => {
    setTimeframePreset(presetId);
    if (presetId === "now_4h") {
      setStartTime(computeNowRoundedHHMM(0));
      setEndTime(computeNowRoundedHHMM(240));
    } else if (presetId === "day_9_5") {
      setStartTime("09:00");
      setEndTime("17:00");
    } else if (presetId === "afternoon_1_8") {
      setStartTime("13:00");
      setEndTime("20:00");
    } else if (presetId === "evening_6_10") {
      setStartTime("18:00");
      setEndTime("22:30");
    }
  };

  const resolveAnswerForQuestion = (q: QAQuestionItem): string => {
    if (q.inputType === "textarea" || q.inputType === "text") {
      return (textDrafts[q.id] || "").trim();
    }
    if (q.inputType === "single_choice") {
      const chosen = (singleChoices[q.id] || "").trim();
      const extra = (customChoiceNotes[q.id] || "").trim();
      if (chosen && extra) return `${chosen} (${extra})`;
      return chosen || extra;
    }
    if (q.inputType === "multi_choice") {
      const list = multiChoices[q.id] || [];
      const extra = (customChoiceNotes[q.id] || "").trim();
      const combined = extra ? [...list, extra] : list;
      return combined.join(", ");
    }
    if (q.inputType === "timeframe") {
      return `${format12hPreview(startTime)} – ${format12hPreview(
        endTime
      )} (${startTime} to ${endTime})`;
    }
    return "";
  };

  const validateQuestion = (q: QAQuestionItem): boolean => {
    if (!q.required) return true;
    const ans = resolveAnswerForQuestion(q);
    if (!ans) {
      setValidationError(
        `Please share a quick answer for "${q.question}" before continuing.`
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleNextStep = () => {
    const currentQ = questions[activeStep];
    if (currentQ && !validateQuestion(currentQ)) return;
    if (activeStep < questions.length - 1) {
      setActiveStep((s) => s + 1);
      setValidationError(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    // If in step-by-step mode and user presses Enter on an earlier step (not textarea), advance step
    if (!showAllAtOnce && activeStep < questions.length - 1) {
      handleNextStep();
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!validateQuestion(questions[i])) {
        setActiveStep(i);
        return;
      }
    }

    const compiledAnswers: QASubmissionAnswer[] = questions
      .map((q) => ({
        questionId: q.id,
        question: q.question,
        answer: resolveAnswerForQuestion(q),
      }))
      .filter((a) => a.answer.length > 0);

    const hasTimeframe = questions.some((q) => q.inputType === "timeframe");

    const payload: QASubmissionPayload = {
      promptId: qaPrompt.id,
      purpose: qaPrompt.purpose,
      originalRequest: qaPrompt.originalRequest,
      answers: compiledAnswers,
      ...(hasTimeframe ? { startTime, endTime } : {}),
    };

    const summaryLines = compiledAnswers.map(
      (a) => `• **${a.question}** ${a.answer}`
    );
    const summaryText =
      qaPrompt.purpose === "plan_day"
        ? `Here are my answers to build my tasks & plan **my day**:\n${summaryLines.join(
            "\n"
          )}`
        : `Here are my answers:\n${summaryLines.join("\n")}`;

    onSubmitAnswers(payload, summaryText);
  };

  const handleQuickChipInsert = (questionId: string, chipLabel: string) => {
    setValidationError(null);
    setTextDrafts((prev) => {
      const existing = (prev[questionId] || "").trimEnd();
      const bullet = `${chipLabel}: `;
      if (!existing) return { ...prev, [questionId]: bullet };
      return { ...prev, [questionId]: `${existing}\n${bullet}` };
    });
  };

  const toggleMultiOption = (questionId: string, option: string) => {
    setValidationError(null);
    setMultiChoices((prev) => {
      const existing = prev[questionId] || [];
      const next = existing.includes(option)
        ? existing.filter((o) => o !== option)
        : [...existing, option];
      return { ...prev, [questionId]: next };
    });
  };

  // =========================================================================
  // STATE 1: CONSENT PROMPT ("Can I ask a few questions to fulfill your request?")
  // =========================================================================
  if (status === "consent") {
    return (
      <div className="rounded-2xl border border-primary/35 bg-[#141720]/95 p-4 sm:p-5 shadow-[0_14px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary shadow-neon">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-highlight">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Interactive Q&amp;A</span>
                <span className="text-white/30">•</span>
                <span className="text-white/60">
                  {questions.length} quick question
                  {questions.length === 1 ? "" : "s"}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                {qaPrompt.consentTitle ||
                  "Can I ask a few questions to fulfill your request?"}
              </h4>
              <p className="text-xs sm:text-[13px] text-white/65 leading-relaxed">
                {qaPrompt.consentSubtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onAcceptConsent}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-[13px] font-extrabold text-black shadow-neon hover:brightness-110 disabled:opacity-50 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>Yes, ask me a few questions</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={onDismiss}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.09] px-3.5 py-2.5 text-xs font-medium text-white/75 hover:text-white disabled:opacity-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>No thanks, I&apos;ll type myself</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: DISMISSED
  // =========================================================================
  if (status === "dismissed") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs text-white/55">
        <span>Skipped guided Q&amp;A — type your tasks or reply directly below.</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onReopen}
          className="inline-flex items-center gap-1 font-semibold text-highlight hover:underline disabled:opacity-50"
        >
          <HelpCircle className="w-3.5 h-3.5 text-primary" />
          <span>Ask me the questions</span>
        </button>
      </div>
    );
  }

  // =========================================================================
  // STATE 3: SUBMITTED SUMMARY RECEIPT
  // =========================================================================
  if (status === "submitted") {
    const submittedList = qaPrompt.submittedAnswers || [];
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guided Q&amp;A Completed</span>
          </div>
          <span className="text-[11px] font-mono text-white/45">
            {submittedList.length} answered
          </span>
        </div>

        {submittedList.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
            {submittedList.map((item) => (
              <div
                key={item.questionId}
                className="rounded-xl border border-white/[0.07] bg-black/35 px-3 py-2 text-xs"
              >
                <div className="text-[11px] text-white/50 font-medium">
                  {item.question}
                </div>
                <div className="text-white/90 font-medium mt-0.5 whitespace-pre-wrap">
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // STATE 4: INTERACTIVE ANSWERING FORM
  // =========================================================================
  const visibleQuestions = showAllAtOnce
    ? questions
    : questions[activeStep]
    ? [questions[activeStep]]
    : [];

  const renderSingleQuestion = (q: QAQuestionItem, stepIdx: number) => {
    const fieldId = `qa-${qaPrompt.id}-${q.id}`;
    const helperId = `${fieldId}-help`;

    return (
      <div key={q.id} className="space-y-3">
        {/* TEXTAREA QUESTION */}
        {q.inputType === "textarea" && (
          <div className="space-y-2">
            <label
              htmlFor={fieldId}
              className="block text-sm font-bold text-white leading-snug"
            >
              <span className="text-primary font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
              {q.required && (
                <span className="ml-1 text-xs font-semibold text-amber-300">
                  *
                </span>
              )}
            </label>
            {q.helperText && (
              <p id={helperId} className="text-xs text-white/55">
                {q.helperText}
              </p>
            )}

            {q.quickChips && q.quickChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 mr-0.5">
                  Quick add:
                </span>
                {q.quickChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickChipInsert(q.id, chip)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] hover:border-primary/45 hover:bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-white/75 hover:text-highlight transition-colors"
                  >
                    <span>+ {chip}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              id={fieldId}
              name={q.id}
              rows={3}
              aria-describedby={q.helperText ? helperId : undefined}
              value={textDrafts[q.id] || ""}
              onChange={(e) => {
                setValidationError(null);
                setTextDrafts((prev) => ({ ...prev, [q.id]: e.target.value }));
              }}
              placeholder={
                q.placeholder ||
                "List tasks separated by commas or new lines..."
              }
              className="w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/35 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
        )}

        {/* SINGLE-LINE TEXT QUESTION */}
        {q.inputType === "text" && (
          <div className="space-y-2">
            <label
              htmlFor={fieldId}
              className="block text-sm font-bold text-white leading-snug"
            >
              <span className="text-primary font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
              {q.required && (
                <span className="ml-1 text-xs font-semibold text-amber-300">
                  *
                </span>
              )}
            </label>
            {q.helperText && (
              <p id={helperId} className="text-xs text-white/55">
                {q.helperText}
              </p>
            )}
            <input
              id={fieldId}
              name={q.id}
              type="text"
              aria-describedby={q.helperText ? helperId : undefined}
              value={textDrafts[q.id] || ""}
              onChange={(e) => {
                setValidationError(null);
                setTextDrafts((prev) => ({ ...prev, [q.id]: e.target.value }));
              }}
              placeholder={q.placeholder || "Type your answer..."}
              className="w-full rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-white/35 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
        )}

        {/* SINGLE CHOICE RADIO GROUP */}
        {q.inputType === "single_choice" && (
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-bold text-white leading-snug">
              <span className="text-primary font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-white/55">{q.helperText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt, optIdx) => {
                const optId = `${fieldId}-opt-${optIdx}`;
                const selected = singleChoices[q.id] === opt;
                return (
                  <label
                    key={opt}
                    htmlFor={optId}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-all ${
                      selected
                        ? "border-primary bg-primary/15 text-white font-semibold shadow-sm"
                        : "border-white/10 bg-black/40 text-white/75 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <input
                      id={optId}
                      type="radio"
                      name={fieldId}
                      value={opt}
                      checked={selected}
                      onChange={() => {
                        setValidationError(null);
                        setSingleChoices((prev) => ({ ...prev, [q.id]: opt }));
                      }}
                      className="accent-[var(--primary)] shrink-0"
                    />
                    <span className="leading-snug">{opt}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label
                htmlFor={`${fieldId}-custom`}
                className="block text-[11px] font-medium text-white/50 mb-1"
              >
                Optional custom note or preference:
              </label>
              <input
                id={`${fieldId}-custom`}
                name={`${q.id}_custom`}
                type="text"
                value={customChoiceNotes[q.id] || ""}
                onChange={(e) =>
                  setCustomChoiceNotes((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="Add any extra detail (optional)..."
                className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
              />
            </div>
          </fieldset>
        )}

        {/* MULTI CHOICE CHECKBOX GROUP */}
        {q.inputType === "multi_choice" && (
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-bold text-white leading-snug">
              <span className="text-primary font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-white/55">{q.helperText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt, optIdx) => {
                const optId = `${fieldId}-chk-${optIdx}`;
                const selected = (multiChoices[q.id] || []).includes(opt);
                return (
                  <label
                    key={opt}
                    htmlFor={optId}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs cursor-pointer transition-all ${
                      selected
                        ? "border-primary bg-primary/15 text-white font-semibold shadow-sm"
                        : "border-white/10 bg-black/40 text-white/75 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <input
                      id={optId}
                      type="checkbox"
                      name={`${fieldId}[]`}
                      value={opt}
                      checked={selected}
                      onChange={() => toggleMultiOption(q.id, opt)}
                      className="rounded accent-[var(--primary)] shrink-0"
                    />
                    <span className="leading-snug">{opt}</span>
                  </label>
                );
              })}
            </div>

            <div>
              <label
                htmlFor={`${fieldId}-custom`}
                className="block text-[11px] font-medium text-white/50 mb-1"
              >
                Anything else to include? (optional):
              </label>
              <input
                id={`${fieldId}-custom`}
                name={`${q.id}_custom`}
                type="text"
                value={customChoiceNotes[q.id] || ""}
                onChange={(e) =>
                  setCustomChoiceNotes((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="Type additional items..."
                className="w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
              />
            </div>
          </fieldset>
        )}

        {/* TIMEFRAME WINDOW PICKER */}
        {q.inputType === "timeframe" && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-bold text-white leading-snug">
              <span className="text-primary font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-white/55">{q.helperText}</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "now_4h", label: "Start Right Now (+4 hrs)" },
                { id: "day_9_5", label: "Full Day (9 AM – 5 PM)" },
                { id: "afternoon_1_8", label: "Afternoon (1 PM – 8 PM)" },
                { id: "evening_6_10", label: "Evening (6 PM – 10:30 PM)" },
              ].map((preset) => {
                const pId = `${fieldId}-${preset.id}`;
                const isSelected = timeframePreset === preset.id;
                return (
                  <label
                    key={preset.id}
                    htmlFor={pId}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/15 text-highlight font-semibold"
                        : "border-white/10 bg-black/40 text-white/70 hover:text-white"
                    }`}
                  >
                    <input
                      id={pId}
                      type="radio"
                      name={`${fieldId}_preset`}
                      value={preset.id}
                      checked={isSelected}
                      onChange={() => applyTimeframePreset(preset.id)}
                      className="accent-[var(--primary)] shrink-0"
                    />
                    <span className="truncate">{preset.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-black/45 p-3">
              <div>
                <label
                  htmlFor={`${fieldId}-start`}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white/65 mb-1"
                >
                  <Clock className="w-3 h-3 text-primary" />
                  <span>Start Time</span>
                </label>
                <input
                  id={`${fieldId}-start`}
                  name="qa_start_time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setTimeframePreset("custom");
                    setStartTime(e.target.value);
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-mono text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-end`}
                  className="flex items-center gap-1 text-[11px] font-semibold text-white/65 mb-1"
                >
                  <CalendarClock className="w-3 h-3 text-primary" />
                  <span>Planned End Time</span>
                </label>
                <input
                  id={`${fieldId}-end`}
                  name="qa_end_time"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setTimeframePreset("custom");
                    setEndTime(e.target.value);
                  }}
                  className="w-full rounded-lg border border-white/15 bg-black/65 px-3 py-1.5 text-xs font-mono text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </fieldset>
        )}
      </div>
    );
  };

  const isOnFinalStep = showAllAtOnce || activeStep >= questions.length - 1;

  return (
    <form
      onSubmit={handleFormSubmit}
      action="/api/chat"
      method="POST"
      className="rounded-2xl border border-primary/40 bg-[#141720]/95 p-4 sm:p-5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-4"
    >
      {/* Header + Progress Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/35 bg-primary/15 text-primary">
            <ListChecks className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">
              {qaPrompt.purpose === "plan_day"
                ? "Day Planning Q&A"
                : "Guided Q&A"}
            </div>
            <div className="text-[11px] text-white/50">
              {showAllAtOnce
                ? `Showing all ${questions.length} questions`
                : `Question ${activeStep + 1} of ${questions.length}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!showAllAtOnce && questions.length > 1 && (
            <div className="flex items-center gap-1" role="tablist" aria-label="Question steps">
              {questions.map((q, idx) => {
                const hasVal = resolveAnswerForQuestion(q).length > 0;
                const isCurrent = idx === activeStep;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setValidationError(null);
                      setActiveStep(idx);
                    }}
                    className={`h-6 min-w-[24px] px-1.5 rounded-md font-mono text-[11px] font-bold transition-all ${
                      isCurrent
                        ? "bg-primary text-black shadow-neon"
                        : hasVal
                        ? "border border-primary/35 bg-primary/15 text-highlight"
                        : "border border-white/10 bg-white/5 text-white/50 hover:text-white"
                    }`}
                    title={q.question}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          )}

          {questions.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllAtOnce((v) => !v)}
              className="rounded-lg border border-white/12 bg-white/[0.04] hover:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:text-white transition-colors"
            >
              {showAllAtOnce ? "Step-by-step" : "Show all"}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-white/45 hover:text-white hover:bg-white/10 transition-colors"
            title="Cancel Q&A"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Question(s) */}
      <div className="space-y-5">
        {visibleQuestions.map((q, idx) =>
          renderSingleQuestion(q, showAllAtOnce ? idx : activeStep)
        )}
      </div>

      {/* Live Accessible Validation Notice */}
      <div aria-live="polite">
        {validationError && (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {validationError}
          </div>
        )}
      </div>

      {/* Navigation & Submit Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 pt-3">
        <div>
          {!showAllAtOnce && activeStep > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setValidationError(null);
                setActiveStep((s) => Math.max(0, s - 1));
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 px-3.5 py-2 text-xs font-semibold text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isOnFinalStep ? (
            <button
              type="button"
              disabled={disabled}
              onClick={handleNextStep}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-black shadow-neon hover:brightness-110 disabled:opacity-50 transition-all"
            >
              <span>Next Question</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs sm:text-[13px] font-extrabold text-black shadow-neon hover:brightness-110 disabled:opacity-50 transition-all"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                {qaPrompt.submitLabel ||
                  (qaPrompt.purpose === "plan_day"
                    ? "Populate Tasks & Build my day"
                    : "Submit Answers & Fulfill Request")}
              </span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
