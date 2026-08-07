"use client";

import { type Dispatch, type SetStateAction } from "react";
import {
  type ReviewView as ReviewViewType,
  type CardStatus,
  type Card,
  type SavedOutline,
} from "@/components/view-types";
import { cardStatus } from "@/components/shared-ui";

interface ReviewViewProps {
  isSignedIn: boolean | undefined;
  reviewView: ReviewViewType;
  setReviewView: (v: ReviewViewType) => void;
  reviewMsg: string;
  reviewLoading: boolean;
  reviewCards: Card[];
  reviewIndex: number;
  reviewRevealed: boolean;
  setReviewRevealed: (b: boolean) => void;
  loadDueCards: () => void;
  gradeCard: (quality: number) => void;
  collectionCards: Card[];
  collectionStatus: CardStatus;
  setCollectionStatus: (v: CardStatus) => void;
  collectionTag: string | null;
  setCollectionTag: (v: string | null) => void;
  allTags: string[];
  collectionLoading: boolean;
  deleteCard: (id: string) => void;
  updateCardTags: (id: string, tags: string[]) => void;
  tagDraft: Record<string, string>;
  setTagDraft: Dispatch<SetStateAction<Record<string, string>>>;
  outlineLoading: boolean;
  outlines: SavedOutline[];
  deleteOutline: (id: string) => void;
  outlineViewId: string | null;
  setOutlineViewId: (id: string | null) => void;
  downloadFile: (filename: string, content: string, mime: string) => void;
}

