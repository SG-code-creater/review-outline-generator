"use client";

import { useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              复习提纲生成器
            </h1>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              测试版
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            粘贴课件 / 笔记文本，一键生成结构化复习提纲。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700">
                登录
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <label htmlFor="source" className="text-sm font-medium text-zinc-700">
          输入文本
        </label>
        <textarea
          id="source"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="把课件或笔记内容粘贴到这里……"
          className="h-48 w-full resize-y rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="self-start rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-700">生成的提纲</h2>
            <button
              onClick={() => navigator.clipboard?.writeText(outline)}
              className="text-xs text-zinc-500 underline hover:text-zinc-700"
            >
              复制
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-7 text-zinc-800">
            {outline}
          </pre>
        </section>
      )}

      {/* 更多学习工具板块（陆续上线） */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">更多学习工具</h2>
          <p className="mt-1 text-sm text-zinc-500">
            学盒正在长成你的全能学习助手，以下功能陆续上线。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-zinc-900">
                  {f.title}
                </h3>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                  即将上线
                </span>
              </div>
              <p className="text-sm leading-6 text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
