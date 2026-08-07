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
    <section className="glass-card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {quiz.length > 0 ? `自测题（${quiz.length} 道）` : "自测题"}
        </h2>
        {quiz.length > 0 && (
          <button
            onClick={onGenerateQuiz}
            disabled={quizLoading}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--accent-teal)' }}
          >
            重新出题
          </button>
        )}
      </div>

      {quiz.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
                  className="flex flex-col gap-3 rounded-xl border p-4"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {gi + 1}. {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = oi === q.answer;
                      const isPicked = picked === oi;
                      let style: React.CSSProperties = {};
                      if (!revealed) {
                        style = {
                          background: 'rgba(255,255,255,0.03)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        };
                      } else if (isCorrect) {
                        style = {
                          background: 'rgba(52,211,153,0.08)',
                          borderColor: 'rgba(52,211,153,0.25)',
                          color: 'var(--accent-emerald)',
                        };
                      } else if (isPicked) {
                        style = {
                          background: 'rgba(251,113,133,0.08)',
                          borderColor: 'rgba(251,113,133,0.2)',
                          color: 'var(--accent-coral)',
                        };
                      } else {
                        style = {
                          background: 'transparent',
                          borderColor: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-muted)',
                        };
                      }
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={revealed}
                          onClick={() => onPickOption(gi, oi)}
                          className="rounded-lg border px-3 py-2 text-sm transition-all duration-180 hover:border-white/20"
                          style={style}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {revealed && (
                    <div className="flex flex-col gap-2">
                      <div
                        className="rounded-lg px-3 py-2 text-xs leading-relaxed"
                        style={{
                          background: picked === q.answer
                            ? 'rgba(52,211,153,0.06)'
                            : 'rgba(251,191,36,0.06)',
                          color: picked === q.answer
                            ? 'var(--accent-emerald)'
                            : 'var(--accent-amber)',
                        }}
                      >
                        {picked === q.answer ? "✅ 答对了！" : "❌ 答错了。"}{" "}
                        {q.explanation}
                      </div>
                      {q.evidence ? (
                        <div className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
                          style={{
                            borderColor: 'rgba(255,255,255,0.06)',
                            background: 'rgba(0,0,0,0.15)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>📌 原文依据：</span>
                          「{q.evidence}」
                        </div>
                      ) : null}
                      {picked !== q.answer &&
                        (savedQuizIdx.has(gi) ? (
                          <span className="text-xs font-medium" style={{ color: 'var(--accent-emerald)' }}>
                            ✓ 已收入错题本
                          </span>
                        ) : !isSignedIn ? (
                          <a
                            href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
                            className="self-start text-xs underline opacity-70 hover:opacity-100"
                            style={{ color: 'var(--accent-teal)' }}
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
                            className="btn-primary-glow self-start px-3 py-1 text-xs disabled:opacity-50"
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
          <div className="flex items-center justify-between gap-4 border-t pt-3" style={{ borderColor: 'var(--glass-border)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              得分：{score().correct} / {score().total}
            </span>
            <button
              onClick={onResetQuiz}
              className="glass-btn px-3 py-1 text-xs font-medium"
            >
              重新答题
            </button>
          </div>
        </>
      )}
    </section>
  );
}
