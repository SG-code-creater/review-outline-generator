import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 保存 / 读取用户收藏的提纲（kind='outline'，支撑"我的提纲"）
export async function POST(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录后保存提纲。" }, { status: 401 });

  let title: string | undefined;
  let input_text = "";
  let result: unknown = null;
  let tags: string[] = [];
  try {
    const body = await req.json();
    title = body?.title ? String(body.title).trim() : undefined;
    input_text = typeof body?.input_text === "string" ? body.input_text : "";
    result = body?.result ?? null;
    tags = Array.isArray(body?.tags) ? body.tags.map(String) : [];
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!result)
    return NextResponse.json({ error: "没有可保存的提纲内容。" }, { status: 400 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  // 保证 profiles 行存在（user_id 为外键）
  await supabase
    .from("profiles")
    .upsert({ user_id: userId, plan: "free" }, { onConflict: "user_id" });

  const { data, error } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      kind: "outline",
      title: title || "未命名提纲",
      input_text,
      result,
      tags,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[generations] 保存失败:", error.message);
    return NextResponse.json({ error: "保存失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, id: data?.id });
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const tag = new URL(req.url).searchParams.get("tag");

  let query = supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "outline")
    .order("created_at", { ascending: false })
    .limit(200);

  if (tag) query = query.contains("tags", [tag]);

  const { data, error } = await query;
  if (error) {
    console.error("[generations] 读取失败:", error.message);
    return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ outlines: data || [] });
}

// 更新提纲标签 / 标题
export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  let id: string | undefined;
  let title: string | undefined;
  let tags: string[] | undefined;
  try {
    const body = await req.json();
    id = body?.id;
    title = body?.title ? String(body.title).trim() : undefined;
    tags = Array.isArray(body?.tags) ? body.tags.map(String) : undefined;
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!id) return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const patch: { title?: string; tags?: string[] } = {};
  if (title) patch.title = title;
  if (tags != null) patch.tags = tags;

  const { error } = await supabase
    .from("generations")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "更新失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// 删除提纲
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少参数。" }, { status: 400 });

  const supabase = getServerSupabase();
  if (!supabase)
    return NextResponse.json({ error: "数据库未配置。" }, { status: 500 });

  const { error } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "删除失败：" + error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
