"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";

// ─── 图标 ──────────────────────────────────────────────
const ICONS: Record<string, React.ReactNode> = {
  错题本整理: (
    <>
      <path d="M9 5h11" />
      <path d="M9 12h11" />
      <path d="M9 19h11" />
      <path d="M4 5l1 1 2-2" />
      <path d="M4 12l1 1 2-2" />
    </>
  ),
  知识点卡片: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  "PDF 智能问答": (
    <>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M14 2v6h6" />
      <path d="M9 13a2 2 0 1 1 3 1.7c-.7.4-1 .9-1 1.8" />
      <path d="M11.5 18h.01" />
    </>
  ),
  单词背诵助手: (
    <>
      <path d="M5 19 9 5l4 14" />
      <path d="M6.5 14h5" />
      <path d="M16 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </>
  ),
  试卷分析: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3h8" />
      <path d="M8 12v4" />
      <path d="M12 10v6" />
      <path d="M16 8v8" />
    </>
  ),
  考试倒计时: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

// ─── 板块数据（知识点卡片已上线，其余仍占位） ──────────
const FEATURES = [
  {
    title: "错题本整理",
    desc: "拍照或粘贴错题，自动归类知识点与易错原因，生成专属错题集。",
    live: false,
  },
  {
    title: "知识点卡片",
    desc: "把长篇笔记拆成可记忆的小卡片，支持间隔重复复习。",
    live: true,
  },
  {
    title: "PDF 智能问答",
    desc: "上传课件 PDF，直接提问，基于原文给出带出处的答案。",
    live: false,
  },
  {
    title: "单词背诵助手",
    desc: "按词频与考频生成背诵清单，配合测验巩固记忆。",
    live: false,
  },
  {
    title: "试卷分析",
    desc: "上传试卷，定位薄弱章节并推荐针对性练习。",
    live: false,
  },
  {
    title: "考试倒计时",
    desc: "设置考试日期，自动规划每日复习节奏与提醒。",
    live: false,
  },
];

type Mode = "outline" | "flashcard" | "review" | "quiz";
type ReviewView = "due" | "collection" | "outlines";
type CardStatus = "all" | "new" | "weak" | "fuzzy" | "mastered";

interface Card {
  id?: string;
  question: string;
  answer: string;
  topic: string;
  last_grade?: number | null;
  tags?: string[];
}

interface SavedOutline {
  id: string;
  title: string;
  tags: string[];
  result: { outline?: string } | string;
  created_at: string;
}

