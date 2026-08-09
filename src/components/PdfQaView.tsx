"use client";

import { useState, useEffect, useRef } from "react";
import { extractPdfText, chunkText, retrieveTopChunks } from "@/lib/pdfText";
import { renderMarkdown } from "@/lib/markdown";

// PDF 智能问答：上传课件 → 浏览器端抽文切片 → 提问时客户端检索 top-k → DeepSeek 带出处作答。
// 零成本：不落库、不用向量库，检索走中文词重叠。

type Msg = {
  role: "user" | "ai";
  content: string;
  sources?: number[]; // AI 引用到的片段序号（1-based）
};

export default function PdfQaView({ isSignedIn }: { isSignedIn?: boolean }) {
  const [fileName, setFileName] = useState("");
  const [docText, setDocText] = useState("");
  const [chunks, setChunks] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pendingSources, setPendingSources] = useState<number[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2600);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, asking]);

  function loadDoc(text: string, name: string) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length < 20) {
      setError("提取到的内容太少，请确认文件清晰或换一份再试。");
      return;
    }
    setDocText(trimmed);
    setChunks(chunkText(trimmed));
    setFileName(name);
    setError("");
    setMessages([]);
    setToast(`已载入：${name}（${trimmed.length} 字，切 ${chunkText(trimmed).length} 段）`);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("仅支持 PDF 文件。");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("文件过大（上限 25MB）。");
      return;
    }
    setExtracting(true);
    setError("");
    try {
      const text = await extractPdfText(file);
      loadDoc(text, file.name);
    } catch (err) {
      console.error("[pdf-qa] 提取失败:", err);
      setError("PDF 解析失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onUsePaste() {
    loadDoc(pasteText, "粘贴文本");
    setShowPaste(false);
  }

  async function ask() {
    const q = question.trim();
    if (!q) return;
    if (chunks.length === 0) {
      setError("请先上传 PDF 或粘贴文本。");
      return;
    }
    if (asking) return;
    setError("");
    setAsking(true);

    // 客户端检索 top-k 片段，编号后拼接为 context
    const top = retrieveTopChunks(chunks, q, 4);
    const sourceNums = top.map((c) => chunks.indexOf(c) + 1); // 1-based 原文序号
    const context = top.map((c, i) => `[${i + 1}] ${c}`).join("\n\n");

    setMessages((m) => [...m, { role: "user", content: q }]);
    setQuestion("");
    setPendingSources(sourceNums);

    try {
      const res = await fetch("/api/pdf-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "问答失败");
      setMessages((m) => [
        ...m,
        { role: "ai", content: data.answer || "（无回答）", sources: sourceNums },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "ai", content: "⚠️ " + (err instanceof Error ? err.message : "问答失败") },
      ]);
      setToast("问答出错，请重试");
    } finally {
      setAsking(false);
      setPendingSources([]);
    }
  }

  // ─── 未载入文档：空状态 ───
  if (chunks.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>PDF 智能问答</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              上传一份课件 PDF，直接提问，我会基于原文给出带出处的答案。
            </p>
          </div>
        </div>

        <div className="glass-card flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
            style={{ background: "rgba(96,165,250,0.12)", color: "var(--accent-blue)" }}>📄</div>
          <div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              支持 PDF 课件 / 讲义。文字在浏览器本地提取，不会上传你的文件。
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button onClick={() => fileRef.current?.click()} disabled={extracting}
              className="btn-primary-glow px-5 py-2 text-sm disabled:opacity-50">
              {extracting ? "解析中…" : "上传 PDF"}
            </button>
            <button onClick={() => setShowPaste((v) => !v)}
              className="glass-btn px-5 py-2 text-sm font-medium">
              或粘贴文本
            </button>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickFile} />

          {showPaste && (
            <div className="w-full flex flex-col gap-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="把课件或笔记内容粘贴到这里……"
                className="glass-input h-36 w-full resize-y p-3 text-sm"
              />
              <div className="flex justify-end">
                <button onClick={onUsePaste} disabled={!pasteText.trim()}
                  className="btn-primary-glow px-4 py-1.5 text-sm disabled:opacity-50">载入文本</button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: "var(--accent-coral)" }}>{error}</p>
          )}
        </div>
      </section>
    );
  }

  // ─── 已载入文档：问答区 ───
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg shrink-0"
            style={{ background: "rgba(96,165,250,0.12)", color: "var(--accent-blue)" }}>📄</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{fileName}</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {docText.length} 字 · {chunks.length} 段 · 基于原文检索作答
            </p>
          </div>
        </div>
        <button onClick={() => { setChunks([]); setDocText(""); setFileName(""); setMessages([]); setShowPaste(false); setPasteText(""); }}
          className="glass-btn px-3.5 py-1.5 text-xs font-medium">换一份</button>
      </div>

      {/* 对话记录 */}
      <div ref={scrollRef} className="glass-card flex flex-col gap-4 p-4 sm:p-5 max-h-[52vh] overflow-y-auto scrollbar-none">
        {messages.length === 0 && !asking && (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            试着问点什么，例如：「这一章的核心公式有哪些？」「简述第三章的主要结论。」
          </p>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
                m.role === "user"
                  ? "text-white"
                  : ""
              }`}
                style={
                  m.role === "user"
                    ? { background: "var(--gradient-teal)", boxShadow: "0 0 16px rgba(45,212,191,0.18)" }
                    : { background: "rgba(255,255,255,0.04)", border: "0.5px solid var(--glass-border)", color: "var(--text-primary)" }
                }
                dangerouslySetInnerHTML={m.role === "ai" ? { __html: renderMarkdown(m.content) } : undefined}
              >
                {m.role === "user" ? m.content : undefined}
              </div>
              {m.role === "ai" && m.sources && m.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1">
                  {m.sources.map((s, si) => (
                    <span key={si} className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{ background: "rgba(96,165,250,0.14)", color: "var(--accent-blue)" }}>
                      片段 {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {asking && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid var(--glass-border)", color: "var(--text-secondary)" }}>
              正在检索原文并组织答案…
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="flex items-end gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
          }}
          placeholder="输入你的问题，回车发送（Shift+Enter 换行）"
          className="glass-input h-12 w-full resize-none px-4 py-3 text-sm"
        />
        <button onClick={ask} disabled={asking || !question.trim()}
          className="btn-primary-glow h-12 shrink-0 px-5 text-sm disabled:opacity-50">
          {asking ? "回答中…" : "提问"}
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "var(--accent-coral)" }}>{error}</p>}

      {!isSignedIn && (
        <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
          当前为匿名问答（每日 {5} 次）。登录后提升至 20 次/天，并可同步更多资料。
        </p>
      )}

      {toast && (
        <div className="glass-toast fixed bottom-6 left-1/2 z-50 px-5 py-2.5 text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}
    </section>
  );
}
