"use client";

import { useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

// 线性图标（stroke=currentColor），每张"即将上线"板块一个，强化品牌识别
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

// 规划中的学习工具板块（陆续上线，先以卡片占位，不接真实功能）
const FEATURES = [
  {
    title: "错题本整理",
    desc: "拍照或粘贴错题，自动归类知识点与易错原因，生成专属错题集。",
  },
  {
    title: "知识点卡片",
    desc: "把长篇笔记拆成可记忆的小卡片，支持间隔重复复习。",
  },
  {
    title: "PDF 智能问答",
    desc: "上传课件 PDF，直接提问，基于原文给出带出处的答案。",
  },
  {
    title: "单词背诵助手",
    desc: "按词频与考频生成背诵清单，配合测验巩固记忆。",
  },
  {
    title: "试卷分析",
    desc: "上传试卷，定位薄弱章节并推荐针对性练习。",
  },
  {
    title: "考试倒计时",
    desc: "设置考试日期，自动规划每日复习节奏与提醒。",
  },
];

export default function Home() {
  const [text, setText] = useState("");
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isSignedIn } = useUser();

  async function handleGenerate() {
    setError("");
    if (!text.trim()) {
      setError("请先粘贴或输入课件 / 笔记文本。");
      return;
    }
    setLoading(true);
    setOutline("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "生成失败，请稍后重试。");
      }
      setOutline(data.outline || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* 品牌顶栏 */}
      <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 via-teal-500 to-emerald-500" />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* 品牌标识 */}
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
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button className="rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-800">
                  登录
                </button>
              </SignInButton>
            )}
          </div>
        </header>

        {/* 核心功能卡片 */}
        <section className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <label htmlFor="source" className="text-sm font-medium text-stone-700">
            输入文本
          </label>
          <textarea
            id="source"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="把课件或笔记内容粘贴到这里……"
            className="h-48 w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-900 shadow-sm outline-none transition-colors placeholder:text-stone-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="self-start rounded-full bg-teal-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "生成中…" : "生成提纲"}
          </button>
        </section>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <p>{error}</p>
          </div>
        )}

        {outline && (
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

        {/* 更多学习工具板块（陆续上线） */}
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
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    即将上线
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
