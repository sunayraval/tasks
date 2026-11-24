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
import { Badge, Button, Card, Textarea } from "@/components/tailus-ui";

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
    <Card
      variant="mixed"
      fancy
      className="mt-4 p-0 overflow-hidden shadow-lg"
    >
      {/* Checkpoint Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--ui-border-color] bg-primary-500/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Badge
            variant="soft"
            intent="primary"
            size="xs"
            className="inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-wider"
          >
            <HelpCircle className="size-3" />
            Comprehension Gate
          </Badge>
          <span className="text-xs font-medium text-caption truncate max-w-[240px] sm:max-w-xs">
            {checkpoint.questionType === "mcq"
              ? "Multiple-Choice Check"
              : "Active Recall Prompt"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {checkpoint.hint && (
            <Button.Root
              variant="soft"
              intent="warning"
              size="xs"
              onClick={() => setShowHint((v) => !v)}
              className="h-6 px-2 text-[11px]"
            >
              <Button.Icon type="leading" size="xs">
                <Lightbulb />
              </Button.Icon>
              <Button.Label>{showHint ? "Hide Hint" : "Hint"}</Button.Label>
            </Button.Root>
          )}

          {!checkpoint.isCorrect && (
            <Button.Root
              variant="outlined"
              intent="gray"
              size="xs"
              disabled={isBusy}
              onClick={() => onSkipKnown(checkpoint.subtopicId)}
              className="h-6 px-2.5 text-[11px]"
              title="Bypass teaching this subtopic and count it toward completed progress"
            >
              <Button.Icon type="leading" size="xs">
                <FastForward className="text-primary-400" />
              </Button.Icon>
              <Button.Label>I already know this</Button.Label>
            </Button.Root>
          )}
        </div>
      </div>

      {/* Checkpoint Body */}
      <div className="p-4 space-y-3.5">
        {/* Question Text */}
        <div className="text-xs sm:text-sm font-semibold text-title leading-relaxed">
          {renderStudyInline(checkpoint.question)}
        </div>

        {/* Optional Hint */}
        {showHint && checkpoint.hint && (
          <Card
            variant="outlined"
            className="border-warning-500/30 bg-warning-500/10 px-3.5 py-2 text-xs text-warning-200 flex items-start gap-2"
          >
            <Lightbulb className="size-4 text-warning-400 shrink-0 mt-0.5" />
            <span>{renderStudyInline(checkpoint.hint)}</span>
          </Card>
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
                    className={`w-full flex items-start gap-3 rounded-[--btn-radius] border p-3 text-left text-xs sm:text-sm transition-all ${
                      showAsCorrect
                        ? "border-success-500/60 bg-success-500/15 text-title shadow-sm"
                        : showAsWrong
                        ? "border-danger-500/60 bg-danger-500/15 text-title shadow-sm"
                        : "border-[--ui-border-color] bg-[--ui-soft-bg]/50 text-body hover:border-primary-500/50 hover:text-title"
                    } disabled:cursor-default`}
                  >
                    <span
                      className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold border ${
                        showAsCorrect
                          ? "border-success-400 bg-success-500 text-black"
                          : showAsWrong
                          ? "border-danger-400 bg-danger-500 text-white"
                          : "border-[--ui-border-color] bg-[--ui-bg] text-primary-300"
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {renderStudyInline(opt.text)}
                    </span>
                    {showAsCorrect && (
                      <CheckCircle2 className="size-5 text-success-400 shrink-0 mt-0.5" />
                    )}
                    {showAsWrong && (
                      <XCircle className="size-5 text-danger-400 shrink-0 mt-0.5" />
                    )}
                  </button>

                  {/* Targeted Immediate Explanation for Selected Option */}
                  {isSelected && (
                    <div
                      className={`rounded-[--btn-radius] border px-3.5 py-2.5 text-xs leading-relaxed ${
                        opt.isCorrect
                          ? "border-success-500/35 bg-success-500/10 text-success-200"
                          : "border-danger-500/35 bg-danger-500/10 text-danger-200"
                      }`}
                    >
                      <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                        {opt.isCorrect ? (
                          <>
                            <CheckCircle2 className="size-3.5 text-success-400" />
                            <span>
                              Correct! &ldquo;{subtopicTitle}&rdquo; Mastered
                            </span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="size-3.5 text-danger-400" />
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
                  <Button.Root
                    variant="solid"
                    intent="primary"
                    size="sm"
                    onClick={onRequestNextLesson}
                    className="font-semibold"
                  >
                    <Button.Label>Continue to Next Micro-Lesson</Button.Label>
                    <Button.Icon type="trailing" size="xs">
                      <ArrowRight />
                    </Button.Icon>
                  </Button.Root>
                </div>
              )}
          </div>
        )}

        {/* Short-Answer / Active Recall Input */}
        {checkpoint.questionType === "short_answer" && (
          <form onSubmit={handleShortAnswerFormSubmit} className="space-y-2.5">
            <Textarea
              variant="outlined"
              value={shortAnswerInput}
              onChange={(e) => setShortAnswerInput(e.target.value)}
              disabled={isBusy || Boolean(checkpoint.isCorrect)}
              rows={3}
              placeholder="Explain the concept in your own words..."
            />

            {checkpoint.aiFeedback && (
              <div
                className={`rounded-[--btn-radius] border px-3.5 py-2.5 text-xs leading-relaxed ${
                  checkpoint.isCorrect
                    ? "border-success-500/35 bg-success-500/10 text-success-200"
                    : "border-warning-500/35 bg-warning-500/10 text-warning-200"
                }`}
              >
                <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                  {checkpoint.isCorrect ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-success-400" />
                      <span>Concept Mastered!</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="size-3.5 text-warning-400" />
                      <span>Adaptive Feedback — Let&apos;s Refine This</span>
                    </>
                  )}
                </div>
                <div>{renderStudyInline(checkpoint.aiFeedback)}</div>
              </div>
            )}

            {!checkpoint.isCorrect && (
              <div className="flex justify-end">
                <Button.Root
                  type="submit"
                  variant="solid"
                  intent="primary"
                  size="sm"
                  disabled={!shortAnswerInput.trim() || isBusy}
                  className="font-semibold"
                >
                  <Button.Icon type="leading" size="xs">
                    {isBusy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Send />
                    )}
                  </Button.Icon>
                  <Button.Label>
                    {isBusy ? "Evaluating..." : "Verify My Explanation"}
                  </Button.Label>
                </Button.Root>
              </div>
            )}
          </form>
        )}
      </div>
    </Card>
  );
};
