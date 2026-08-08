"use client";

import { useState, useEffect } from "react";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";

// 试卷分析视图：粘贴试卷文本 → AI 识别题目 + 诊断薄弱点 → 勾选题目一键导入错题本。
// 导入复用现有 /api/mistakes/upload（origin='upload'），错题直接进「错题本」与复习体系。

interface PaperQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  evidence?: string;
  knowledgePoint?: string;
  difficulty?: number;
}

interface WeakPoint {
  point: string;
  count: number;
  advice: string;
}

const DIFF_LABEL: Record<number, { text: string; color: string }> = {
  1: { text: "易", color: "rgba(16,185,129,0.9)" },
  2: { text: "中", color: "rgba(245,158,11,0.95)" },
  3: { text: "难", color: "rgba(239,68,68,0.95)" },
};

export default function PaperAnalysisView({
  isSignedIn,
}: {
  isSignedIn?: boolean;
}) {
  const [text, setText] = useState("");
  const [scenario, setScenario] = useState<Scenario>("通用");
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState("");
  const [questions, setQuestions] = useState<PaperQuestion[]>([]);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    weakPoints: WeakPoint[];
  } | null>(null);

  // 勾选态：默认全部选入错题本
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function startAnalyze() {
    if (!text.trim()) {
      setErr("请先粘贴或输入试卷内容。");
      return;
    }
    setErr("");
    setAnalyzing(true);
    setQuestions([]);
    setAnalysis(null);
    fetch("/api/analyze-paper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, scenario }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "分析失败");
        return data;
      })
      .then((data) => {
        const qs: PaperQuestion[] = data.questions || [];
        setQuestions(qs);
        setAnalysis(data.analysis || null);
        setSelected(new Set(qs.map((_, i) => i)));
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "分析失败"))
      .finally(() => setAnalyzing(false));
  }

  function toggle(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function importSelected() {
    const picked = questions.filter((_, i) => selected.has(i));
    if (picked.length === 0) {
      setToast("请先勾选要导入的题目");
      return;
    }
    setImporting(true);
    setErr("");
    try {
      const res = await fetch("/api/mistakes/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: picked, scenario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "导入失败");
      setToast(`已导入 ${data.count} 题到错题本，去「错题本」再练 →`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  if (!isSignedIn) {
    return (
      <section className="glass-card flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          📊 试卷分析
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          上传或粘贴一份试卷 / 练习，AI 帮你识别题目、定位薄弱考点，并一键导入错题本反复练。
        </p>
        <div
          className="rounded-xl border px-4 py-6 text-center text-sm"
          style={{
            borderColor: "rgba(45,212,191,0.25)",
            background: "rgba(45,212,191,0.06)",
            color: "var(--text-secondary)",
          }}
        >
          登录后即可使用试卷分析功能。
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            📊 试卷分析
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            粘贴试卷内容，AI 识别题目并诊断薄弱考点，一键导入错题本反复练。
          </p>
        </div>
        <button
          onClick={() => {
            setQuestions([]);
            setAnalysis(null);
            setText("");
            setErr("");
          }}
          className="glass-btn px-3 py-1.5 text-xs"
          style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
        >
          清空重来
        </button>
      </div>

      {/* 输入区 */}
      <div className="glass-card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
            考试场景
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScenario(s)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={
                  s === scenario
                    ? {
                        background: "rgba(45,212,191,0.14)",
                        color: "var(--accent-teal)",
                        border: "1px solid rgba(45,212,191,0.3)",
                      }
                    : {
                        background: "rgba(255,255,255,0.03)",
                        color: "var(--text-secondary)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴试卷 / 练习的题目与内容（支持含选项、答案或你的作答）。AI 会从中识别题目并分析薄弱点。"
          className="glass-input min-h-[160px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)" }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={startAnalyze}
            disabled={analyzing || !text.trim()}
            className="glass-btn inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium"
            style={
              analyzing || !text.trim()
                ? { opacity: 0.5, color: "var(--text-secondary)", borderColor: "var(--glass-border)" }
                : {
                    background: "var(--gradient-teal)",
                    color: "#06281f",
                    borderColor: "transparent",
                    fontWeight: 600,
                  }
            }
          >
            {analyzing ? "分析中…" : "🔍 分析试卷"}
          </button>
          {analyzing && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              正在调用 AI 识别题目并诊断薄弱点，请稍候…
            </span>
          )}
        </div>
        {err && (
          <p className="text-xs" style={{ color: "var(--color-error, #ef4444)" }}>
            {err}
          </p>
        )}
      </div>

      {/* 分析结果 */}
      {analysis && (
        <div className="flex flex-col gap-4">
          {/* 总体评价 */}
          <div
            className="glass-card flex items-start gap-3 p-5"
            style={{ borderColor: "rgba(45,212,191,0.25)" }}
          >
            <span className="mt-0.5 text-xl">🧭</span>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--accent-teal)" }}>
                总体评价
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {analysis.summary}
              </p>
            </div>
          </div>

          {/* 薄弱考点 */}
          {analysis.weakPoints.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                薄弱考点与复习建议
              </p>
              {analysis.weakPoints.map((w, i) => (
                <div key={i} className="glass-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {w.point}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: "rgba(239,68,68,0.12)",
                        color: "rgba(248,113,113,0.95)",
                      }}
                    >
                      涉及 {w.count} 题
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    💡 {w.advice}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 题目列表 */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                识别出的题目（共 {questions.length} 题，勾选后导入错题本）
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(new Set(questions.map((_, i) => i)))}
                  className="glass-btn px-3 py-1 text-xs"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
                >
                  全选
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="glass-btn px-3 py-1 text-xs"
                  style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
                >
                  取消全选
                </button>
              </div>
            </div>

            {questions.map((q, i) => {
              const checked = selected.has(i);
              const isOpen = expanded.has(i);
              const diff = DIFF_LABEL[q.difficulty ?? 2];
              return (
                <div
                  key={i}
                  className="glass-card p-4"
                  style={
                    checked
                      ? { borderColor: "rgba(45,212,191,0.35)", background: "rgba(45,212,191,0.04)" }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(i)}
                      className="mt-1 h-4 w-4 accent-teal-500"
                      style={{ accentColor: "var(--accent-teal)" }}
                      aria-label={`选择第 ${i + 1} 题`}
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          第 {i + 1} 题
                        </span>
                        {q.knowledgePoint && (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: "rgba(139,92,246,0.14)",
                              color: "rgba(167,139,250,0.95)",
                            }}
                          >
                            {q.knowledgePoint}
                          </span>
                        )}
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ background: "rgba(255,255,255,0.05)", color: diff.color }}
                        >
                          难度·{diff.text}
                        </span>
                      </div>

                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                        {q.question}
                      </p>

                      <ul className="mt-2 flex flex-col gap-1">
                        {q.options.map((opt, oi) => (
                          <li
                            key={oi}
                            className="flex items-start gap-2 text-sm"
                            style={{
                              color:
                                oi === q.answer
                                  ? "var(--color-success, #10b981)"
                                  : "var(--text-secondary)",
                              fontWeight: oi === q.answer ? 600 : 400,
                            }}
                          >
                            <span
                              className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px]"
                              style={{
                                background:
                                  oi === q.answer
                                    ? "rgba(16,185,129,0.18)"
                                    : "rgba(255,255,255,0.05)",
                              }}
                            >
                              {oi === q.answer ? "✓" : String.fromCharCode(65 + oi)}
                            </span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => toggleExpand(i)}
                        className="mt-2 text-xs"
                        style={{ color: "var(--accent-teal)" }}
                      >
                        {isOpen ? "收起解析 ▲" : "查看解析 ▼"}
                      </button>
                      {isOpen && (
                        <div
                          className="mt-2 rounded-lg px-3 py-2 text-sm leading-relaxed"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <p>
                            <span style={{ color: "var(--accent-teal)" }}>解析：</span>
                            {q.explanation}
                          </p>
                          {q.evidence && (
                            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              原文依据：「{q.evidence}」
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={importSelected}
                disabled={importing || selected.size === 0}
                className="glass-btn inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium"
                style={
                  importing || selected.size === 0
                    ? { opacity: 0.5, color: "var(--text-secondary)", borderColor: "var(--glass-border)" }
                    : {
                        background: "var(--gradient-teal)",
                        color: "#06281f",
                        borderColor: "transparent",
                        fontWeight: 600,
                      }
                }
              >
                {importing ? "导入中…" : `📥 导入选中的 ${selected.size} 题到错题本`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm shadow-lg"
          style={{
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(45,212,191,0.35)",
            color: "var(--text-primary)",
          }}
        >
          {toast}
        </div>
      )}
    </section>
  );
}
