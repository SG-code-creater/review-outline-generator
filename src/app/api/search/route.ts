import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

// 跨内容全局搜索：提纲(generations) / 卡片(cards) / 错题(mistakes)
// user_id 隔离；Supabase 的 ilike 用 * 作通配符（避免 % 的 URL 编码问题）

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  const q = raw.replace(/[%*]/g, "");
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "服务端数据库未配置。" }, { status: 500 });
  }

  const pat = `*${q}*`;

  const [g, c, m] = await Promise.all([
    supabase
      .from("generations")
      .select("id, title, input_text")
      .eq("user_id", userId)
      .eq("kind", "outline")
      .or(`title.ilike.${pat},input_text.ilike.${pat}`)
      .limit(10),
    supabase
      .from("cards")
      .select("id, question, answer, topic")
      .eq("user_id", userId)
      .or(`question.ilike.${pat},answer.ilike.${pat},topic.ilike.${pat}`)
      .limit(10),
    supabase
      .from("mistakes")
      .select("id, question, explanation")
      .eq("user_id", userId)
      .or(`question.ilike.${pat},explanation.ilike.${pat},evidence.ilike.${pat}`)
      .limit(10),
  ]);

  const results: Array<{
    type: "outline" | "card" | "mistake";
    id: string;
    title: string;
    snippet: string;
    mode: "review" | "mistakes";
  }> = [];

  if (g.data) {
    for (const r of g.data) {
      results.push({
        type: "outline",
        id: r.id,
        title: r.title || (r.input_text || "").slice(0, 40) || "未命名提纲",
        snippet: (r.input_text || "").slice(0, 90),
        mode: "review",
      });
    }
  }
  if (c.data) {
    for (const r of c.data) {
      results.push({
        type: "card",
        id: r.id,
        title: r.question,
        snippet: (r.answer || "").slice(0, 90),
        mode: "review",
      });
    }
  }
  if (m.data) {
    for (const r of m.data) {
      results.push({
        type: "mistake",
        id: r.id,
        title: r.question,
        snippet: (r.explanation || "").slice(0, 90),
        mode: "mistakes",
      });
    }
  }

  return NextResponse.json({ results });
}
