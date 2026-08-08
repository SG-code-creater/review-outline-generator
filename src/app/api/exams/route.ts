import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 考试倒计时：多考试管理（增删改查），数据落在 exams 表，仅本人可见。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLORS = ["teal", "purple", "emerald", "coral", "amber", "blue"];

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("user_id", userId)
    .order("exam_at", { ascending: true });

  if (error) return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  return NextResponse.json({ exams: data || [] });
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const examAt = typeof body?.exam_at === "string" ? body.exam_at : "";
  const subject = typeof body?.subject === "string" ? body.subject.trim() : null;
  const note = typeof body?.note === "string" ? body.note.trim() : null;
  const colorRaw = typeof body?.color === "string" ? body.color : "teal";
  const color = COLORS.includes(colorRaw) ? colorRaw : "teal";

  if (!title) return NextResponse.json({ error: "考试名称不能为空。" }, { status: 400 });
  if (!examAt || isNaN(Date.parse(examAt)))
    return NextResponse.json({ error: "请填写有效的考试日期时间。" }, { status: 400 });

  // 保证 profiles 行存在（user_id 为外键）
  await supabase
    .from("profiles")
    .upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });

  const { data, error } = await supabase
    .from("exams")
    .insert({
      user_id: userId,
      title,
      exam_at: new Date(examAt).toISOString(),
      subject: subject || null,
      color,
      note: note || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "保存失败：" + error.message }, { status: 500 });
  return NextResponse.json({ exam: data });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const id = body?.id;
  if (!id) return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "考试名称不能为空。" }, { status: 400 });
    patch.title = t;
  }
  if (typeof body?.exam_at === "string" && body.exam_at) {
    if (isNaN(Date.parse(body.exam_at)))
      return NextResponse.json({ error: "考试日期时间无效。" }, { status: 400 });
    patch.exam_at = new Date(body.exam_at).toISOString();
  }
  if (typeof body?.subject === "string") patch.subject = body.subject.trim() || null;
  if (typeof body?.note === "string") patch.note = body.note.trim() || null;
  if (typeof body?.color === "string" && COLORS.includes(body.color)) patch.color = body.color;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "没有可更新的字段。" }, { status: 400 });

  const { error } = await supabase
    .from("exams")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "更新失败：" + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const { error } = await supabase
    .from("exams")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "删除失败：" + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
