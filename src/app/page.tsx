"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import Dashboard from "@/components/Dashboard";
import { useUser } from "@clerk/nextjs";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";
import {
  type Mode,
  type ReviewView,
  type CardStatus,
  type Card,
  type SavedOutline,
  type Mistake,
  type QuizItem,
} from "@/components/view-types";

// 模式切换骨架屏（懒加载子组件时的占位）
function ViewSkeleton({ title }: { title: string }) {
  return (
    <section className="glass-card flex flex-col gap-4 p-6">
      <div className="h-4 w-24 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex flex-col gap-3">
        <div className="h-24 w-full animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-24 w-full animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="h-24 w-full animate-pulse rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{title}加载中…</span>
    </section>
  );
}

// ─── 仪表盘组件（问候/座右铭/天气/任务/番茄钟/趋势/打卡，可自定义） ───
// 实现见 src/components/Dashboard.tsx

const QuizView = dynamic(() => import("@/components/QuizView"), {
  ssr: false,
  loading: () => <ViewSkeleton title="自测题" />,
});
const ReviewViewComp = dynamic(() => import("@/components/ReviewView"), {
  ssr: false,
  loading: () => <ViewSkeleton title="我的复习" />,
});
const MistakesView = dynamic(() => import("@/components/MistakesView"), {
  ssr: false,
  loading: () => <ViewSkeleton title="错题本" />,
});
const VocabView = dynamic(() => import("@/components/VocabView"), {
  ssr: false,
  loading: () => <ViewSkeleton title="单词背诵" />,
});

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
  考试倒计时: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  自测题: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  我的复习: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </>
  ),
};

