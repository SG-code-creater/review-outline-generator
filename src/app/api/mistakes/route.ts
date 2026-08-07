import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录后再收藏错题。" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const options = Array.isArray(body.options) ? body.options : [];
  const answer = typeof body.answer === "number" ? body.answer : -1;
  const sourceText =
    typeof body.source_text === "string" ? body.source_text : "";

  if (!question || options.length < 2 || answer < 0 || !sourceText.trim()) {
    return NextResponse.json(
      { error: "错题数据不完整（需 question / options / answer / source_text）。" },
      { status: 400 },
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "服务端数据库未配置。" }, { status: 500 });
  }

  const { error } = await supabase.from("mistakes").insert({
    user_id: userId,
    origin: "quiz",
    question,
    options,
    answer,
    picked: typeof body.picked === "number" ? body.picked : null,
    explanation: typeof body.explanation === "string" ? body.explanation : null,
    evidence: typeof body.evidence === "string" ? body.evidence : null,
    source_text: sourceText,
    source_title:
      typeof body.source_title === "string" ? body.source_title : null,
  });

  if (error) {
    return NextResponse.json(
      { error: `保存失败：${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const origin =
    typeof req.nextUrl.searchParams.get("origin") === "string"
      ? req.nextUrl.searchParams.get("origin")
      : null;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "服务端数据库未配置。" }, { status: 500 });
  }

  let query = supabase
    .from("mistakes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (origin && (origin === "quiz" || origin === "upload")) {
    query = query.eq("origin", origin);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `读取失败：${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ mistakes: data || [] });
}
