"use client";

import { useState } from "react";
import { SignInButton, useUser, useClerk } from "@clerk/nextjs";

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

type Mode = "outline" | "flashcard";

interface Card {
  question: string;
  answer: string;
  topic: string;
}

// ─── 自定义用户菜单（替代 UserButton，规避 EdgeOne 无 middleware 下登出客户端跳转卡死）───
function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);

  const handleSignOut = () => {
    // 正常登出；无论结果如何，1.2s 后强制整页刷新到首页，
    // 让会话 cookie 被重新读取、UI 状态复位（绕开客户端路由跳转卡死）。
    signOut({ redirectUrl: "/" }).catch(() => {});
    setTimeout(() => {
      window.location.assign("/");
    }, 1200);
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
            className="block w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-stone-50"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("outline");
  const [text, setText] = useState("");
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isSignedIn } = useUser();

  // 知识点卡片状态
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());

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
        body: JSON.stringify({ text }),
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

  function toggleFlip(i: number) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // 切换模式时清空结果
  function switchMode(m: Mode) {
    if (m !== mode) {
      setMode(m);
      setOutline("");
      setCards([]);
      setFlipped(new Set());
      setError("");
    }
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
                粘贴课件 / 笔记文本，一键生成结构化复习提纲。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSignedIn ? (
              <UserMenu />
            ) : (
              <SignInButton mode="modal">
                <button className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-800">
                  登录
                </button>
              </SignInButton>
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
        </div>

        {/* ─── 核心功能区（共用输入框） ─── */}
        <section className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <label htmlFor="source" className="text-sm font-medium text-stone-700">
            输入文本
          </label>
          <textarea
            id="source"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "outline"
                ? "把课件或笔记内容粘贴到这里……"
                : "粘贴要拆解成卡片的笔记内容……"
            }
            className="h-48 w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-900 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="self-start rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "生成中…"
              : mode === "outline"
                ? "生成提纲"
                : "生成卡片"}
          </button>
        </section>

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
              <button
                onClick={() => navigator.clipboard?.writeText(outline)}
                className="text-xs text-stone-500 underline hover:text-teal-700"
              >
                复制
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-stone-100 bg-stone-50 p-4 text-sm leading-7 text-stone-800">
              {outline}
            </pre>
          </section>
        )}

        {/* ─── 卡片结果（翻转交互） ─── */}
        {mode === "flashcard" && cards.length > 0 && (
          <section className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-700">
                生成的知识卡片（{cards.length} 张）
              </h2>
              <span className="text-xs text-stone-400">点击卡片翻转查看答案</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleFlip(i)}
                  className="group relative flex h-52 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:border-teal-300 hover:shadow-md"
                  style={{ perspective: "800px" }}
                >
                  {/* 翻转动画容器 */}
                  <div
                    className={`absolute inset-0 flex flex-col transition-transform duration-400 ${
                      flipped.has(i) ? "[transform:rotateY(180deg)]" : ""
                    }`}
                    style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
                  >
                    {/* 正面：问题 */}
                    <div className="flex h-full flex-col justify-between">
                      <span className="inline-block self-start rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                        {card.topic}
                      </span>
                      <p className="text-base font-semibold leading-relaxed text-stone-900">
                        {card.question}
                      </p>
                      <p className="text-xs text-stone-400">点击查看答案 ↓</p>
                    </div>
                  </div>
                  {/* 背面：答案（用绝对定位覆盖正面） */}
                  <div
                    className={`absolute inset-0 flex flex-col justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 p-5 ${
                      flipped.has(i) ? "" : "invisible"
                    }`}
                    style={{
                      transform: "rotateY(180deg)",
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <span className="mb-2 inline-block self-start rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                      {card.topic} · 答案
                    </span>
                    <p className="text-base leading-relaxed text-stone-800">
                      {card.answer}
                    </p>
                    <p className="mt-3 text-xs text-stone-400">点击返回问题 ↑</p>
                  </div>
                </button>
              ))}
            </div>
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
