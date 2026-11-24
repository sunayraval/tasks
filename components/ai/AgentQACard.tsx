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
import { Badge, Button, Card, Input, Textarea } from "@/components/tailus-ui";

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
      <Card variant="mixed" fancy className="backdrop-blur-xl space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[--btn-radius] border border-primary-500/40 bg-primary-500/15 text-primary-400">
              <MessageSquarePlus className="size-4" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-primary-300">
                <Sparkles className="size-3 text-primary-400" />
                <span>Interactive Q&amp;A</span>
                <span className="text-caption">•</span>
                <span className="text-caption">
                  {questions.length} quick question
                  {questions.length === 1 ? "" : "s"}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-semibold text-title leading-snug">
                {qaPrompt.consentTitle ||
                  "Can I ask a few questions to fulfill your request?"}
              </h4>
              <p className="text-xs sm:text-[13px] text-caption leading-relaxed">
                {qaPrompt.consentSubtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button.Root
            variant="solid"
            intent="primary"
            size="sm"
            disabled={disabled}
            onClick={onAcceptConsent}
            className="font-semibold"
          >
            <Button.Label>Yes, ask me a few questions</Button.Label>
            <Button.Icon type="trailing" size="xs">
              <ArrowRight className="stroke-[2.5]" />
            </Button.Icon>
          </Button.Root>

          <Button.Root
            variant="outlined"
            intent="gray"
            size="sm"
            disabled={disabled}
            onClick={onDismiss}
          >
            <Button.Label>No thanks, I&apos;ll type myself</Button.Label>
          </Button.Root>
        </div>
      </Card>
    );
  }

  // =========================================================================
  // STATE 2: DISMISSED
  // =========================================================================
  if (status === "dismissed") {
    return (
      <Card
        variant="soft"
        className="flex flex-wrap items-center justify-between gap-2 border border-[--ui-border-color] px-3.5 py-2 text-xs text-caption"
      >
        <span>
          Skipped guided Q&amp;A — type your tasks or reply directly below.
        </span>
        <Button.Root
          variant="ghost"
          intent="primary"
          size="xs"
          disabled={disabled}
          onClick={onReopen}
        >
          <Button.Icon type="leading" size="xs">
            <HelpCircle />
          </Button.Icon>
          <Button.Label>Ask me the questions</Button.Label>
        </Button.Root>
      </Card>
    );
  }

  // =========================================================================
  // STATE 3: SUBMITTED SUMMARY RECEIPT
  // =========================================================================
  if (status === "submitted") {
    const submittedList = qaPrompt.submittedAnswers || [];
    return (
      <Card
        variant="outlined"
        className="border-success-500/30 bg-success-500/5 p-3.5 sm:p-4 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <Badge variant="soft" intent="success" size="xs" className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider">
            <CheckCircle2 className="size-3.5" />
            <span>Guided Q&amp;A Completed</span>
          </Badge>
          <span className="text-[11px] font-mono text-caption">
            {submittedList.length} answered
          </span>
        </div>

        {submittedList.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5 pt-0.5">
            {submittedList.map((item) => (
              <div
                key={item.questionId}
                className="rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] px-3 py-2 text-xs"
              >
                <div className="text-[11px] text-caption font-medium">
                  {item.question}
                </div>
                <div className="text-title font-medium mt-0.5 whitespace-pre-wrap">
                  {item.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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

            <Textarea
              id={fieldId}
              name={q.id}
              rows={3}
              variant="outlined"
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
            />
          </div>
        )}

        {/* SINGLE-LINE TEXT QUESTION */}
        {q.inputType === "text" && (
          <div className="space-y-2">
            <label
              htmlFor={fieldId}
              className="block text-sm font-semibold text-title leading-snug"
            >
              <span className="text-primary-400 font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
              {q.required && (
                <span className="ml-1 text-xs font-semibold text-warning-400">
                  *
                </span>
              )}
            </label>
            {q.helperText && (
              <p id={helperId} className="text-xs text-caption">
                {q.helperText}
              </p>
            )}
            <Input
              id={fieldId}
              name={q.id}
              type="text"
              variant="outlined"
              size="md"
              aria-describedby={q.helperText ? helperId : undefined}
              value={textDrafts[q.id] || ""}
              onChange={(e) => {
                setValidationError(null);
                setTextDrafts((prev) => ({ ...prev, [q.id]: e.target.value }));
              }}
              placeholder={q.placeholder || "Type your answer..."}
            />
          </div>
        )}

        {/* SINGLE CHOICE RADIO GROUP */}
        {q.inputType === "single_choice" && (
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-semibold text-title leading-snug">
              <span className="text-primary-400 font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-caption">{q.helperText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt, optIdx) => {
                const optId = `${fieldId}-opt-${optIdx}`;
                const selected = singleChoices[q.id] === opt;
                return (
                  <label
                    key={opt}
                    htmlFor={optId}
                    className={`flex items-center gap-2.5 rounded-[--btn-radius] border px-3 py-2.5 text-xs cursor-pointer transition-all ${
                      selected
                        ? "border-primary-500/60 bg-primary-500/15 text-title font-semibold shadow-sm"
                        : "border-[--ui-border-color] bg-[--ui-soft-bg]/50 text-body hover:text-title"
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
                className="block text-[11px] font-medium text-caption mb-1"
              >
                Optional custom note or preference:
              </label>
              <Input
                id={`${fieldId}-custom`}
                name={`${q.id}_custom`}
                type="text"
                variant="outlined"
                size="sm"
                value={customChoiceNotes[q.id] || ""}
                onChange={(e) =>
                  setCustomChoiceNotes((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="Add any extra detail (optional)..."
              />
            </div>
          </fieldset>
        )}

        {/* MULTI CHOICE CHECKBOX GROUP */}
        {q.inputType === "multi_choice" && (
          <fieldset className="space-y-2.5">
            <legend className="text-sm font-semibold text-title leading-snug">
              <span className="text-primary-400 font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-caption">{q.helperText}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(q.options || []).map((opt, optIdx) => {
                const optId = `${fieldId}-chk-${optIdx}`;
                const selected = (multiChoices[q.id] || []).includes(opt);
                return (
                  <label
                    key={opt}
                    htmlFor={optId}
                    className={`flex items-center gap-2.5 rounded-[--btn-radius] border px-3 py-2.5 text-xs cursor-pointer transition-all ${
                      selected
                        ? "border-primary-500/60 bg-primary-500/15 text-title font-semibold shadow-sm"
                        : "border-[--ui-border-color] bg-[--ui-soft-bg]/50 text-body hover:text-title"
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
                className="block text-[11px] font-medium text-caption mb-1"
              >
                Anything else to include? (optional):
              </label>
              <Input
                id={`${fieldId}-custom`}
                name={`${q.id}_custom`}
                type="text"
                variant="outlined"
                size="sm"
                value={customChoiceNotes[q.id] || ""}
                onChange={(e) =>
                  setCustomChoiceNotes((prev) => ({
                    ...prev,
                    [q.id]: e.target.value,
                  }))
                }
                placeholder="Type additional items..."
              />
            </div>
          </fieldset>
        )}

        {/* TIMEFRAME WINDOW PICKER */}
        {q.inputType === "timeframe" && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-title leading-snug">
              <span className="text-primary-400 font-mono mr-1.5">
                {stepIdx + 1}.
              </span>
              {q.question}
            </legend>
            {q.helperText && (
              <p className="text-xs text-caption">{q.helperText}</p>
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
                    className={`flex items-center gap-2 rounded-[--btn-radius] border px-3 py-2 text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary-500/60 bg-primary-500/15 text-primary-300 font-semibold"
                        : "border-[--ui-border-color] bg-[--ui-soft-bg]/50 text-body hover:text-title"
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

            <div className="grid grid-cols-2 gap-3 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-soft-bg]/40 p-3">
              <div>
                <label
                  htmlFor={`${fieldId}-start`}
                  className="flex items-center gap-1 text-[11px] font-semibold text-caption mb-1"
                >
                  <Clock className="size-3 text-primary-400" />
                  <span>Start Time</span>
                </label>
                <Input
                  id={`${fieldId}-start`}
                  name="qa_start_time"
                  type="time"
                  variant="outlined"
                  size="sm"
                  value={startTime}
                  onChange={(e) => {
                    setTimeframePreset("custom");
                    setStartTime(e.target.value);
                  }}
                  className="font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor={`${fieldId}-end`}
                  className="flex items-center gap-1 text-[11px] font-semibold text-caption mb-1"
                >
                  <CalendarClock className="size-3 text-primary-400" />
                  <span>Planned End Time</span>
                </label>
                <Input
                  id={`${fieldId}-end`}
                  name="qa_end_time"
                  type="time"
                  variant="outlined"
                  size="sm"
                  value={endTime}
                  onChange={(e) => {
                    setTimeframePreset("custom");
                    setEndTime(e.target.value);
                  }}
                  className="font-mono"
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
    <Card variant="mixed" fancy className="p-0 backdrop-blur-xl overflow-hidden">
      <form
        onSubmit={handleFormSubmit}
        action="/api/chat"
        method="POST"
        className="p-4 sm:p-5 space-y-4"
      >
        {/* Header + Progress Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--ui-border-color] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-[--btn-radius] border border-primary-500/35 bg-primary-500/15 text-primary-400">
              <ListChecks className="size-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-title">
                {qaPrompt.purpose === "plan_day"
                  ? "Day Planning Q&A"
                  : "Guided Q&A"}
              </div>
              <div className="text-[11px] text-caption">
                {showAllAtOnce
                  ? `Showing all ${questions.length} questions`
                  : `Question ${activeStep + 1} of ${questions.length}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showAllAtOnce && questions.length > 1 && (
              <div
                className="flex items-center gap-1"
                role="tablist"
                aria-label="Question steps"
              >
                {questions.map((q, idx) => {
                  const hasVal = resolveAnswerForQuestion(q).length > 0;
                  const isCurrent = idx === activeStep;
                  return (
                    <Button.Root
                      key={q.id}
                      variant={
                        isCurrent ? "solid" : hasVal ? "soft" : "outlined"
                      }
                      intent={isCurrent || hasVal ? "primary" : "gray"}
                      size="xs"
                      onClick={() => {
                        setValidationError(null);
                        setActiveStep(idx);
                      }}
                      className="h-6 min-w-[24px] px-1.5 font-mono text-[11px]"
                      title={q.question}
                    >
                      <Button.Label>{idx + 1}</Button.Label>
                    </Button.Root>
                  );
                })}
              </div>
            )}

            {questions.length > 1 && (
              <Button.Root
                variant="outlined"
                intent="gray"
                size="xs"
                onClick={() => setShowAllAtOnce((v) => !v)}
                className="h-6 px-2.5 text-[11px]"
              >
                <Button.Label>
                  {showAllAtOnce ? "Step-by-step" : "Show all"}
                </Button.Label>
              </Button.Root>
            )}

            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              onClick={onDismiss}
              title="Cancel Q&A"
            >
              <Button.Icon type="only" size="xs">
                <X />
              </Button.Icon>
            </Button.Root>
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
            <div className="rounded-[--btn-radius] border border-warning-500/35 bg-warning-500/10 px-3 py-2 text-xs text-warning-200">
              {validationError}
            </div>
          )}
        </div>

        {/* Navigation & Submit Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[--ui-border-color] pt-3">
          <div>
            {!showAllAtOnce && activeStep > 0 && (
              <Button.Root
                variant="outlined"
                intent="gray"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  setValidationError(null);
                  setActiveStep((s) => Math.max(0, s - 1));
                }}
              >
                <Button.Icon type="leading" size="xs">
                  <ArrowLeft />
                </Button.Icon>
                <Button.Label>Back</Button.Label>
              </Button.Root>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isOnFinalStep ? (
              <Button.Root
                variant="solid"
                intent="primary"
                size="sm"
                disabled={disabled}
                onClick={handleNextStep}
                className="font-semibold"
              >
                <Button.Label>Next Question</Button.Label>
                <Button.Icon type="trailing" size="xs">
                  <ArrowRight className="stroke-[2.5]" />
                </Button.Icon>
              </Button.Root>
            ) : (
              <Button.Root
                type="submit"
                variant="solid"
                intent="primary"
                size="sm"
                disabled={disabled}
                className="font-semibold"
              >
                <Button.Icon type="leading" size="xs">
                  <Check className="stroke-[2.5]" />
                </Button.Icon>
                <Button.Label>
                  {qaPrompt.submitLabel ||
                    (qaPrompt.purpose === "plan_day"
                      ? "Populate Tasks & Build my day"
                      : "Submit Answers & Fulfill Request")}
                </Button.Label>
              </Button.Root>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
};
