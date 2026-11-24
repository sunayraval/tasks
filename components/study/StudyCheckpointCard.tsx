"use client";

import React, { useState } from "react";
import { StudyCheckpoint, StudyMCQOption } from "@/types/study";
import { renderStudyInline } from "@/components/study/StudyMarkdown";
import {
  ArrowRight,
  CheckCircle2,
  FastForward,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

interface StudyCheckpointCardProps {
  checkpoint: StudyCheckpoint;
  subtopicTitle: string;
  isLatestTurn: boolean;
  isBusy: boolean;
  onSelectMcqOption: (
    checkpoint: StudyCheckpoint,
    option: StudyMCQOption
  ) => void;
  onSubmitShortAnswer: (
    checkpoint: StudyCheckpoint,
    answerText: string
  ) => void;
  onSkipKnown: (subtopicId: string) => void;
  onRequestNextLesson?: () => void;
}

export const StudyCheckpointCard: React.FC<StudyCheckpointCardProps> = ({
  checkpoint,
  subtopicTitle,
  isLatestTurn,
  isBusy,
  onSelectMcqOption,
  onSubmitShortAnswer,
  onSkipKnown,
  onRequestNextLesson,
}) => {
  const [showHint, setShowHint] = useState(false);
  const [shortAnswerInput, setShortAnswerInput] = useState(
    checkpoint.userShortAnswer || ""
  );

  const selectedOption =
    checkpoint.options?.find(
      (o) => o.id === checkpoint.userSelectedOptionId
    ) || null;

  const handleShortAnswerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortAnswerInput.trim() || isBusy) return;
    onSubmitShortAnswer(checkpoint, shortAnswerInput.trim());
  };

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-primary/35 bg-black/50 shadow-xl">
      {/* Checkpoint Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-primary/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/25 border border-primary/40 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight">
            <HelpCircle className="h-3 w-3 text-primary" />
            Comprehension Gate
          </span>
          <span className="text-xs font-medium text-white/75 truncate max-w-[240px] sm:max-w-xs">
            {checkpoint.questionType === "mcq"
              ? "Multiple-Choice Check"
              : "Active Recall Prompt"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {checkpoint.hint && (
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 transition-colors"
            >
              <Lightbulb className="h-3 w-3 text-amber-400" />
              <span>{showHint ? "Hide Hint" : "Hint"}</span>
            </button>
          )}

          {!checkpoint.isCorrect && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onSkipKnown(checkpoint.subtopicId)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/75 hover:text-white hover:border-primary/40 transition-colors disabled:opacity-50"
              title="Bypass teaching this subtopic and count it toward completed progress"
            >
              <FastForward className="h-3 w-3 text-primary" />
              <span>I already know this</span>
            </button>
          )}
        </div>
      </div>

      {/* Checkpoint Body */}
      <div className="p-4 space-y-3.5">
        {/* Question Text */}
        <div className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
          {renderStudyInline(checkpoint.question)}
        </div>

        {/* Optional Hint */}
        {showHint && checkpoint.hint && (
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{renderStudyInline(checkpoint.hint)}</span>
          </div>
        )}

        {/* Multiple-Choice Options */}
        {checkpoint.questionType === "mcq" && checkpoint.options && (
          <div className="space-y-2">
            {checkpoint.options.map((opt) => {
              const isSelected = checkpoint.userSelectedOptionId === opt.id;
              const showAsCorrect = isSelected && opt.isCorrect;
              const showAsWrong = isSelected && !opt.isCorrect;

              return (
                <div key={opt.id} className="space-y-1.5">
                  <button
                    type="button"
                    disabled={isBusy || Boolean(checkpoint.isCorrect)}
                    onClick={() => onSelectMcqOption(checkpoint, opt)}
                    className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left text-xs sm:text-sm transition-all ${
                      showAsCorrect
                        ? "border-emerald-400/60 bg-emerald-500/15 text-white shadow-sm"
                        : showAsWrong
                        ? "border-rose-400/60 bg-rose-500/15 text-white shadow-sm"
                        : "border-white/12 bg-white/[0.03] text-zinc-200 hover:border-primary/50 hover:bg-white/[0.07]"
                    } disabled:cursor-default`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold border ${
                        showAsCorrect
                          ? "border-emerald-400 bg-emerald-500 text-black"
                          : showAsWrong
                          ? "border-rose-400 bg-rose-500 text-white"
                          : "border-white/20 bg-white/10 text-highlight"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {renderStudyInline(opt.text)}
                    </span>
                    {showAsCorrect && (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {showAsWrong && (
                      <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </button>

                  {/* Targeted Immediate Explanation for Selected Option */}
                  {isSelected && (
                    <div
                      className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                        opt.isCorrect
                          ? "border-emerald-500/35 bg-emerald-950/35 text-emerald-200"
                          : "border-rose-500/35 bg-rose-950/35 text-rose-200"
                      }`}
                    >
                      <div className="font-bold mb-0.5 flex items-center gap-1.5">
                        {opt.isCorrect ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>
                              Correct! &ldquo;{subtopicTitle}&rdquo; Mastered
                            </span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
                            <span>
                              Not quite — Let&apos;s break down why &amp; try a
                              clearer angle
                            </span>
                          </>
                        )}
                      </div>
                      <div>{renderStudyInline(opt.explanation)}</div>
                    </div>
                  )}
                </div>
              );
            })}

            {selectedOption?.isCorrect &&
              isLatestTurn &&
              onRequestNextLesson &&
              !isBusy && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onRequestNextLesson}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all shadow-neon"
                  >
                    <span>Continue to Next Micro-Lesson</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Short-Answer / Active Recall Input */}
        {checkpoint.questionType === "short_answer" && (
          <form onSubmit={handleShortAnswerFormSubmit} className="space-y-2.5">
            <textarea
              value={shortAnswerInput}
              onChange={(e) => setShortAnswerInput(e.target.value)}
              disabled={isBusy || Boolean(checkpoint.isCorrect)}
              rows={3}
              placeholder="Explain the concept in your own words..."
              className="w-full rounded-xl border border-white/15 bg-black/45 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/35 focus:border-primary focus:outline-none disabled:opacity-60"
            />

            {checkpoint.aiFeedback && (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${
                  checkpoint.isCorrect
                    ? "border-emerald-500/35 bg-emerald-950/35 text-emerald-200"
                    : "border-amber-500/35 bg-amber-950/35 text-amber-200"
                }`}
              >
                <div className="font-bold mb-0.5 flex items-center gap-1.5">
                  {checkpoint.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Concept Mastered!</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                      <span>Adaptive Feedback — Let&apos;s Refine This</span>
                    </>
                  )}
                </div>
                <div>{renderStudyInline(checkpoint.aiFeedback)}</div>
              </div>
            )}

            {!checkpoint.isCorrect && (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!shortAnswerInput.trim() || isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Evaluating...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Verify My Explanation</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
