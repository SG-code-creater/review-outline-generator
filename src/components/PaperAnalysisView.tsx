"use client";

import { useState, useEffect, useRef } from "react";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";

// 试卷分析视图：
//  - 粘贴 / 拍照 / 上传 PDF 试卷 → AI 识别题目 + 诊断薄弱点 → 勾选题目一键导入错题本。
//  - 图片走 /api/recognize（小米 MiMo 视觉，忽略手写/批改/涂改）；PDF 用 pdfjs 提文字或转图识别。
//  - 导入复用现有 /api/mistakes/upload（origin='upload'），错题直接进「错题本」与复习体系。

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

const MAX_IMAGES = 8; // 与 /api/recognize 上限一致

export default function PaperAnalysisView({
  isSignedIn,
}: {
  isSignedIn?: boolean;
}) {
  const [text, setText] = useState("");
  const [scenario, setScenario] = useState<Scenario>("通用");
  const [analyzing, setAnalyzing] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
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

  // 导入相关
  const [source, setSource] = useState<"image" | "pdf" | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── 图片压缩（缩到长边 ≤1024，JPEG q60，极致压缩以在 EdgeOne 120s 超时内完成 MiMo 视觉识别） ──
  function compressImage(
    file: File,
    maxDim = 1024,
    quality = 0.6,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("图片解码失败"));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const s = maxDim / Math.max(width, height);
            width = Math.round(width * s);
            height = Math.round(height * s);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("无法创建画布"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── 调用 /api/recognize（多图）── 带 120s 超时，视觉模型处理图片可能较慢 ──
  async function recognizeImages(images: string[], src: "image" | "pdf") {
    setRecognizing(true);
    setErr("");
    // AbortController：120 秒超时（MiMo 视觉处理大图可能需要 30–90 秒）
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetch("/api/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "识别失败");
      setText((prev) => (prev ? prev + "\n\n" : "") + data.text.trim());
      setSource(src);
      setToast(
        src === "pdf"
          ? "已识别 PDF 页面，可编辑后点击分析"
          : "已识别图片，可编辑后点击分析",
      );
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setErr("识别超时（图片较大时处理时间较长）。建议裁剪到只含题目区域后重试。");
      } else {
        setErr(e instanceof Error ? e.message : "识别失败");
      }
    } finally {
      clearTimeout(timer);
      setRecognizing(false);
    }
  }

  // ── 处理相册/拍照选中的图片 ──
  async function handleImages(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setErr("");
    setRecognizing(true);
    try {
      const dataUrls: string[] = [];
      for (const f of arr.slice(0, MAX_IMAGES)) {
        dataUrls.push(await compressImage(f));
      }
      setPreviews(dataUrls);
      await recognizeImages(dataUrls, "image");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "图片处理失败");
      setRecognizing(false);
    }
  }

  // ── 处理 PDF：数字版直接提文字，扫描版渲染成图交给 MiMo ──
  async function handlePdf(file: File) {
    setErr("");
    setRecognizing(true);
    try {
      const pdfjs: any = await import("pdfjs-dist");
      // 用固定 CDN 版本避免版本不匹配导致 _renderPageChunk 崩溃
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
      const buf = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: buf, useSystemFonts: true });
      const doc = await loadingTask.promise;
      let extracted = "";
      const pageImages: string[] = [];
      const pageCount = Math.min(doc.numPages, MAX_IMAGES);

      for (let n = 1; n <= pageCount; n++) {
        try {
          const page = await doc.getPage(n);
          // 数字 PDF：直接提文字
          const tc = await page.getTextContent();
          const items = tc?.items;
          const pageText = Array.isArray(items)
            ? items.map((it: any) => (it?.str || "")).join(" ")
            : "";
          if (pageText.trim().length > 30) {
            extracted += `\n--- 第 ${n} 页 ---\n${pageText}\n`;
          } else {
            // 扫描版：渲染成图，交给 MiMo 视觉识别（能忽略手写/批改）
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 1600 / Math.max(base.width, base.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) continue;
            await page.render({ canvasContext: ctx, viewport } as any).promise;
            pageImages.push(canvas.toDataURL("image/jpeg", 0.85));
          }
        } catch (pageErr) {
          // 单页失败不影响其他页
          console.warn(`PDF 第 ${n} 页处理失败:`, pageErr);
        }
      }

      if (extracted.trim().length > 40) {
        setText((prev) => (prev ? prev + "\n\n" : "") + extracted.trim());
        setSource("pdf");
        setToast("已从 PDF 提取文字，可编辑后点击分析");
      } else if (pageImages.length) {
        setPreviews(pageImages);
        await recognizeImages(pageImages, "pdf");
      } else {
        setErr("未能从 PDF 提取到内容，请确认文件有效或换一份。");
      }
    } catch (e) {
      // pdfjs 加载/解析整体失败 → 降级提示用户用图片上传
      const msg = e instanceof Error ? e.message : String(e);
      console.error("PDF 处理失败:", msg);
      setErr(`PDF 解析失败（${msg.slice(0, 80)}）。建议改用「拍照」或「相册」上传图片来识别。`);
    } finally {
      setRecognizing(false);
    }
  }

  function resetAll() {
    setQuestions([]);
    setAnalysis(null);
    setText("");
    setErr("");
    setSource(null);
    setPreviews([]);
    setSelected(new Set());
    setExpanded(new Set());
  }

  function startAnalyze() {
    if (!text.trim()) {
      setErr("请先粘贴、拍照或上传试卷内容。");
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
            粘贴试卷，或拍照 / 上传 PDF，AI 识别题目并诊断薄弱考点，一键导入错题本反复练。
          </p>
        </div>
        <button
          onClick={resetAll}
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

        {/* 导入入口：拍照 / 相册 / PDF */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            或导入：
          </span>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={recognizing}
            className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
          >
            📷 拍照
          </button>
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            disabled={recognizing}
            className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
          >
            🖼 相册
          </button>
          <button
            type="button"
            onClick={() => pdfRef.current?.click()}
            disabled={recognizing}
            className="glass-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)", borderColor: "var(--glass-border)" }}
          >
            📄 PDF
          </button>
          {source && text && (
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                background: "rgba(45,212,191,0.12)",
                color: "var(--accent-teal)",
              }}
            >
              {source === "pdf" ? "📄 已导入 PDF" : "📷 已识别图片"}
            </span>
          )}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleImages(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleImages(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePdf(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* 预览缩略图 */}
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((p, i) => (
              <img
                key={i}
                src={p}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              />
            ))}
          </div>
        )}

        {recognizing && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ background: "rgba(45,212,191,0.06)", color: "var(--text-secondary)" }}
          >
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
            识别中…正在把图片传给 AI 还原原题（会自动忽略手写、批改与涂改）
          </div>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴试卷 / 练习的题目与内容；或点击上方「拍照 / 相册 / PDF」直接导入。AI 会从中识别题目并分析薄弱点。导入内容可在此二次编辑。"
          className="glass-input min-h-[160px] w-full resize-y px-4 py-3 text-sm leading-relaxed"
          style={{ background: "rgba(255,255,255,0.03)" }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={startAnalyze}
            disabled={analyzing || recognizing || !text.trim()}
            className="glass-btn inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium"
            style={
              analyzing || recognizing || !text.trim()
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