export default function ReviewView({
  isSignedIn,
  reviewView,
  setReviewView,
  reviewMsg,
  reviewLoading,
  reviewCards,
  reviewIndex,
  reviewRevealed,
  setReviewRevealed,
  loadDueCards,
  gradeCard,
  collectionCards,
  collectionStatus,
  setCollectionStatus,
  collectionTag,
  setCollectionTag,
  allTags,
  collectionLoading,
  deleteCard,
  updateCardTags,
  tagDraft,
  setTagDraft,
  outlineLoading,
  outlines,
  deleteOutline,
  outlineViewId,
  setOutlineViewId,
  downloadFile,
}: ReviewViewProps) {
  return (
    <section className="glass-card flex flex-col gap-4 p-6">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>我的复习</h2>

      {!isSignedIn ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            登录后即可保存卡片与提纲，并在此按间隔重复复习。
          </p>
          <a
            href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
            className="btn-primary-glow px-5 py-2 text-sm"
          >
            登录
          </a>
        </div>
      ) : (
        <>
          {/* 子视图切换 */}
          <div className="flex gap-1 rounded-lg p-1 w-fit"
            style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--glass-border)' }}
          >
            {([
              ["due", "今日复习"],
              ["collection", "卡片题集"],
              ["outlines", "我的提纲"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setReviewView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  reviewView === v ? 'glass-pill-active' : 'glass-pill'
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
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{reviewMsg}</p>
                <button
                  onClick={loadDueCards}
                  className="btn-primary-glow mt-4 px-4 py-2 text-sm"
                >
                  再看一下
                </button>
              </div>
            ) : reviewLoading && reviewCards.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>加载中…</p>
            ) : reviewCards.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>还没有待复习的卡片。</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  去「知识点卡片」生成后点击「保存到我的卡片」即可在这里复习。
                </p>
              </div>
            ) : reviewIndex >= reviewCards.length ? (
              <div className="py-10 text-center">
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>本轮复习完成！</p>
                <button
                  onClick={loadDueCards}
                  className="btn-primary-glow mt-4 px-4 py-2 text-sm"
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
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      待复习 {reviewIndex + 1} / {reviewCards.length}
                    </p>
                    <div className="flex h-64 flex-col justify-between rounded-xl border p-5"
                      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <span className="inline-block self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--accent-teal)' }}
                      >
                        {card?.topic}
                      </span>
                      <p className="text-lg font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {card?.question}
                      </p>
                      {reviewRevealed ? (
                        <div className="flex flex-col gap-3">
                          <p className="border-t pt-3 text-sm leading-relaxed"
                            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
                          >
                            {card?.answer}
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => gradeCard(1)}
                              className={`${btn} rounded-lg text-sm font-medium`}
                              style={{ background: 'rgba(251,113,133,0.1)', color: 'var(--accent-coral)', border: '0.5px solid rgba(251,113,133,0.2)' }}
                            >忘记</button>
                            <button onClick={() => gradeCard(3)}
                              className={`${btn} rounded-lg text-sm font-medium`}
                              style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--accent-amber)', border: '0.5px solid rgba(251,191,36,0.2)' }}
                            >模糊</button>
                            <button onClick={() => gradeCard(5)}
                              className={`${btn} rounded-lg text-sm font-medium`}
                              style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--accent-emerald)', border: '0.5px solid rgba(52,211,153,0.2)' }}
                            >记得</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReviewRevealed(true)}
                          className="self-start rounded-lg px-3 py-1.5 text-sm font-medium"
                          style={{ background: 'rgba(45,212,191,0.1)', color: 'var(--accent-teal)', border: '0.5px solid rgba(45,212,191,0.2)' }}
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
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          collectionStatus === t.v ? 'glass-pill-active' : 'glass-pill'
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
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          collectionTag === t ? 'glass-pill-active' : 'glass-pill'
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
                    <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>加载中…</p>
                  ) : collectionCards.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>还没有保存的卡片。</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        去「知识点卡片」生成后点击「保存到我的卡片」。
                      </p>
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-stone-400">
                      该筛选下没有卡片。
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>共 {filtered.length} 张</p>
                      {filtered.map((c) => (
                        <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-4"
                          style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{ background: 'rgba(45,212,191,0.1)', color: 'var(--accent-teal)' }}
                              >{c.topic}</span>
                              <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                                style={{
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'var(--text-secondary)',
                                  border: '0.5px solid rgba(255,255,255,0.08)',
                                }}
                              >{cardStatus(c).label}</span>
                            </div>
                            <button
                              onClick={() => deleteCard(c.id!)}
                              className="text-xs text-stone-400 hover:text-red-600"
                            >
                              删除
                            </button>
                          </div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {c.question}
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {c.answer}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            {(c.tags || []).map((t) => (
                              <span key={t} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '0.5px solid rgba(255,255,255,0.06)' }}
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
                              className="glass-input w-20 px-2 py-0.5 text-xs"
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
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>加载中…</p>
            ) : outlines.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>还没有收藏的提纲。</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  在「提纲生成」生成后点击「保存到我的提纲」即可沉淀到这里。
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {outlines.map((o) => (
                  <div key={o.id} className="flex flex-col gap-2 rounded-xl border p-4"
                    style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {o.title}
                      </h3>
                      <button
                        onClick={() => deleteOutline(o.id)}
                        className="text-xs text-stone-400 hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {(o.tags || []).map((t) => (
                        <span key={t} className="rounded-full px-2 py-0.5 text-xs"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                        >#{t}</span>
                      ))}
                    </div>
                    {outlineViewId === o.id ? (
                      <>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border p-3 text-sm leading-7"
                          style={{
                            borderColor: 'rgba(255,255,255,0.05)',
                            background: 'rgba(0,0,0,0.2)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {typeof o.result === "string"
                            ? o.result
                            : o.result?.outline || ""}
                        </pre>
                        <button onClick={() => setOutlineViewId(null)}
                          className="self-start text-xs underline opacity-60 hover:opacity-100"
                          style={{ color: 'var(--accent-teal)' }}
                        >收起</button>
                      </>
                    ) : (
                      <button onClick={() => setOutlineViewId(o.id)}
                        className="self-start text-xs underline opacity-60 hover:opacity-100"
                        style={{ color: 'var(--accent-teal)' }}
                      >展开查看</button>
                    )}
                    <button onClick={() => downloadFile(`${o.title}.md`, typeof o.result === "string" ? o.result : o.result?.outline || "", "text/markdown")}
                      className="self-start text-xs underline opacity-60 hover:opacity-100"
                      style={{ color: 'var(--accent-teal)' }}
                    >下载 .md</button>
                  </div>
                ))}
              </div>
            ))}

          {/* 错题集已升级为顶级「📕 错题本」Tab（见下方 mode === "mistakes" 区块） */}
        </>
      )}
    </section>
  );
}
