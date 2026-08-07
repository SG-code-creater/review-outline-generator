// 纯展示型辅助函数（从 page.tsx 抽出，供 ReviewView / MistakesView 复用）
import { type Card } from "./view-types";

// 卡片状态徽标
export function cardStatus(card: Card): { label: string; cls: string } {
  if (card.last_grade == null) return { label: "未学", cls: "bg-stone-100 text-stone-600" };
  if (card.last_grade <= 1) return { label: "薄弱", cls: "bg-red-100 text-red-700" };
  if (card.last_grade === 3) return { label: "模糊", cls: "bg-amber-100 text-amber-700" };
  return { label: "掌握", cls: "bg-emerald-100 text-emerald-700" };
}

/**
 * 溯源高亮：在原文中把依据句（evidence）高亮出来。
 * 纯字符串匹配，无需向量库 / embedding；若依据不在原文中则原样返回。
 */
export function highlightSource(src: string, evidence: string | null) {
  if (!evidence || !src) return src;
  if (src.indexOf(evidence) === -1) return src;
  const parts = src.split(evidence);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 ? (
        <mark className="rounded bg-amber-200 px-0.5 text-stone-900">{evidence}</mark>
      ) : null}
    </span>
  ));
}