// ─── 自定义用户菜单（替代 UserButton，规避 EdgeOne 无 middleware 下登出问题）───
function UserMenu() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // 调用本项目自有的 /api/sign-out（服务端吊销 session + 清 cookie + 跳回首页），
  // 完全绕开客户端 signOut() SDK（EdgeOne 下返回 unexpected response）与 Clerk 托管页（404）。
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/sign-out", { method: "POST" });
    } catch {
      // 即使请求异常，服务端已尽力清 cookie；下面强制刷新仍能复位状态
    }
    window.location.assign("/");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-teal-700 text-sm font-medium text-white shadow-sm ring-2 ring-white transition-colors hover:bg-teal-800"
        aria-label="用户菜单"
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span>
            {(user?.firstName?.[0] ?? user?.username?.[0] ?? "我").toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <a
            href="https://accounts.xuebox.me/user"
            target="_blank"
            rel="noreferrer"
            className="block px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
          >
            管理账户
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {signingOut ? "退出中…" : "退出登录"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("outline");
  const [scenario, setScenario] = useState<Scenario>("通用");
  const [text, setText] = useState("");
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isSignedIn } = useUser();

  // 文件输入（PDF/图片 → 浏览器端抽取文本，复用现有生成管线）
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // 知识点卡片状态
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

  // 保存卡片状态
  type SaveState = "idle" | "saving" | "saved" | "error";
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // 我的复习（间隔重复）状态
  const [reviewCards, setReviewCards] = useState<Card[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(""); // 完成提示

  // 我的复习 → 子视图（今日复习 / 卡片题集 / 我的提纲）
  const [reviewView, setReviewView] = useState<ReviewView>("due");

  // 卡片题集（全部保存的卡片 + 状态/标签分组）
  const [collectionCards, setCollectionCards] = useState<Card[]>([]);
  const [collectionStatus, setCollectionStatus] = useState<CardStatus>("all");
  const [collectionTag, setCollectionTag] = useState<string | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);

  // 我的提纲（收藏的提纲）
  const [outlines, setOutlines] = useState<SavedOutline[]>([]);
  const [outlineViewId, setOutlineViewId] = useState<string | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [saveOutlineState, setSaveOutlineState] = useState<SaveState>("idle");
  const [outlineTitleInput, setOutlineTitleInput] = useState("");
  const [outlineTagInput, setOutlineTagInput] = useState("");

  // 评分防重复点击（乐观更新用）
  const gradingRef = useRef(false);

  // 题集内每张卡片的临时标签输入
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  // 自测题（主动回忆）状态
  interface QuizItem {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  }
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizPicked, setQuizPicked] = useState<number[]>([]); // 每题选中的选项下标，-1 未答
  const [quizRevealed, setQuizRevealed] = useState<boolean[]>([]); // 每题是否已揭示答案

  async function handleGenerate() {
    setError("");
    if (!text.trim()) {
      setError("请先粘贴或输入课件 / 笔记文本。");
      return;
    }
    setLoading(true);
    if (mode === "outline") setOutline("");
    else setCards([]);
    try {
      const endpoint =
        mode === "outline" ? "/api/generate" : "/api/flashcards";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, scenario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成失败，请稍后重试。");

      if (mode === "outline") {
        setOutline(data.outline || "");
      } else {
        setCards(data.cards || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  // 生成自测题（主动回忆）：调用 /api/quiz
  async function generateQuiz() {
    setError("");
    if (!text.trim()) {
      setError("请先粘贴或输入课件 / 笔记文本，再生成自测题。");
      return;
    }
    setQuizLoading(true);
    setQuiz([]);
    setQuizPicked([]);
    setQuizRevealed([]);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, scenario, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成自测题失败，请稍后重试。");
      setQuiz(data.quiz || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成自测题失败，请稍后重试。");
    } finally {
      setQuizLoading(false);
    }
  }

  // 自测题：选择某选项（仅在未揭示时生效）
  function pickQuizOption(qi: number, oi: number) {
    if (quizRevealed[qi]) return;
    setQuizPicked((prev) => {
      const next = [...prev];
      next[qi] = oi;
      return next;
    });
    setQuizRevealed((prev) => {
      const next = [...prev];
      next[qi] = true;
      return next;
    });
  }

  function quizScore(): { correct: number; total: number } {
    const total = quiz.length;
    let correct = 0;
    quiz.forEach((q, i) => {
      if (quizPicked[i] === q.answer) correct++;
    });
    return { correct, total };
  }

  function toggleFlip(i: number) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // 下载文本文件（导出 .md / Anki .txt）
  function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportOutlineMd() {
    downloadFile("复习提纲.md", outline, "text/markdown");
  }

  // 导出为 Anki 可导入格式（问题\t答案\t标签，制表符分隔）
  function exportAnki() {
    const lines = cards.map((c) => `${c.question}\t${c.answer}\t${c.topic}`);
    downloadFile("学盒闪卡_Anki导入.txt", lines.join("\n"), "text/plain");
  }

  async function copyAllCards() {
    const text = cards
      .map((c, i) => `【${i + 1}】${c.topic}\nQ: ${c.question}\nA: ${c.answer}`)
      .join("\n\n");
    try {
      await navigator.clipboard?.writeText(text);
      setError("");
    } catch {
      setError("复制失败，请手动选择。");
    }
  }

  // 保存当前生成的卡片到"我的复习"
  async function saveCards() {
    if (cards.length === 0) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "保存失败");
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  // 加载待复习卡片
  async function loadDueCards() {
    setReviewLoading(true);
    setReviewMsg("");
    try {
      const res = await fetch("/api/cards?mode=due", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      setReviewCards(data.cards || []);
      setReviewIndex(0);
      setReviewRevealed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setReviewLoading(false);
    }
  }

  // 复习评分（quality: 1忘记 / 3模糊 / 5记得）—— 乐观更新：立即切下一张，后台静默同步
  async function gradeCard(quality: number) {
    const card = reviewCards[reviewIndex];
    if (!card?.id) return;
    if (gradingRef.current) return; // 防重复点击（消除多点造成的跳题）
    gradingRef.current = true;

    // 1) 立即推进界面，不再等网络往返（约 2s 卡顿错觉的来源）
    const next = reviewIndex + 1;
    setReviewRevealed(false);
    setReviewIndex(next);
    if (next >= reviewCards.length) setReviewMsg("🎉 本轮复习完成！");

    // 2) 后台同步评分，失败仅提示，不影响继续复习
    try {
      const res = await fetch("/api/cards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, quality }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "同步失败，已记录本次评分");
      }
    } catch {
      setError("网络异常，评分将在下次复习时重试");
    } finally {
      gradingRef.current = false;
    }
  }

  // 卡片题集：加载全部已保存卡片
  async function loadCollection() {
    setCollectionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cards?mode=all", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      const list: Card[] = data.cards || [];
      setCollectionCards(list);
      const tagSet = new Set<string>();
      list.forEach((c) => (c.tags || []).forEach((t) => tagSet.add(t)));
      setAllTags(Array.from(tagSet));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setCollectionLoading(false);
    }
  }

  // 我的提纲：加载收藏的提纲
  async function loadOutlines() {
    setOutlineLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generations", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      setOutlines(data.outlines || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setOutlineLoading(false);
    }
  }

  // 题集内更新单卡标签
  async function updateCardTags(id: string, tags: string[]) {
    try {
      await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tags }),
      });
      setCollectionCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, tags } : c)),
      );
    } catch {
      setError("标签更新失败");
    }
  }

  // 题集内删除单卡
  async function deleteCard(id: string) {
    try {
      const res = await fetch(`/api/cards?id=${id}`, { method: "DELETE" });
      if (res.ok) setCollectionCards((prev) => prev.filter((c) => c.id !== id));
      else setError("删除失败");
    } catch {
      setError("删除失败");
    }
  }

  // 收藏当前提纲
  async function saveOutline() {
    if (!outline) return;
    setSaveOutlineState("saving");
    try {
      const tags = outlineTagInput
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: outlineTitleInput.trim() || outline.split("\n")[0].slice(0, 30),
          input_text: text,
          result: { outline },
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "保存失败");
      setSaveOutlineState("saved");
      setOutlineTitleInput("");
      setOutlineTagInput("");
    } catch (e) {
      setSaveOutlineState("error");
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  // 删除提纲
  async function deleteOutline(id: string) {
    try {
      const res = await fetch(`/api/generations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setOutlines((prev) => prev.filter((o) => o.id !== id));
        if (outlineViewId === id) setOutlineViewId(null);
      } else setError("删除失败");
    } catch {
      setError("删除失败");
    }
  }

  // 卡片状态徽标
  function cardStatus(card: Card): { label: string; cls: string } {
    if (card.last_grade == null) return { label: "未学", cls: "bg-stone-100 text-stone-600" };
    if (card.last_grade <= 1) return { label: "薄弱", cls: "bg-red-100 text-red-700" };
    if (card.last_grade === 3) return { label: "模糊", cls: "bg-amber-100 text-amber-700" };
    return { label: "掌握", cls: "bg-emerald-100 text-emerald-700" };
  }

  // 进入"我的复习"且已登录时，按子视图拉取数据
  useEffect(() => {
    if (mode === "review" && isSignedIn) {
      if (reviewView === "due") loadDueCards();
      else if (reviewView === "collection") loadCollection();
      else if (reviewView === "outlines") loadOutlines();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isSignedIn, reviewView]);

  // 切换模式时清空结果
  function switchMode(m: Mode) {
    if (m !== mode) {
      setMode(m);
      setOutline("");
      setCards([]);
      setFlipped(new Set());
      setReviewRevealed(false);
      setReviewMsg("");
      setSaveState("idle");
      setError("");
    }
  }

  // ─── 文件 → 文本（浏览器端，避免引入新 API / 数据库） ───
  async function handleFile(file?: File | null) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("仅支持 PDF 或图片（png/jpg/webp）。");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("文件过大（>25MB），请先压缩后再上传。");
      return;
    }
    setExtracting(true);
    setError("");
    setExtractMsg(isPdf ? "正在解析 PDF…" : "正在识别图片文字…");
    try {
      const extracted = isPdf ? await extractPdfText(file) : await ocrImage(file);
      const trimmed = extracted.replace(/\s+/g, " ").trim();
      if (!trimmed) {
        setError("没能提取到文字，请确认文件内容清晰或换一份再试。");
      } else {
        setText((prev) => (prev ? prev + "\n\n" + trimmed : trimmed));
        setExtractMsg(`已提取 ${trimmed.length} 字，可点击生成。`);
      }
    } catch (e) {
      console.error("[extract] 失败:", e);
      setError("解析失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setExtracting(false);
      setTimeout(() => setExtractMsg(""), 4000);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // PDF：pdfjs-dist 浏览器端抽文字
  async function extractPdfText(file: File): Promise<string> {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out +=
        content.items
          .map((it) => ("str" in it ? (it as { str: string }).str : ""))
          .join(" ") + "\n";
    }
    return out;
  }

  // 图片：tesseract.js 浏览器端 OCR（印刷体中文/英文）
  async function ocrImage(file: File): Promise<string> {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("chi_sim+eng");
    try {
      const { data } = await worker.recognize(file);
      return cleanOcrText(data.text || "");
    } finally {
      await worker.terminate();
    }
  }

  /** 清理 OCR 输出：去除 CJK 字符间的多余空格，修正常见识别错误 */
  function cleanOcrText(raw: string): string {
    let text = raw;
    // 1. 去除 CJK 字符/标点之间的空格（tesseract 默认每个汉字间插空格）
    //    保留英文单词内部和中文与英文之间的正常空格
    text = text.replace(
      /([\u2E80-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF00-\uFFEF])\s+(?=[\u2E80-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF00-\uFFEF])/g,
      "$1"
    );
    // 2. 去除行首行尾空格，合并连续空白行（PDF 多栏/换行产生大量空行）
    text = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
    // 3. 合并过短的断行（<15 字符且不以句号结尾 → 可能是中间折行）
    const lines = text.split("\n");
    const merged: string[] = [];
    for (const line of lines) {
      if (
        merged.length > 0 &&
        line.length < 15 &&
        !/[。！？]$/.test(merged[merged.length - 1])
      ) {
        merged[merged.length - 1] += line;
      } else {
        merged.push(line);
      }
    }
    text = merged.join("\n");
    return text;
  }

  return (
    <>
      {/* 品牌顶栏 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-teal-500 to-emerald-500" />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
        {/* ─── Header ─── */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12 6c-2-1.5-5-1.5-7 0v12c2-1.5 5-1.5 7 0 2-1.5 5-1.5 7 0V6c-2-1.5-5-1.5-7 0Z" />
                <path d="M12 6v12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                  复习提纲<span className="text-teal-700">生成器</span>
                </h1>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  测试版
                </span>
              </div>
              <p className="mt-1 text-sm text-stone-500">
                粘贴课件 / 笔记文本，或上传 PDF / 图片，一键生成结构化复习提纲。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSignedIn ? (
              <UserMenu />
            ) : (
              <a
                href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
                className="inline-block rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-800"
              >
                登录
              </a>
            )}
          </div>
        </header>

        {/* ─── 模式切换 Tab ─── */}
        <div className="flex gap-1 rounded-lg bg-stone-100 p-1 w-fit">
          <button
            onClick={() => switchMode("outline")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "outline"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            📝 提纲生成
          </button>
          <button
            onClick={() => switchMode("flashcard")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "flashcard"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            🎴 知识点卡片
          </button>
          <button
            onClick={() => switchMode("review")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "review"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            📚 我的复习
          </button>
          <button
            onClick={() => switchMode("quiz")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "quiz"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            🧠 自测题
          </button>
        </div>

        {/* ─── 垂直场景选择（考研/考公/教资/期末，改 prompt 拉开定位） ─── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-400">备考场景：</span>
          {SCENARIOS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScenario(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                scenario === s
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ─── 核心功能区（共用输入框，仅提纲/卡片模式） ─── */}
        {mode !== "review" && (
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm transition-colors ${
            dragOver ? "border-teal-500 ring-2 ring-teal-500/30" : "border-stone-200"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="source" className="text-sm font-medium text-stone-700">
              输入文本
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={extracting}
                className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-teal-500 hover:text-teal-700 disabled:opacity-60"
              >
                {extracting ? "解析中…" : "📎 上传 PDF / 图片"}
              </button>
            </div>
          </div>
          <textarea
            id="source"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "outline"
                ? "把课件或笔记内容粘贴到这里，或上传 PDF / 图片自动提取……"
                : mode === "quiz"
                  ? "粘贴要出成自测题的资料，或上传 PDF / 图片自动提取……"
                  : "粘贴要拆解成卡片的笔记内容，或上传 PDF / 图片自动提取……"
            }
            className="h-48 w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-900 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-stone-400">
              {extractMsg || (dragOver ? "松开即可提取文字" : "支持拖拽文件到此处")}
            </span>
            <button
              onClick={mode === "quiz" ? generateQuiz : handleGenerate}
              disabled={loading || quizLoading || extracting}
              className="self-start rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "quiz"
                ? quizLoading
                  ? "出题中…"
                  : "生成自测题"
                : loading
                  ? "生成中…"
                  : mode === "outline"
                    ? "生成提纲"
                    : "生成卡片"}
            </button>
          </div>
        </section>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <p>{error}</p>
          </div>
        )}

        {/* ─── 提纲结果 ─── */}
        {mode === "outline" && outline && (
          <section className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">生成的提纲</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigator.clipboard?.writeText(outline)}
                  className="text-xs text-stone-500 underline hover:text-teal-700"
                >
                  复制
                </button>
                <button
                  onClick={exportOutlineMd}
                  className="text-xs text-stone-500 underline hover:text-teal-700"
                >
                  下载 .md
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-stone-100 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
              {outline}
            </pre>
            {/* 收藏提纲 */}
            <div className="mt-2 flex flex-col gap-2 border-t border-stone-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={outlineTitleInput}
                  onChange={(e) => setOutlineTitleInput(e.target.value)}
                  placeholder="提纲标题（可选）"
                  className="w-40 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-teal-500"
                />
                <input
                  value={outlineTagInput}
                  onChange={(e) => setOutlineTagInput(e.target.value)}
                  placeholder="标签，逗号分隔（可选）"
                  className="w-44 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-teal-500"
                />
                {isSignedIn ? (
                  saveOutlineState === "saved" ? (
                    <span className="text-xs font-medium text-emerald-600">已收藏 ✓</span>
                  ) : (
                    <button
                      onClick={saveOutline}
                      disabled={saveOutlineState === "saving"}
                      className="rounded-full bg-teal-700 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
                    >
                      {saveOutlineState === "saving" ? "收藏中…" : "保存到我的提纲"}
                    </button>
                  )
                ) : (
                  <span className="text-xs text-stone-400">登录后可收藏</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── 卡片结果（翻转交互） ─── */}
        {mode === "flashcard" && cards.length > 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">
                生成的知识卡片（{cards.length} 张）
              </h2>
              <div className="flex items-center gap-3">
                {isSignedIn ? (
                  saveState === "saved" ? (
                    <span className="text-xs font-medium text-emerald-600">已保存 ✓</span>
                  ) : (
                    <button
                      onClick={saveCards}
                      disabled={saveState === "saving"}
                      className="text-xs font-medium text-teal-700 underline hover:text-teal-800 disabled:opacity-50"
                    >
                      {saveState === "saving" ? "保存中…" : "保存到我的卡片"}
                    </button>
                  )
                ) : (
                  <span className="text-xs text-stone-400">登录后可保存</span>
                )}
                <button
                  onClick={copyAllCards}
                  className="text-xs text-stone-500 underline hover:text-teal-700"
                >
                  复制全部
                </button>
                <button
                  onClick={exportAnki}
                  className="text-xs text-stone-500 underline hover:text-teal-700"
                >
                  导出 Anki
                </button>
                <span className="text-xs text-stone-400">点击卡片翻转查看答案</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, i) => {
                const isFlipped = flipped.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleFlip(i)}
                    className={`group relative flex h-52 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-stone-200 p-5 text-left shadow-sm transition-all duration-300 hover:border-teal-300 hover:shadow-md ${
                      isFlipped
                        ? "bg-gradient-to-br from-teal-50 to-emerald-50"
                        : "bg-white"
                    }`}
                  >
                    {/* 正面：问题 */}
                    <div className={`flex h-full flex-col justify-between ${isFlipped ? "hidden" : ""}`}>
                      <span className="inline-block self-start rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                        {card.topic}
                      </span>
                      <p className="text-base font-semibold leading-relaxed text-stone-900">
                        {card.question}
                      </p>
                      <p className="text-xs text-stone-400">点击查看答案 ↓</p>
                    </div>
                    {/* 背面：答案 */}
                    <div className={`flex h-full flex-col justify-center ${!isFlipped ? "hidden" : ""}`}>
                      <span className="mb-2 inline-block self-start rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                        {card.topic} · 答案
                      </span>
                      <p className="text-base leading-relaxed text-stone-800">
                        {card.answer}
                      </p>
                      <p className="mt-3 text-xs text-stone-400">点击返回问题 ↑</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── 自测题（主动回忆） ─── */}
        {mode === "quiz" && (
          <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">
                {quiz.length > 0 ? `自测题（${quiz.length} 道）` : "自测题"}
              </h2>
              {quiz.length > 0 && (
                <button
                  onClick={generateQuiz}
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
                                onClick={() => pickQuizOption(gi, oi)}
                                className={cls}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {revealed && (
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
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 计分条 */}
                <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="text-sm font-medium text-stone-700">
                    得分：{quizScore().correct} / {quizScore().total}
                  </span>
                  <button
                    onClick={() => {
                      setQuizPicked([]);
                      setQuizRevealed([]);
                    }}
                    className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:border-teal-500 hover:text-teal-700"
                  >
                    重新答题
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── 我的复习（间隔重复 + 题集 + 提纲） ─── */}
        {mode === "review" && (
          <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-stone-700">我的复习</h2>

            {!isSignedIn ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-stone-500">
                  登录后即可保存卡片与提纲，并在此按间隔重复复习。
                </p>
                <a
                  href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
                  className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
                >
                  登录
                </a>
              </div>
            ) : (
              <>
                {/* 子视图切换 */}
                <div className="flex gap-1 rounded-lg bg-stone-100 p-1 w-fit">
                  {([
                    ["due", "今日复习"],
                    ["collection", "卡片题集"],
                    ["outlines", "我的提纲"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setReviewView(v)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        reviewView === v
                          ? "bg-white text-teal-700 shadow-sm"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* ── 今日复习（SM-2 到期队列） ── */}
                {reviewView === "due" &&
                  (reviewMsg ? (
                    <div className="py-10 text-center">
                      <p className="text-lg font-semibold text-stone-900">{reviewMsg}</p>
                      <button
                        onClick={loadDueCards}
                        className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
                      >
                        再看一下
                      </button>
                    </div>
                  ) : reviewLoading && reviewCards.length === 0 ? (
                    <p className="py-8 text-center text-sm text-stone-400">加载中…</p>
                  ) : reviewCards.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-stone-500">还没有待复习的卡片。</p>
                      <p className="mt-1 text-xs text-stone-400">
                        去「知识点卡片」生成后点击「保存到我的卡片」即可在这里复习。
                      </p>
                    </div>
                  ) : reviewIndex >= reviewCards.length ? (
                    <div className="py-10 text-center">
                      <p className="text-lg font-semibold text-stone-900">🎉 本轮复习完成！</p>
                      <button
                        onClick={loadDueCards}
                        className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
                      >
                        刷新待复习
                      </button>
                    </div>
                  ) : (
                    (() => {
                      const card = reviewCards[reviewIndex];
                      const btn =
                        "flex-1 rounded-lg py-2 text-sm font-medium transition-colors";
                      return (
                        <div className="flex flex-col gap-4">
                          <p className="text-xs text-stone-400">
                            待复习 {reviewIndex + 1} / {reviewCards.length}
                          </p>
                          <div className="flex h-64 flex-col justify-between rounded-xl border border-stone-200 bg-white p-5">
                            <span className="inline-block self-start rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                              {card?.topic}
                            </span>
                            <p className="text-lg font-semibold leading-relaxed text-stone-900">
                              {card?.question}
                            </p>
                            {reviewRevealed ? (
                              <div className="flex flex-col gap-3">
                                <p className="border-t border-stone-100 pt-3 text-sm leading-relaxed text-stone-800">
                                  {card?.answer}
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => gradeCard(1)}
                                    className={`${btn} bg-red-50 text-red-600 hover:bg-red-100`}
                                  >
                                    忘记
                                  </button>
                                  <button
                                    onClick={() => gradeCard(3)}
                                    className={`${btn} bg-amber-50 text-amber-700 hover:bg-amber-100`}
                                  >
                                    模糊
                                  </button>
                                  <button
                                    onClick={() => gradeCard(5)}
                                    className={`${btn} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                                  >
                                    记得
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReviewRevealed(true)}
                                className="self-start rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-100"
                              >
                                显示答案
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ))}

                {/* ── 卡片题集（全部保存的卡片 + 状态/标签分组） ── */}
                {reviewView === "collection" &&
                  (() => {
                    const filtered = collectionCards.filter((c) => {
                      if (collectionStatus !== "all") {
                        const map: Record<string, string> = {
                          new: "未学",
                          weak: "薄弱",
                          fuzzy: "模糊",
                          mastered: "掌握",
                        };
                        if (cardStatus(c).label !== map[collectionStatus]) return false;
                      }
                      if (collectionTag && !(c.tags || []).includes(collectionTag))
                        return false;
                      return true;
                    });
                    const statusTabs: { v: CardStatus; label: string }[] = [
                      { v: "all", label: "全部" },
                      { v: "new", label: "未学" },
                      { v: "weak", label: "薄弱" },
                      { v: "fuzzy", label: "模糊" },
                      { v: "mastered", label: "掌握" },
                    ];
                    return (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {statusTabs.map((t) => (
                            <button
                              key={t.v}
                              onClick={() => {
                                setCollectionStatus(t.v);
                                setCollectionTag(null);
                              }}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                collectionStatus === t.v
                                  ? "bg-teal-700 text-white shadow-sm"
                                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                          {allTags.length > 0 && (
                            <span className="mx-1 text-xs text-stone-300">|</span>
                          )}
                          {allTags.map((t) => (
                            <button
                              key={t}
                              onClick={() => setCollectionTag(t)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                collectionTag === t
                                  ? "bg-teal-100 text-teal-700 ring-1 ring-teal-300"
                                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                              }`}
                            >
                              #{t}
                            </button>
                          ))}
                          {collectionTag && (
                            <button
                              onClick={() => setCollectionTag(null)}
                              className="text-xs text-stone-400 underline hover:text-stone-600"
                            >
                              清除标签
                            </button>
                          )}
                        </div>

                        {collectionLoading && collectionCards.length === 0 ? (
                          <p className="py-8 text-center text-sm text-stone-400">加载中…</p>
                        ) : collectionCards.length === 0 ? (
                          <div className="py-10 text-center">
                            <p className="text-sm text-stone-500">还没有保存的卡片。</p>
                            <p className="mt-1 text-xs text-stone-400">
                              去「知识点卡片」生成后点击「保存到我的卡片」。
                            </p>
                          </div>
                        ) : filtered.length === 0 ? (
                          <p className="py-8 text-center text-sm text-stone-400">
                            该筛选下没有卡片。
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <p className="text-xs text-stone-400">
                              共 {filtered.length} 张
                            </p>
                            {filtered.map((c) => (
                              <div
                                key={c.id}
                                className="flex flex-col gap-2 rounded-xl border border-stone-200 p-4"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                                      {c.topic}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${cardStatus(c).cls}`}
                                    >
                                      {cardStatus(c).label}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => deleteCard(c.id!)}
                                    className="text-xs text-stone-400 hover:text-red-600"
                                  >
                                    删除
                                  </button>
                                </div>
                                <p className="text-sm font-medium text-stone-900">
                                  {c.question}
                                </p>
                                <p className="text-sm leading-relaxed text-stone-600">
                                  {c.answer}
                                </p>
                                <div className="flex flex-wrap items-center gap-1">
                                  {(c.tags || []).map((t) => (
                                    <span
                                      key={t}
                                      className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                                    >
                                      #{t}
                                      <button
                                        onClick={() =>
                                          updateCardTags(
                                            c.id!,
                                            (c.tags || []).filter((x) => x !== t),
                                          )
                                        }
                                        className="text-stone-400 hover:text-red-600"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                  <input
                                    value={tagDraft[c.id!] || ""}
                                    onChange={(e) =>
                                      setTagDraft((p) => ({
                                        ...p,
                                        [c.id!]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const v = e.currentTarget.value.trim();
                                        if (v && !(c.tags || []).includes(v)) {
                                          updateCardTags(c.id!, [
                                            ...(c.tags || []),
                                            v,
                                          ]);
                                        }
                                        setTagDraft((p) => ({ ...p, [c.id!]: "" }));
                                      }
                                    }}
                                    placeholder="加标签"
                                    className="w-20 rounded-full border border-stone-200 px-2 py-0.5 text-xs outline-none focus:border-teal-500"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* ── 我的提纲（收藏的提纲） ── */}
                {reviewView === "outlines" &&
                  (outlineLoading && outlines.length === 0 ? (
                    <p className="py-8 text-center text-sm text-stone-400">加载中…</p>
                  ) : outlines.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm text-stone-500">还没有收藏的提纲。</p>
                      <p className="mt-1 text-xs text-stone-400">
                        在「提纲生成」生成后点击「保存到我的提纲」即可沉淀到这里。
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {outlines.map((o) => (
                        <div
                          key={o.id}
                          className="flex flex-col gap-2 rounded-xl border border-stone-200 p-4"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-stone-900">
                              {o.title}
                            </h3>
                            <button
                              onClick={() => deleteOutline(o.id)}
                              className="text-xs text-stone-400 hover:text-red-600"
                            >
                              删除
                            </button>
                          </div>
                          <p className="text-xs text-stone-400">
                            {new Date(o.created_at).toLocaleDateString()}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            {(o.tags || []).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                          {outlineViewId === o.id ? (
                            <>
                              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-stone-100 bg-stone-50 p-3 text-sm leading-7 text-stone-800">
                                {typeof o.result === "string"
                                  ? o.result
                                  : o.result?.outline || ""}
                              </pre>
                              <button
                                onClick={() => setOutlineViewId(null)}
                                className="self-start text-xs text-stone-500 underline hover:text-stone-700"
                              >
                                收起
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setOutlineViewId(o.id)}
                              className="self-start text-xs text-teal-700 underline hover:text-teal-800"
                            >
                              展开查看
                            </button>
                          )}
                          <button
                            onClick={() =>
                              downloadFile(
                                `${o.title}.md`,
                                typeof o.result === "string"
                                  ? o.result
                                  : o.result?.outline || "",
                                "text/markdown",
                              )
                            }
                            className="self-start text-xs text-stone-500 underline hover:text-stone-700"
                          >
                            下载 .md
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
              </>
            )}
          </section>
        )}

        {/* ─── 更多学习工具板块 ─── */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">更多学习工具</h2>
            <p className="mt-1 text-sm text-stone-500">
              学盒正在长成你的全能学习助手，以下功能陆续上线。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      {ICONS[f.title]}
                    </svg>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.live
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-teal-50 text-teal-700"
                    }`}
                  >
                    {f.live ? "已上线" : "即将上线"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">
                    {f.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-stone-500">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pt-2 text-center text-xs text-stone-400">
          学盒 xuebox · 测试版 · 让学习更轻松
        </footer>
      </main>
    </>
  );
}
