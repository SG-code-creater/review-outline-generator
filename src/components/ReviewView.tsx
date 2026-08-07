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
                      <p className="text-xs text-stone-400">共 {filtered.length} 张</p>
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

          {/* 错题集已升级为顶级「📕 错题本」Tab（见下方 mode === "mistakes" 区块） */}
        </>
      )}
    </section>
  );
}
