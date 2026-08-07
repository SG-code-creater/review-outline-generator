import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 今日任务：登录用户跨设备同步（未登录返回 401，前端回退本地）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const date = new URL(req.url).searchParams.get("date") || todayStr();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  let date: string | undefined;
  let text: string | undefined;
  try {
    const body = await req.json();
    date = body?.date ? String(body.date) : undefined;
    text = body?.text ? String(body.text).trim() : undefined;
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "任务内容不能为空。" }, { status: 400 });

  // 保证 profiles 行存在
  await supabase.from("profiles").upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });

  const { count } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("date", date || todayStr());
  const position = (count ?? 0);

  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, date: date || todayStr(), text, done: false, position })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "保存失败：" + error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  let id: string | undefined;
  let done: boolean | undefined;
  let text: string | undefined;
  try {
    const body = await req.json();
    id = body?.id;
    done = typeof body?.done === "boolean" ? body.done : undefined;
    text = typeof body?.text === "string" ? body.text.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }
  if (!id || (done == null && text == null))
    return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const patch: { done?: boolean; text?: string } = {};
  if (done != null) patch.done = done;
  if (text != null) patch.text = text;

  const { error } = await supabase
    .from("tasks")
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
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "删除失败：" + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
