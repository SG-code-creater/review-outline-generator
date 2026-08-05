"use client";

import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [outline, setOutline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          复习提纲生成器
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          粘贴课件 / 笔记文本，一键生成结构化复习提纲。
        </p>
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
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
    </main>
  );
}
