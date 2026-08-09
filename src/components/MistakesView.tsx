"use client";

import { type RefObject, useState } from "react";
import { type Mistake } from "@/components/view-types";
import { highlightSource } from "@/components/shared-ui";
import EmptyState from "@/components/EmptyState";

// 错因类型（与 upload 接口 prompt 枚举保持一致）
export const MISTAKE_CAUSES = [
  "概念混淆",
  "计算失误",
  "审题偏差",
  "公式定理遗忘",
  "解题思路",
  "其他",
] as const;

// 错因 → 配色（背景 / 文字）
const CAUSE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  概念混淆: { bg: "rgba(167,139,250,0.1)", color: "var(--accent-purple)", border: "rgba(167,139,250,0.2)" },
  计算失误: { bg: "rgba(250,204,21,0.1)", color: "#EAB308", border: "rgba(250,204,21,0.2)" },
  审题偏差: { bg: "rgba(56,138,221,0.1)", color: "var(--accent-blue)", border: "rgba(56,138,221,0.2)" },
  公式定理遗忘: { bg: "rgba(45,212,191,0.1)", color: "var(--accent-teal)", border: "rgba(45,212,191,0.2)" },
  解题思路: { bg: "rgba(251,113,133,0.1)", color: "var(--accent-coral)", border: "rgba(251,113,133,0.2)" },
  其他: { bg: "rgba(255,255,255,0.05)", color: "var(--text-secondary)", border: "rgba(255,255,255,0.1)" },
};

function causeStyle(cause: string | null | undefined) {
  if (!cause || !CAUSE_STYLE[cause]) {
    return { bg: "rgba(255,255,255,0.03)", color: "var(--text-muted)", border: "rgba(255,255,255,0.08)" };
  }
  return CAUSE_STYLE[cause];
}

interface MistakesViewProps {
  isSignedIn: boolean | undefined;
  mistakes: Mistake[];
  mistakeOrigin: "all" | "quiz" | "upload";
  setMistakeOrigin: (v: "all" | "quiz" | "upload") => void;
  mistakeLoading: boolean;
  openMistakeId: string | null;
  setOpenMistakeId: (id: string | null) => void;
  uploadDragOver: boolean;
  setUploadDragOver: (b: boolean) => void;
  mistakeFileRef: RefObject<HTMLInputElement | null>;
  handleMistakeFile: (file?: File | null) => void;
  uploadExtracting: boolean;
  uploadMistakeText: string;
  setUploadMistakeText: (s: string) => void;
  uploadMsg: string;
  setUploadMsg: (s: string) => void;
  uploadingMistakes: boolean;
  uploadMistakesToServer: () => void;
}

