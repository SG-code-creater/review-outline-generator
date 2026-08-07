import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 真实学习统计聚合：基于 usage（生成调用）/ generations（收藏提纲）/ cards（知识点卡复习）
// 按 Clerk userId 计算连续打卡、每日学习量、记忆保持率等，供仪表盘展示「真实情况」。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  // 未登录：客户端回退到本地演示数据
  if (!userId) return NextResponse.json({ loggedIn: false }, { status: 200 });

  const supabase = getServerSupabase();
  // 数据库未配置：标记 dbReady=false，由前端提示「数据暂未接入」
  if (!supabase)
    return NextResponse.json({ loggedIn: true, dbReady: false }, { status: 200 });

  try {
    const [{ data: usage }, { data: gens }, { data: cards }] = await Promise.all([
      supabase.from("usage").select("created_at").eq("user_id", userId),
      supabase
        .from("generations")
        .select("created_at")
        .eq("user_id", userId)
        .eq("kind", "outline"),
      supabase
        .from("cards")
        .select("created_at, last_reviewed, last_grade, due_at")
        .eq("user_id", userId),
    ]);

    const activeSet = new Set<string>();
    const dailyCount = new Map<string, number>();
    const bump = (date?: string | null) => {
      if (!date) return;
      const d = ymd(new Date(date));
      activeSet.add(d);
      dailyCount.set(d, (dailyCount.get(d) || 0) + 1);
    };
    (usage as Row[] | null)?.forEach((r) => bump(r.created_at as string));
    (gens as Row[] | null)?.forEach((r) => bump(r.created_at as string));
    (cards as Row[] | null)?.forEach((r) => {
      bump(r.last_reviewed as string);
      bump(r.created_at as string);
    });

    // 连续打卡：从今天往前数连续活跃的天数（今天还没学则从容昨天起算）
    let streak = 0;
    let cursor = new Date();
    if (!activeSet.has(ymd(cursor))) cursor = new Date(Date.now() - 864e5);
    while (activeSet.has(ymd(cursor))) {
      streak++;
      cursor = new Date(cursor.getTime() - 864e5);
    }

    // 最近 14 天每日学习量
    const today = new Date();
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 864e5);
      const key = ymd(d);
      days.push({ date: key, count: dailyCount.get(key) || 0 });
    }

    // 记忆保持率序列（截至当天已复习卡片中 last_grade>=3 的累计占比）
    const reviewed = (cards as Row[] | null)?.filter(
      (c) => c.last_reviewed,
    ) as { last_reviewed: string; last_grade?: number }[];
    const retentionSeries: number[] = days.map(({ date }) => {
      const upto = reviewed?.filter(
        (c) => ymd(new Date(c.last_reviewed)) <= date,
      );
      if (!upto || upto.length === 0) return 0;
      const ok = upto.filter((c) => (c.last_grade ?? 0) >= 3).length;
      return Math.round((ok / upto.length) * 100);
    });

    const cardArr = (cards as Row[] | null) ?? [];
    const totalCards = cardArr.length;
    const dueCards = cardArr.filter(
      (c) => new Date(c.due_at as string) <= new Date(),
    ).length;
    const totalOutlines = (gens as Row[] | null)?.length ?? 0;
    const reviewedCards = reviewed?.length ?? 0;
    const masteredPct = reviewedCards
      ? Math.round(
          (reviewed!.filter((c) => (c.last_grade ?? 0) >= 3).length /
            reviewedCards) *
            100,
        )
      : 0;
    const daysActive = activeSet.size;

    return NextResponse.json({
      loggedIn: true,
      dbReady: true,
      streak,
      totalCards,
      dueCards,
      totalOutlines,
      reviewedCards,
      masteredPct,
      daysActive,
      daily: days,
      retentionSeries,
    });
  } catch (e) {
    return NextResponse.json(
      { loggedIn: true, dbReady: false, error: (e as Error).message },
      { status: 200 },
    );
  }
}