// ─── 板块数据（知识点卡片已上线，其余仍占位） ──────────
// live=true 表示功能已可点击进入；mode 绑定点击后切换到的顶部模式
const FEATURES = [
  {
    title: "知识点卡片",
    desc: "把长篇笔记拆成可记忆的小卡片，支持翻面记忆与间隔重复。",
    live: true,
    mode: "flashcard" as Mode,
  },
  {
    title: "自测题",
    desc: "从资料生成选择题，主动回忆检测掌握程度，答错的自动入错题本。",
    live: true,
    mode: "quiz" as Mode,
  },
  {
    title: "我的复习",
    desc: "按遗忘曲线安排每日复习队列，卡片题集分组标签管理。",
    live: true,
    mode: "review" as Mode,
  },
  {
    title: "错题本整理",
    desc: "汇总自测答错的题与上传的错题，标注来源与原文依据，支持溯源高亮。",
    live: true,
    mode: "mistakes" as Mode,
  },
  {
    title: "PDF 智能问答",
    desc: "上传课件 PDF，直接提问，基于原文给出带出处的答案。",
    live: false,
  },
  {
    title: "单词背诵助手",
    desc: "按词频与考频生成背诵清单，配合测验巩固记忆。",
    live: true,
    mode: "vocab" as Mode,
  },
  {
    title: "考试倒计时",
    desc: "设置考试日期，自动规划每日复习节奏与提醒。",
    live: false,
  },
];


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
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-medium transition-all duration-200"
        style={{
          background: 'var(--gradient-teal)',
          boxShadow: '0 0 16px rgba(45,212,191,0.15)',
        }}
        aria-label="用户菜单"
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-white">
            {(user?.firstName?.[0] ?? user?.username?.[0] ?? "我").toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl py-1 shadow-xl"
          style={{
            background: 'rgba(15,18,25,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '0.5px solid var(--glass-border)',
          }}
        >
          <a href="https://accounts.xuebox.me/user" target="_blank" rel="noreferrer"
            className="block px-4 py-2 text-sm transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--text-secondary)' }}
          >管理账户</a>
          <button type="button" onClick={handleSignOut} disabled={signingOut}
            className="block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            style={{ color: 'var(--accent-coral)' }}
          >{signingOut ? "退出中…" : "退出登录"}</button>
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

  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [mistakeOrigin, setMistakeOrigin] = useState<"all" | "quiz" | "upload">("all");
  const [mistakeLoading, setMistakeLoading] = useState(false);
  const [openMistakeId, setOpenMistakeId] = useState<string | null>(null); // 展开查看原文（高亮依据）

  // 上传错题状态（PDF/图片 → 文本提取 → AI 识别题目 → 入库）
  const mistakeFileRef = useRef<HTMLInputElement>(null);
  const [uploadingMistakes, setUploadingMistakes] = useState(false);
  const [uploadMistakeText, setUploadMistakeText] = useState(""); // 提取后的文本（可编辑）
  const [uploadExtracting, setUploadExtracting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadDragOver, setUploadDragOver] = useState(false);

  // 「即将上线」toast 提示
  const [toastMsg, setToastMsg] = useState("");
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(""), 2500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // 功能卡片点击：已上线 → 切换模式；未上线 → 提示
  function handleFeatureClick(f: (typeof FEATURES)[number]) {
    if (f.live && f.mode) {
      switchMode(f.mode);
      // Tab 栏已作为主导航，不再强制回顶；用户可通过 Tab 栏即时切换
    } else {
      setToastMsg(`「${f.title}」即将上线，敬请期待 ✨`);
    }
  }

  // 评分防重复点击（乐观更新用）
  const gradingRef = useRef(false);

  // 题集内每张卡片的临时标签输入
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  // 自测题（主动回忆）状态
  const [quiz, setQuiz] = useState<QuizItem[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizPicked, setQuizPicked] = useState<number[]>([]); // 每题选中的选项下标，-1 未答
  const [quizRevealed, setQuizRevealed] = useState<boolean[]>([]); // 每题是否已揭示答案
  const [savedQuizIdx, setSavedQuizIdx] = useState<Set<number>>(new Set()); // 已收入错题集的题下标
  const [saveMistakeState, setSaveMistakeState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMistakeIdx, setSaveMistakeIdx] = useState<number | null>(null);

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
    setSavedQuizIdx(new Set());
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

  // 把答错的题收入错题本（溯源：带上源文本与依据引文）
  async function saveMistake(qi: number) {
    const q = quiz[qi];
    if (!q) return;
    setSaveMistakeState("saving");
    setSaveMistakeIdx(qi);
    try {
      const res = await fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          answer: q.answer,
          picked: quizPicked[qi] ?? null,
          explanation: q.explanation,
          evidence: q.evidence || null,
          source_text: text,
          source_title: scenario && scenario !== "通用" ? scenario : text.slice(0, 40),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "保存失败");
      setSavedQuizIdx((prev) => new Set(prev).add(qi));
      setSaveMistakeState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setSaveMistakeState("error");
    } finally {
      setSaveMistakeIdx(null);
    }
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

  async function loadMistakes() {
    setMistakeLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mistakes", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      setMistakes(data.mistakes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setMistakeLoading(false);
    }
  }

  // ─── 上传错题：文件 → 文本提取 → AI 识别 → 入库 ───
  async function handleMistakeFile(file?: File | null) {
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
    setUploadExtracting(true);
    setError("");
    setUploadMsg(isPdf ? "正在解析 PDF…" : "正在识别图片文字…");
    try {
      const extracted = isPdf ? await extractPdfText(file) : await ocrImage(file);
      const trimmed = extracted.replace(/\s+/g, " ").trim();
      if (!trimmed) {
        setError("没能提取到文字，请确认文件内容清晰或换一份再试。");
      } else {
        setUploadMistakeText(trimmed);
        setUploadMsg(`已提取 ${trimmed.length} 字，点击「识别错题」开始整理。`);
      }
    } catch (e) {
      setError("解析失败：" + (e instanceof Error ? e.message : "未知错误"));
    } finally {
      setUploadExtracting(false);
      setTimeout(() => setUploadMsg(""), 5000);
      if (mistakeFileRef.current) mistakeFileRef.current.value = "";
    }
  }

  // 调用 /api/mistakes/upload：AI 从文本中识别题目并批量入库
  async function uploadMistakesToServer() {
    if (!uploadMistakeText.trim()) {
      setError("请先上传文件提取文本。");
      return;
    }
    setUploadingMistakes(true);
    setError("");
    try {
      const res = await fetch("/api/mistakes/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: uploadMistakeText, scenario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "上传失败");

      // 成功：刷新错题列表 + 清空输入
      setUploadMsg(`✅ 已识别并收录 ${data.count} 道错题！`);
      setUploadMistakeText("");
      loadMistakes(); // 刷新列表
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploadingMistakes(false);
      setTimeout(() => setUploadMsg(""), 4000);
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


  // 进入"我的复习"且已登录时，按子视图拉取数据；进入"错题本"则拉错题
  useEffect(() => {
    if (!isSignedIn) return;
    if (mode === "review") {
      if (reviewView === "due") loadDueCards();
      else if (reviewView === "collection") loadCollection();
      else if (reviewView === "outlines") loadOutlines();
    } else if (mode === "mistakes") {
      loadMistakes();
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
      {/* 浮动光晕层 — 给毛玻璃提供可折射的色彩内容 */}
      <div className="aurora" aria-hidden>
        <span className="o1" />
        <span className="o2" />
        <span className="o3" />
      </div>

      {/* 微妙品牌顶线 */}
      <div className="h-[2px] w-full opacity-40 relative z-10" style={{ background: 'linear-gradient(90deg, transparent, var(--accent-teal), var(--accent-purple), transparent)' }} />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
        {/* ─── Header（暗色玻璃态） ─── */}
        <header className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              switchMode("outline");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group flex items-start gap-3.5 text-left cursor-pointer rounded-2xl p-3 -ml-3 transition-all duration-200 hover:bg-white/[0.03]"
            aria-label="返回首页（提纲生成）"
          >
            {/* Logo — 渐变玻璃方块 */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
                 style={{ background: 'var(--gradient-teal)', boxShadow: '0 0 24px rgba(45,212,191,0.2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M12 6c-2-1.5-5-1.5-7 0v12c2-1.5 5-1.5 7 0 2-1.5 5-1.5 7 0V6c-2-1.5-5-1.5-7 0Z" />
                <path d="M12 6v12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  xuebox
                </h1>
                <span className="glass-badge" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)', borderColor: 'rgba(251,191,36,0.2)' }}>
                  测试版
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                智能学习工具箱 · 让学习更轻松
              </p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {isSignedIn ? (
              <UserMenu />
            ) : (
              <a
                href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
                className="glass-btn inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium"
                style={{ borderColor: 'rgba(45,212,191,0.25)', color: 'var(--accent-teal)' }}
              >
                登录
              </a>
            )}
          </div>
        </header>

        {/* ─── 模式切换 Tab 导航（替代底部卡片作为主导航） ─── */}
        <nav className="flex gap-1 overflow-x-auto rounded-xl p-1 scrollbar-none"
          style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid var(--glass-border)' }}
          aria-label="功能模块切换"
        >
          {([
            { key: "outline" as Mode, label: "提纲生成", icon: "📝" },
            { key: "flashcard" as Mode, label: "知识点卡片", icon: "🧠" },
            { key: "quiz" as Mode, label: "自测题", icon: "❓" },
            { key: "review" as Mode, label: "我的复习", icon: "🔄" },
            { key: "mistakes" as Mode, label: "错题本", icon: "📕" },
            { key: "vocab" as Mode, label: "单词背诵", icon: "📚" },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { switchMode(tab.key); }}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
                mode === tab.key
                  ? 'text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]'
              }`}
              style={mode === tab.key ? ({ background: 'var(--gradient-teal)', boxShadow: '0 0 16px rgba(45,212,191,0.2)' }) : undefined}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ─── 核心功能区（共用输入框，仅提纲/卡片/自测题模式） ─── */}
        {(mode === "outline" || mode === "flashcard" || mode === "quiz") && (
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
          className={`glass-card flex flex-col gap-4 p-6 ${dragOver ? 'glass-card-active' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="source" className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
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
                className="glass-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ borderColor: dragOver ? 'rgba(45,212,191,0.3)' : undefined }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {extracting ? "解析中…" : "上传 PDF / 图片"}
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
            className="glass-input h-44 w-full resize-y p-4 text-sm leading-relaxed placeholder:text-sm"
          />
          {/* 备考场景（折叠进输入卡，不占顶部仪表盘空间） */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>备考场景</span>
            {SCENARIOS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScenario(s)}
                className={scenario === s ? "glass-pill-active" : "glass-pill"}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {extractMsg || (dragOver ? "松开即可提取文字" : "支持拖拽文件到此处")}
            </span>
            <button
              onClick={mode === "quiz" ? generateQuiz : handleGenerate}
              disabled={loading || quizLoading || extracting}
              className="btn-primary-glow self-start px-6 py-2.5 text-sm"
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

        {/* ─── 仪表盘（提纲模式下显示在输入区下方，其他模式不占空间） ─── */}
        {mode === "outline" && <Dashboard />}

        {error && (
          <div className="glass-card px-4 py-3" style={{ background: 'rgba(251,113,133,0.08)', borderColor: 'rgba(251,113,133,0.15)' }}>
            <p className="text-sm" style={{ color: 'var(--accent-coral)' }}>{error}</p>
          </div>
        )}

        {/* ─── 提纲结果 ─── */}
        {mode === "outline" && outline && (
          <section className="glass-card flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>生成的提纲</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => navigator.clipboard?.writeText(outline)} className="text-xs underline opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-teal)' }}>
                  复制
                </button>
                <button onClick={exportOutlineMd} className="text-xs underline opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-teal)' }}>
                  下载 .md
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl p-4 text-sm leading-7" style={{ background: 'rgba(0,0,0,0.25)', color: 'var(--text-primary)', border: '0.5px solid var(--glass-border)' }}>
              {outline}
            </pre>
            {/* 收藏提纲 */}
            <div className="mt-1 flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <input value={outlineTitleInput} onChange={(e) => setOutlineTitleInput(e.target.value)} placeholder="提纲标题（可选）"
                  className="glass-input w-40 px-2 py-1 text-xs" />
                <input value={outlineTagInput} onChange={(e) => setOutlineTagInput(e.target.value)} placeholder="标签，逗号分隔（可选）"
                  className="glass-input w-44 px-2 py-1 text-xs" />
                {isSignedIn ? (
                  saveOutlineState === "saved" ? (
                    <span className="text-xs font-medium" style={{ color: 'var(--accent-emerald)' }}>已收藏 ✓</span>
                  ) : (
                    <button onClick={saveOutline} disabled={saveOutlineState === "saving"}
                      className="btn-primary-glow px-3 py-1 text-xs disabled:opacity-50">
                      {saveOutlineState === "saving" ? "收藏中…" : "保存到我的提纲"}
                    </button>
                  )
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>登录后可收藏</span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ─── 卡片结果（翻转交互） ─── */}
        {mode === "flashcard" && cards.length > 0 && (
          <section className="glass-card flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                生成的知识卡片（{cards.length} 张）
              </h2>
              <div className="flex items-center gap-3">
                {isSignedIn ? (
                  saveState === "saved" ? (
                    <span className="text-xs font-medium" style={{ color: 'var(--accent-emerald)' }}>已保存 ✓</span>
                  ) : (
                    <button onClick={saveCards} disabled={saveState === "saving"}
                      className="text-xs font-medium underline opacity-70 hover:opacity-100 disabled:opacity-50" style={{ color: 'var(--accent-teal)' }}>
                      {saveState === "saving" ? "保存中…" : "保存到我的卡片"}
                    </button>
                  )
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>登录后可保存</span>
                )}
                <button onClick={copyAllCards} className="text-xs underline opacity-60 hover:opacity-100" style={{ color: 'var(--accent-teal)' }}>复制全部</button>
                <button onClick={exportAnki} className="text-xs underline opacity-60 hover:opacity-100" style={{ color: 'var(--accent-teal)' }}>导出 Anki</button>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>点击卡片翻转查看答案</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, i) => {
                const isFlipped = flipped.has(i);
                return (
                  <button key={i} type="button" onClick={() => toggleFlip(i)}
                    className={`group relative flex h-52 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-5 text-left transition-all duration-300 ${
                      isFlipped ? 'border-teal-500/30' : 'border-white/[0.06]'
                    }`}
                    style={{
                      background: isFlipped ? 'rgba(45,212,191,0.06)' : 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    {/* 正面：问题 */}
                    <div className={`flex h-full flex-col justify-between ${isFlipped ? "hidden" : ""}`}>
                      <span className="inline-block self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--accent-teal)' }}>
                        {card.topic}
                      </span>
                      <p className="text-base font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {card.question}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>点击查看答案 ↓</p>
                    </div>
                    {/* 背面：答案 */}
                    <div className={`flex h-full flex-col justify-center ${!isFlipped ? "hidden" : ""}`}>
                      <span className="mb-2 inline-block self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(45,212,191,0.18)', color: 'var(--accent-teal)' }}>
                        {card.topic} · 答案
                      </span>
                      <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {card.answer}
                      </p>
                      <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>点击返回问题 ↑</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── 自测题（主动回忆） ─── */}
        {mode === "quiz" && (
        <QuizView
          quiz={quiz}
          quizLoading={quizLoading}
          quizPicked={quizPicked}
          quizRevealed={quizRevealed}
          savedQuizIdx={savedQuizIdx}
          saveMistakeState={saveMistakeState}
          saveMistakeIdx={saveMistakeIdx}
          isSignedIn={isSignedIn}
          onGenerateQuiz={generateQuiz}
          onPickOption={pickQuizOption}
          onSaveMistake={saveMistake}
          onResetQuiz={() => {
            setQuizPicked([]);
            setQuizRevealed([]);
          }}
        />
        )}

        {mode === "review" && (
        <ReviewViewComp
          isSignedIn={isSignedIn}
          reviewView={reviewView}
          setReviewView={setReviewView}
          reviewMsg={reviewMsg}
          reviewLoading={reviewLoading}
          reviewCards={reviewCards}
          reviewIndex={reviewIndex}
          reviewRevealed={reviewRevealed}
          setReviewRevealed={setReviewRevealed}
          loadDueCards={loadDueCards}
          gradeCard={gradeCard}
          collectionCards={collectionCards}
          collectionStatus={collectionStatus}
          setCollectionStatus={setCollectionStatus}
          collectionTag={collectionTag}
          setCollectionTag={setCollectionTag}
          allTags={allTags}
          collectionLoading={collectionLoading}
          deleteCard={deleteCard}
          updateCardTags={updateCardTags}
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          outlineLoading={outlineLoading}
          outlines={outlines}
          deleteOutline={deleteOutline}
          outlineViewId={outlineViewId}
          setOutlineViewId={setOutlineViewId}
          downloadFile={downloadFile}
        />
        )}

        {mode === "mistakes" && (
        <MistakesView
          isSignedIn={isSignedIn}
          mistakes={mistakes}
          mistakeOrigin={mistakeOrigin}
          setMistakeOrigin={setMistakeOrigin}
          mistakeLoading={mistakeLoading}
          openMistakeId={openMistakeId}
          setOpenMistakeId={setOpenMistakeId}
          uploadDragOver={uploadDragOver}
          setUploadDragOver={setUploadDragOver}
          mistakeFileRef={mistakeFileRef}
          handleMistakeFile={handleMistakeFile}
          uploadExtracting={uploadExtracting}
          uploadMistakeText={uploadMistakeText}
          setUploadMistakeText={setUploadMistakeText}
          uploadMsg={uploadMsg}
          setUploadMsg={setUploadMsg}
          uploadingMistakes={uploadingMistakes}
          uploadMistakesToServer={uploadMistakesToServer}
        />
        )}

        {mode === "vocab" && (
          <VocabView isSignedIn={isSignedIn} />
        )}

        {/* ─── 更多工具发现区（辅助入口，主导航已移至顶部 Tab 栏） ─── */}
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>更多工具</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              已上线的功能可通过顶部 Tab 栏快速切换，以下为功能一览与即将上线预告。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, idx) => {
              const isActive = f.live && !!f.mode && mode === f.mode;
              // 为每个已上线功能分配不同 accent 色
              const accents = [
                'var(--accent-teal)',     // 知识点卡片
                'var(--accent-purple)',    // 自测题
                'var(--accent-emerald)',   // 我的复习
                'var(--accent-coral)',     // 错题本
              ];
              const accentColor = f.live ? (accents[idx % accents.length] || 'var(--accent-teal)') : undefined;
              return (
                <button
                  key={f.title}
                  type="button"
                  onClick={() => handleFeatureClick(f)}
                  className={`feature-card group flex flex-col gap-3 p-5 text-left transition-all duration-200 cursor-pointer ${
                    isActive ? 'glass-card-active' : 'glass-card hover:-translate-y-0.5'
                  }`}
                  style={f.live ? ({ ['--ca' as string]: accentColor } as React.CSSProperties) : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{
                        background: isActive ? `${accentColor}18` : 'rgba(255,255,255,0.05)',
                        color: accentColor || 'var(--text-secondary)',
                        boxShadow: isActive ? `0 0 16px ${accentColor}15` : 'none',
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                        {ICONS[f.title]}
                      </svg>
                    </div>
                    <span className={f.live ? "glass-badge glass-badge-live" : "glass-badge glass-badge-soon"}>
                      {f.live ? (isActive ? "当前" : "已上线") : "即将上线"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {f.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {f.desc}
                    </p>
                  </div>
                  {f.live && (
                    <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{ color: accentColor || 'var(--accent-teal)' }}>
                      点击进入 →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ─── Toast 提示 ─── */}
        {toastMsg && (
          <div className="glass-toast fixed bottom-6 left-1/2 z-50 px-5 py-2.5 text-sm font-medium shadow-xl">
            {toastMsg}
          </div>
        )}

        <footer className="pt-4 text-center text-xs tracking-wide" style={{ color: 'var(--text-muted)' }}>
          学盒 xuebox · 测试版 · 让学习更轻松
        </footer>
      </main>
    </>
  );
}
