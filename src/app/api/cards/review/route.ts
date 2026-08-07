import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 间隔重复（SM-2）复习反馈：quality 0~5
//   忘记(1) / 模糊(3) / 记得(5)
// 算法：q<3 → 重置（间隔 1 天，重复计数归零）；
//       否则按 SM-2 递推间隔与难度系数，并更新下次到期时间。
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  let id: string | undefined;
  let quality: number | undefined;
  try {
    const body = await req.json();
    id = body?.id;
    quality = typeof body?.quality === "number" ? body.quality : undefined;
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!id || quality == null)
    return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const q = Math.max(0, Math.min(5, Math.round(quality)));

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const { data: card, error: fetchErr } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !card) {
    return NextResponse.json({ error: "卡片不存在。" }, { status: 404 });
  }

  let { interval_days, ease_factor, repetitions } = card as {
    interval_days: number;
    ease_factor: number;
    repetitions: number;
  };

  if (q < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  // SM-2 难度系数更新
  ease_factor =
    ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const due_at = new Date(
    Date.now() + interval_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: updErr } = await supabase
    .from("cards")
    .update({
      interval_days,
      ease_factor,
      repetitions,
      due_at,
      last_grade: q,
      last_reviewed: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (updErr) {
    return NextResponse.json({ error: "更新失败：" + updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, interval_days, due_at });
}
