import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";
import { WORD_BOOKS, getWordBook } from "@/lib/wordbooks";

// 单词背诵：内置词书 / 自定义词表导入（复用 cards 表 + SM-2），以及取待背/全部词卡。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 把一条词转换成 cards 表行（topic 用于区分词书，tags 含 'vocab' 便于筛选）
function toRows(
  topic: string,
  tag: string,
  entries: Array<{ question: string; answer: string }>,
) {
  return entries.map((e) => ({
    topic,
    tags: ["vocab", tag],
    question: e.question.trim(),
    answer: e.answer.trim(),
    due_at: new Date().toISOString(),
  }));
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录后加入背诵。" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  // 保证 profiles 行存在（user_id 为外键）
  await supabase
    .from("profiles")
    .upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });

  let rows: ReturnType<typeof toRows> = [];
  let topic = "";
  let tag = "";

  if (typeof body?.book === "string") {
    const book = getWordBook(body.book);
    if (!book)
      return NextResponse.json({ error: "未知词书。" }, { status: 400 });
    topic = book.name;
    tag = book.key;
    rows = toRows(
      book.name,
      book.key,
      book.words.map((w) => ({
        question: w.word,
        answer: w.example ? `${w.meaning}\n例句：${w.example}` : w.meaning,
      })),
    );
  } else if (Array.isArray(body?.words)) {
    topic = "我的词表";
    tag = "custom";
    rows = toRows(
      topic,
      tag,
      body.words
        .filter((x: any) => x && x.word && x.meaning)
        .map((x: any) => ({ question: String(x.word), answer: String(x.meaning) })),
    );
  } else {
    return NextResponse.json({ error: "缺少参数。" }, { status: 400 });
  }

  if (rows.length === 0)
    return NextResponse.json({ error: "没有可导入的单词。" }, { status: 400 });

  // 去重：同一词书(topic)内已存在的单词不重复插入
  const { data: existing } = await supabase
    .from("cards")
    .select("question")
    .eq("user_id", userId)
    .eq("topic", topic);
  const existSet = new Set((existing || []).map((r: any) => r.question));
  const fresh = rows.filter((r) => !existSet.has(r.question));

  if (fresh.length === 0) {
    return NextResponse.json({ imported: 0, total: rows.length, exist: true });
  }

  const { error } = await supabase.from("cards").insert(fresh);
  if (error) {
    console.error("[vocab] 导入失败:", error.message);
    return NextResponse.json({ error: "导入失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: fresh.length, total: rows.length, exist: false });
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const params = new URL(req.url).searchParams;
  const mode = params.get("mode"); // due | all
  const now = new Date().toISOString();

  let query = supabase
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .contains("tags", ["vocab"]);

  if (mode === "due") {
    query = query.lte("due_at", now).order("due_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false }).limit(500);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[vocab] 读取失败:", error.message);
    return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ cards: data || [] });
}
