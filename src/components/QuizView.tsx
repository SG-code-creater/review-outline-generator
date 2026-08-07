"use client";

import { type QuizItem } from "@/components/view-types";

interface QuizViewProps {
  quiz: QuizItem[];
  quizLoading: boolean;
  quizPicked: number[];
  quizRevealed: boolean[];
  savedQuizIdx: Set<number>;
  saveMistakeState: "idle" | "saving" | "saved" | "error";
  saveMistakeIdx: number | null;
  isSignedIn: boolean | undefined;
  onGenerateQuiz: () => void;
  onPickOption: (qi: number, oi: number) => void;
  onSaveMistake: (gi: number) => void;
  onResetQuiz: () => void;
}

export default function QuizView({
  quiz,
  quizLoading,
  quizPicked,
  quizRevealed,
  savedQuizIdx,
  saveMistakeState,
  saveMistakeIdx,
  isSignedIn,
  onGenerateQuiz,
  onPickOption,
  onSaveMistake,
  onResetQuiz,
}: QuizViewProps) {
  function score() {
    let correct = 0,
      total = 0;
    quiz.forEach((q, i) => {
      const p = quizPicked[i] ?? -1;
      if (p >= 0) {
        total++;
        if (p === q.answer) correct++;
      }
    });
    return { correct, total };
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-700">
          {quiz.length > 0 ? `自测题（${quiz.length} 道）` : "自测题"}
        </h2>
        {quiz.length > 0 && (
          <button
            onClick={onGenerateQuiz}
            disabled={quizLoading}
            className="text-xs text-stone-500 underline hover:text-teal-700 disabled:opacity-50"
          >
            重新出题
          </button>
        )}
      </div>

      {quiz.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">
          在上方粘贴或上传资料，点击「生成自测题」即可开始主动回忆。
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-5">
            {quiz.map((q, gi) => {
              const picked = quizPicked[gi] ?? -1;
              const revealed = quizRevealed[gi] ?? false;
              return (
                <div
                  key={gi}
                  className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4"
                >
                  <p className="text-sm font-medium leading-relaxed text-stone-900">
                    {gi + 1}. {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.answer;
                      const isPicked = picked === oi;
                      let cls =
                        "rounded-lg border px-3 py-2 text-sm transition-colors ";
                      if (!revealed) {
                        cls +=
                          "border-stone-200 bg-white text-stone-800 hover:border-teal-400 hover:bg-teal-50 cursor-pointer";
                      } else if (isCorrect) {
                        cls += "border-emerald-300 bg-emerald-50 text-emerald-800";
                      } else if (isPicked) {
                        cls += "border-red-300 bg-red-50 text-red-700";
                      } else {
                        cls += "border-stone-200 bg-white text-stone-400";
                      }
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={revealed}
                          onClick={() => onPickOption(gi, oi)}
                          className={cls}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {revealed && (
                    <div className="flex flex-col gap-2">
                      <div
                        className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                          picked === q.answer
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {picked === q.answer ? "✅ 答对了！" : "❌ 答错了。"}{" "}
                        {q.explanation}
                      </div>
                      {q.evidence ? (
                        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs leading-relaxed text-stone-600">
                          <span className="font-medium text-stone-500">📌 原文依据：</span>
                          「{q.evidence}」
                        </div>
                      ) : null}
                      {picked !== q.answer &&
                        (savedQuizIdx.has(gi) ? (
                          <span className="text-xs font-medium text-emerald-600">
                            ✓ 已收入错题本
                          </span>
                        ) : !isSignedIn ? (
                          <a
                            href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
                            className="self-start text-xs text-teal-700 underline hover:text-teal-800"
                          >
                            登录后收入错题本
                          </a>
                        ) : (
                          <button
                            onClick={() => onSaveMistake(gi)}
                            disabled={
                              saveMistakeState === "saving" &&
                              saveMistakeIdx === gi
                            }
                            className="self-start rounded-full bg-stone-800 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-stone-900 disabled:opacity-50"
                          >
                            {saveMistakeState === "saving" &&
                            saveMistakeIdx === gi
                              ? "收录中…"
                              : "收入错题本"}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 计分条 */}
          <div className="flex items-center justify-between border-t border-stone-100 pt-3">
            <span className="text-sm font-medium text-stone-700">
              得分：{score().correct} / {score().total}
            </span>
            <button
              onClick={onResetQuiz}
              className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-teal-500 hover:text-teal-700"
            >
              重新答题
            </button>
          </div>
        </>
      )}
    </section>
  );
}
