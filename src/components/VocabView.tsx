"use client";

import { useState, useEffect, useRef } from "react";
import { WORD_BOOKS } from "@/lib/wordbooks";
import type { Card } from "@/components/view-types";
import { renderMarkdown } from "@/lib/markdown";

// 单词背诵视图：内置词书一键加入 + 翻卡背诵 + SM-2 间隔重复（复用 /api/cards/review）。
// 数据全部落在 cards 表（tags 含 'vocab'），因此也会自动出现在「我的复习」里。

function parseCustom(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.split(/\s*[-–—:：\t]\s+/);
      if (m.length >= 2) return { word: m[0], meaning: m.slice(1).join(" - ") };
      return null;
    })
    .filter((x): x is { word: string; meaning: string } => !!x && !!x.word && !!x.meaning);
}

export default function VocabView({ isSignedIn }: { isSignedIn?: boolean }) {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  // 自定义词表导入
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [importingCustom, setImportingCustom] = useState(false);

  // 背诵状态
  const [studying, setStudying] = useState(false);
  const [queue, setQueue] = useState<Card[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [studyMsg, setStudyMsg] = useState("");

  const gradingRef = useRef(false);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2600);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // 加载全部 vocab 卡片（用于词书状态与进度）
  async function loadAll() {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vocab?mode=all", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      setAllCards(data.cards || []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSignedIn) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // 每个内置词书的导入状态
  const bookStatus = WORD_BOOKS.map((b) => {
    const list = allCards.filter((c) => c.topic === b.name);
    return { book: b, imported: list.length > 0, count: list.length };
  });
  const customCount = allCards.filter((c) => c.topic === "我的词表").length;

  // 导入内置词书 → 导入后直接进入背诵
  async function importBook(key: string) {
    if (importingKey) return;
    setImportingKey(key);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "导入失败");
      setToast(
        data.imported === 0
          ? "该词书已加入，直接开始背诵吧 ✅"
          : `已加入 ${data.imported} 个单词 ✅`,
      );
      await loadAll();
      await startStudy();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImportingKey(null);
    }
  }

  // 导入自定义词表
  async function importCustom() {
    const words = parseCustom(customText);
    if (words.length === 0) {
      setToast("没识别到「单词 - 释义」格式，请每行一条。");
      return;
    }
    setImportingCustom(true);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "导入失败");
      setToast(`已导入 ${data.imported} 个单词 ✅`);
      setCustomText("");
      setShowCustom(false);
      await loadAll();
      await startStudy();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImportingCustom(false);
    }
  }

  // 开始背诵：优先待背(due)，无则背全部（含新词）
  async function startStudy() {
    if (!isSignedIn) return;
    setStudyMsg("");
    try {
      let res = await fetch("/api/vocab?mode=due", { method: "GET" });
      let data = await res.json();
      let cards: Card[] = res.ok ? data.cards || [] : [];
      if (cards.length === 0) {
        res = await fetch("/api/vocab?mode=all", { method: "GET" });
        data = await res.json();
        cards = res.ok ? data.cards || [] : [];
      }
      if (cards.length === 0) {
        setToast("还没有单词，先加入一本词书吧 👇");
        return;
      }
      setQueue(cards);
      setQIndex(0);
      setRevealed(false);
      setReviewedToday(0);
      setStudying(true);
    } catch {
      setToast("加载失败，请重试");
    }
  }

  function reveal() {
    setRevealed(true);
  }

  // 评分（quality 1忘记/3模糊/5记得）→ SM-2；乐观推进
  async function grade(quality: number) {
    const card = queue[qIndex];
    if (!card?.id || gradingRef.current) return;
    gradingRef.current = true;

    const next = qIndex + 1;
    setRevealed(false);
    setQIndex(next);
    setReviewedToday((n) => n + 1);
    if (next >= queue.length) setStudyMsg("🎉 本轮背诵完成！");

    try {
      const res = await fetch("/api/cards/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, quality }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast(data?.error || "同步失败，已记录本次评分");
      }
    } catch {
      setToast("网络异常，评分将在下次背诵重试");
    } finally {
      gradingRef.current = false;
    }
  }

  function exitStudy() {
    setStudying(false);
    setStudyMsg("");
    loadAll();
  }

  if (!isSignedIn) {
    return (
      <section className="glass-card flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: "rgba(45,212,191,0.12)", color: "var(--accent-teal)" }}>📚</div>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>单词背诵</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>登录后即可加入词书、按遗忘曲线科学背诵。</p>
        <a href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
          className="btn-primary-glow px-5 py-2 text-sm">登录 / 注册</a>
      </section>
    );
  }

  // ─── 背诵中 ───
  if (studying) {
    const card = queue[qIndex];
    const progress = Math.round((reviewedToday / queue.length) * 100);
    return (
      <section className="glass-card flex flex-col gap-5 p-6">
        {/* 进度条 */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {studyMsg ? "完成" : `第 ${Math.min(qIndex + 1, queue.length)} / ${queue.length} 个`}
          </span>
          <button onClick={exitStudy}
            className="text-xs underline opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--text-muted)" }}>退出背诵</button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: "var(--gradient-teal)" }} />
        </div>

        {studyMsg ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="text-4xl">🎉</div>
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>本轮背诵完成！</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>今日已背 {reviewedToday} 个单词，明天会按遗忘曲线提醒你复习。</p>
            <button onClick={exitStudy} className="btn-primary-glow px-5 py-2 text-sm">返回词书</button>
          </div>
        ) : card ? (
          <>
            <button type="button" onClick={reveal}
              className="group relative flex h-64 w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300"
              style={{
                background: revealed ? "rgba(45,212,191,0.06)" : "rgba(255,255,255,0.03)",
                borderColor: revealed ? "rgba(45,212,191,0.3)" : "rgba(255,255,255,0.06)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="inline-block self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: "rgba(45,212,191,0.12)", color: "var(--accent-teal)" }}>
                {card.topic}
              </span>
              {!revealed ? (
                <div className="flex flex-1 flex-col justify-center">
                  <p className="text-3xl font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{card.question}</p>
                  <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>点击卡片看释义 ↓</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col justify-center">
                  <div className="text-lg leading-relaxed" style={{ color: "var(--text-primary)" }} dangerouslySetInnerHTML={{ __html: renderMarkdown(card.answer) }} />
                  <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>点击返回单词 ↑</p>
                </div>
              )}
            </button>

            {/* 评分 */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => grade(1)} disabled={!revealed}
                className="rounded-xl px-3 py-3 text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(251,113,133,0.12)", color: "var(--accent-coral)", border: "1px solid rgba(251,113,133,0.2)" }}>
                忘记
              </button>
              <button onClick={() => grade(3)} disabled={!revealed}
                className="rounded-xl px-3 py-3 text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(251,191,36,0.12)", color: "var(--accent-amber)", border: "1px solid rgba(251,191,36,0.2)" }}>
                模糊
              </button>
              <button onClick={() => grade(5)} disabled={!revealed}
                className="rounded-xl px-3 py-3 text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: "rgba(16,185,129,0.12)", color: "var(--accent-emerald)", border: "1px solid rgba(16,185,129,0.2)" }}>
                记得
              </button>
            </div>
            <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
              先点卡片看释义，再按需选择掌握程度（忘记会更快再次安排复习）
            </p>
          </>
        ) : null}
      </section>
    );
  }

  // ─── 词书选择 ───
  return (
    <section className="flex flex-col gap-6">
      {/* 内置词书 */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>单词背诵</h2>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            加入一本词书即可开始背诵，系统会按遗忘曲线每天提醒你复习。已背的单词也会出现在「我的复习」里。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookStatus.map(({ book, imported, count }) => (
            <div key={book.key}
              className="feature-card flex flex-col gap-3 p-5"
              style={{ ['--ca' as string]: 'var(--accent-teal)' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                  style={{ background: "rgba(45,212,191,0.12)", color: "var(--accent-teal)" }}>📘</div>
                <span className="glass-badge" style={{ background: "rgba(45,212,191,0.1)", color: "var(--accent-teal)", borderColor: "rgba(45,212,191,0.2)" }}>
                  {book.scenario}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{book.name}</h3>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{book.desc}</p>
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{book.words.length} 词 · {imported ? `已加入 ${count} 词` : "未加入"}</p>
              {imported ? (
                <button onClick={startStudy}
                  className="btn-primary-glow mt-1 px-4 py-2 text-sm">开始背诵</button>
              ) : (
                <button onClick={() => importBook(book.key)} disabled={importingKey === book.key}
                  className="glass-btn mt-1 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  style={{ borderColor: "rgba(45,212,191,0.3)", color: "var(--accent-teal)" }}>
                  {importingKey === book.key ? "加入中…" : "加入背诵"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 自定义词表 */}
      <div className="glass-card flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>我的词表</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>粘贴你自己的单词本，每行一条：「单词 - 释义」（也支持「：」或 Tab 分隔）。{customCount > 0 ? `已导入 ${customCount} 词。` : ""}</p>
          </div>
          <button onClick={() => setShowCustom((v) => !v)}
            className="glass-btn px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "rgba(45,212,191,0.25)", color: "var(--accent-teal)" }}>
            {showCustom ? "收起" : "导入词表"}
          </button>
        </div>
        {showCustom && (
          <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--glass-border)" }}>
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder={"abandon - v. 放弃\nabstract：adj. 抽象的\naccess\tn. 通道"}
              className="glass-input h-32 w-full resize-y p-3 text-sm leading-relaxed placeholder:text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>识别为「单词 - 释义」格式</span>
              <button onClick={importCustom} disabled={importingCustom || !customText.trim()}
                className="btn-primary-glow px-4 py-2 text-sm disabled:opacity-50">导入并开始背诵</button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="glass-toast fixed bottom-6 left-1/2 z-50 px-5 py-2.5 text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}
    </section>
  );
}
