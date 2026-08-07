"use client";

import { useEffect, useState } from "react";

export type StudyStats = {
  loggedIn: boolean;
  dbReady?: boolean;
  streak: number;
  totalCards: number;
  dueCards: number;
  totalOutlines: number;
  reviewedCards: number;
  masteredPct: number;
  daysActive: number;
  daily: { date: string; count: number }[];
  retentionSeries: number[];
};

const EMPTY: StudyStats = {
  loggedIn: false,
  streak: 0,
  totalCards: 0,
  dueCards: 0,
  totalOutlines: 0,
  reviewedCards: 0,
  masteredPct: 0,
  daysActive: 0,
  daily: [],
  retentionSeries: [],
};

/**
 * 拉取真实学习统计（/api/stats）。
 * - 401/未登录 → loggedIn=false，前端回退本地数据。
 * - dbReady=false → 数据库未接入，前端提示「数据暂未接入」。
 */
export function useStudyStats() {
  const [stats, setStats] = useState<StudyStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((j: Partial<StudyStats>) => {
        if (alive) setStats({ ...EMPTY, ...j });
      })
      .catch(() => {
        /* 网络失败时保持 EMPTY，不阻断界面 */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { stats, loading };
}
