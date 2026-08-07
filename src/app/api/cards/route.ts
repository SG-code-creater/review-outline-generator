import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 保存 / 读取用户的知识点卡片（支撑"我的复习"与间隔重复）
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录后保存卡片。" }, { status: 401 });

  let cards: Array<{ question: string; answer: string; topic: string }> = [];
  try {
    const body = await req.json();
    cards = Array.isArray(body?.cards) ? body.cards : [];
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (cards.length === 0)
    return NextResponse.json({ error: "没有可保存的卡片。" }, { status: 400 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  // 保证 profiles 行存在（user_id 为外键）
  await supabase
    .from("profiles")
    .upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });

  const rows = cards
    .filter((c) => c && c.question && c.answer)
    .map((c) => ({
      user_id: userId,
      topic: String(c.topic || "综合").trim(),
      question: String(c.question).trim(),
      answer: String(c.answer).trim(),
      due_at: new Date().toISOString(),
    }));

  if (rows.length === 0)
    return NextResponse.json({ error: "卡片内容无效。" }, { status: 400 });

  const { error } = await supabase.from("cards").insert(rows);
  if (error) {
    console.error("[cards] 保存失败:", error.message);
    return NextResponse.json({ error: "保存失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length });
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const mode = new URL(req.url).searchParams.get("mode");
  const now = new Date().toISOString();

  let query = supabase.from("cards").select("*").eq("user_id", userId);
  if (mode === "due") {
    query = query.lte("due_at", now).order("due_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false }).limit(50);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[cards] 读取失败:", error.message);
    return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ cards: data || [] });
}
