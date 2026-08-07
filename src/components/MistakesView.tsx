"use client";

import { type RefObject } from "react";
import { type Mistake } from "@/components/view-types";
import { highlightSource } from "@/components/shared-ui";

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
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-stone-700">错题本</h2>
        <span className="text-xs text-stone-400">共 {mistakes.length} 题</span>
      </div>

      {!isSignedIn ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-stone-500">登录后即可查看你的错题本。</p>
          <a
            href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
            className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
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
            className={`flex flex-col gap-3 rounded-xl border bg-stone-50 p-4 transition-colors ${
              uploadDragOver
                ? "border-teal-500 ring-2 ring-teal-500/30"
                : "border-stone-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-700">
                📎 上传错题（试卷/作业/笔记截图）
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
                className="shrink-0 rounded-full border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 disabled:opacity-50"
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
                  className="w-full h-28 resize-y rounded-lg border border-stone-300 bg-white p-3 text-xs text-stone-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">
                    {uploadMsg ||
                      `${uploadMistakeText.length} 字 · 修改后点击识别`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMistakeText("");
                        setUploadMsg("");
                      }}
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-600 hover:border-stone-400"
                    >
                      清除
                    </button>
                    <button
                      type="button"
                      onClick={uploadMistakesToServer}
                      disabled={uploadingMistakes || !uploadMistakeText.trim()}
                      className="rounded-full bg-purple-700 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-purple-800 disabled:opacity-50"
                    >
                      {uploadingMistakes ? "AI 识别中…" : "🔍 识别错题"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`flex items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  uploadDragOver
                    ? "border-teal-500 bg-teal-50"
                    : "border-stone-300 hover:border-stone-400"
                }`}
              >
                {uploadExtracting ? (
                  <p className="text-sm text-teal-700">{uploadMsg}</p>
                ) : (
                  <p className="text-sm text-stone-500">
                    拖拽 PDF / 图片到此处，或点击「选择文件」
                    <br />
                    <span className="text-xs text-stone-400">
                      支持拍照、试卷截图、作业照片（印刷体效果最佳）
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 错题列表 ── */}
          {mistakeLoading && mistakes.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">加载中…</p>
          ) : mistakes.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-stone-500">错题本还是空的。</p>
              <p className="mt-1 text-xs text-stone-400">
                去自测题答题（答错可收入），或直接在上方上传试卷/错题图片。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* 来源分组 chips（来自自测题 / 上传错题 分开） */}
              <div className="flex gap-1 rounded-lg bg-stone-100 p-1 w-fit">
                {([
                  ["all", "全部"],
                  ["quiz", "来自自测题"],
                  ["upload", "上传错题"],
                ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMistakeOrigin(v)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      mistakeOrigin === v
                        ? "bg-white text-teal-700 shadow-sm"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mistakes
                .filter((m) => mistakeOrigin === "all" || m.origin === mistakeOrigin)
                .map((m) => {
                  const open = openMistakeId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 rounded-xl border border-stone-200 p-4"
                    >
                      <span
                        className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          m.origin === "quiz"
                            ? "bg-teal-50 text-teal-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {m.origin === "quiz" ? "来自自测题" : "上传错题"}
                      </span>
                      <p className="text-sm font-medium leading-relaxed text-stone-900">
                        {m.question}
                      </p>
                      <div className="flex flex-col gap-1">
                        {m.options.map((opt, oi) => {
                          const isCorrect = oi === m.answer;
                          const isPicked = m.picked === oi;
                          let cls = "rounded-lg border px-3 py-1.5 text-xs ";
                          if (isCorrect)
                            cls += "border-emerald-300 bg-emerald-50 text-emerald-800";
                          else if (isPicked)
                            cls += "border-red-300 bg-red-50 text-red-700";
                          else cls += "border-stone-200 bg-white text-stone-400";
                          return (
                            <div key={oi} className={cls}>
                              {opt}
                              {isCorrect ? " ✓" : isPicked ? " （你的答案）" : ""}
                            </div>
                          );
                        })}
                      </div>
                      {m.explanation && (
                        <p className="text-xs leading-relaxed text-stone-500">
                          {m.explanation}
                        </p>
                      )}
                      {/* 溯源：依据 + 出处 */}
                      {m.evidence && (
                        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs leading-relaxed text-stone-600">
                          <span className="font-medium text-stone-500">
                            📌 原文依据：
                          </span>
                          「{m.evidence}」
                        </div>
                      )}
                      {m.source_title && (
                        <p className="text-xs text-stone-400">出处：{m.source_title}</p>
                      )}
                      {/* 溯源高亮：展开原文，依据句高亮 */}
                      {m.source_text && (
                        <button
                          type="button"
                          onClick={() => setOpenMistakeId(open ? null : m.id)}
                          className="self-start text-xs text-teal-700 underline hover:text-teal-800"
                        >
                          {open ? "收起原文" : "📄 查看原文（依据高亮）"}
                        </button>
                      )}
                      {open && m.source_text && (
                        <div className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs leading-7 text-stone-700">
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