export default function MistakesView({
  isSignedIn,
  mistakes,
  mistakeOrigin,
  setMistakeOrigin,
  mistakeLoading,
  openMistakeId,
  setOpenMistakeId,
  uploadDragOver,
  setUploadDragOver,
  mistakeFileRef,
  handleMistakeFile,
  uploadExtracting,
  uploadMistakeText,
  setUploadMistakeText,
  uploadMsg,
  setUploadMsg,
  uploadingMistakes,
  uploadMistakesToServer,
}: MistakesViewProps) {
  const [causeFilter, setCauseFilter] = useState<string>("all");

  return (
    <section className="glass-card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>错题本</h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>共 {mistakes.length} 题</span>
      </div>

      {!isSignedIn ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>登录后即可查看你的错题本。</p>
          <a
            href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
            className="btn-primary-glow px-5 py-2 text-sm"
          >
            登录
          </a>
        </div>
      ) : (
        <>
          {/* ── 上传错题区（PDF/图片/拍照 → AI 识别 → 入库） ── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setUploadDragOver(true);
            }}
            onDragLeave={() => setUploadDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setUploadDragOver(false);
              handleMistakeFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200 ${
              uploadDragOver ? 'glass-card-active' : ''
            }`}
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderColor: uploadDragOver ? 'rgba(45,212,191,0.25)' : 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                上传错题（试卷/作业/笔记截图）
              </span>
              <input
                ref={mistakeFileRef}
                type="file"
                accept=".pdf,image/*,capture=camera"
                className="hidden"
                onChange={(e) => handleMistakeFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => mistakeFileRef.current?.click()}
                disabled={uploadExtracting || uploadingMistakes}
                className="glass-btn shrink-0 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ borderColor: 'rgba(167,139,250,0.25)', color: 'var(--accent-purple)' }}
              >
                {uploadExtracting ? "解析中…" : "选择文件"}
              </button>
            </div>

            {uploadMistakeText ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={uploadMistakeText}
                  onChange={(e) => setUploadMistakeText(e.target.value)}
                  placeholder="识别出的文本（可手动修改）…"
                  className="glass-input h-28 w-full resize-y p-3 text-xs"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {uploadMsg ||
                      `${uploadMistakeText.length} 字 · 修改后点击识别`
                  }
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setUploadMistakeText(""); setUploadMsg(""); }}
                      className="glass-btn px-3 py-1 text-xs"
                    >
                      清除
                    </button>
                    <button
                      type="button"
                      onClick={uploadMistakesToServer}
                      disabled={uploadingMistakes || !uploadMistakeText.trim()}
                      className="btn-primary-glow px-4 py-1.5 text-xs disabled:opacity-50"
                    >
                      {uploadingMistakes ? "AI 识别中…" : "识别错题"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  uploadDragOver ? '' : ''
                }`}
                style={{
                  borderColor: uploadDragOver ? 'rgba(45,212,191,0.4)' : 'rgba(255,255,255,0.08)',
                  background: uploadDragOver ? 'rgba(45,212,191,0.03)' : 'transparent',
                }}
              >
                {uploadExtracting ? (
                  <p className="text-sm" style={{ color: 'var(--accent-teal)' }}>{uploadMsg}</p>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    拖拽 PDF / 图片到此处，或点击「选择文件」
                    <br />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      支持拍照、试卷截图、作业照片（印刷体效果最佳）
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 错题列表 ── */}
          {mistakeLoading && mistakes.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>加载中…</p>
          ) : mistakes.length === 0 ? (
            <EmptyState
              icon="📕"
              title="错题本还是空的"
              description="去自测题答题（答错可自动收入），或直接在上方上传试卷 / 错题图片，AI 会帮你整理出知识点与正确答案。"
              accent="coral"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* 来源分组 chips */}
              <div className="flex gap-1 rounded-lg p-1 w-fit"
                style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--glass-border)' }}
              >
                {([
                  ["all", "全部"],
                  ["quiz", "来自自测题"],
                  ["upload", "上传错题"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMistakeOrigin(v)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                      mistakeOrigin === v ? 'glass-pill-active' : 'glass-pill'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 错因筛选 chips */}
              <div
                className="flex flex-wrap gap-1 rounded-lg p-1 w-fit"
                style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid var(--glass-border)" }}
              >
                {(["all", ...MISTAKE_CAUSES, "__none__"] as string[]).map((v) => {
                  const label = v === "all" ? "全部错因" : v === "__none__" ? "未归因" : v;
                  return (
                    <button
                      key={v}
                      onClick={() => setCauseFilter(v)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                        causeFilter === v ? "glass-pill-active" : "glass-pill"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {mistakes
                .filter(
                  (m) =>
                    (mistakeOrigin === "all" || m.origin === mistakeOrigin) &&
                    (causeFilter === "all" ||
                      (causeFilter === "__none__" ? !m.cause : m.cause === causeFilter)),
                )
                .map((m) => {
                  const open = openMistakeId === m.id;
                  return (
                    <div key={m.id} className="flex flex-col gap-2 rounded-xl border p-4"
                      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <span
                        className="self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          background: m.origin === "quiz" ? 'rgba(45,212,191,0.1)' : 'rgba(167,139,250,0.1)',
                          color: m.origin === "quiz" ? 'var(--accent-teal)' : 'var(--accent-purple)',
                          borderColor: m.origin === "quiz" ? 'rgba(45,212,191,0.15)' : 'rgba(167,139,250,0.15)',
                          border: '0.5px solid',
                        }}
                      >
                        {m.origin === "quiz" ? "来自自测题" : "上传错题"}
                      </span>
                      <span
                        className="self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          ...causeStyle(m.cause),
                          border: "0.5px solid",
                        }}
                      >
                        {m.cause || "未归因"}
                      </span>
                      {m.weak_point && (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          薄弱点：{m.weak_point}
                        </p>
                      )}
                      <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {m.question}
                      </p>
                      <div className="flex flex-col gap-1">
                        {m.options.map((opt, oi) => {
                          const isCorrect = oi === m.answer;
                          const isPicked = m.picked === oi;
                          let style: React.CSSProperties = {};
                          if (isCorrect)
                            style = { background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.2)', color: 'var(--accent-emerald)', border: '0.5px solid' };
                          else if (isPicked)
                            style = { background: 'rgba(251,113,133,0.06)', borderColor: 'rgba(251,113,133,0.2)', color: 'var(--accent-coral)', border: '0.5px solid' };
                          else
                            style = { background: 'transparent', borderColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '0.5px solid' };
                          return (
                            <div key={oi} className="rounded-lg px-3 py-1.5 text-xs" style={style}>
                              {opt}
                              {isCorrect ? " ✓" : isPicked ? " （你的答案）" : ""}
                            </div>
                          );
                        })}
                      </div>
                      {m.explanation && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {m.explanation}
                        </p>
                      )}
                      {/* 溯源：依据 + 出处 */}
                      {m.evidence && (
                        <div className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
                          style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)' }}
                        >
                          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>原文依据：</span>
                          「{m.evidence}」
                        </div>
                      )}
                      {m.source_title && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>出处：{m.source_title}</p>
                      )}
                      {/* 溯源高亮：展开原文 */}
                      {m.source_text && (
                        <button
                          type="button"
                          onClick={() => setOpenMistakeId(open ? null : m.id)}
                          className="self-start text-xs underline opacity-60 hover:opacity-100"
                          style={{ color: 'var(--accent-teal)' }}
                        >
                          {open ? "收起原文" : "查看原文（依据高亮）"}
                        </button>
                      )}
                      {open && m.source_text && (
                        <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border p-3 text-xs leading-7"
                          style={{
                            borderColor: 'rgba(255,255,255,0.05)',
                            background: 'rgba(0,0,0,0.2)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {highlightSource(m.source_text, m.evidence)}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
