import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getUserIdFromReq } from "@/lib/auth";

// 最近打开的 PDF 文档（快速重开，仅本人可见）。零成本：落在用户账户，不建向量库。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECENT = 12;

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromReq(req);
  if (!userId) return NextResponse.json({ docs: [] });

  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ docs: [] });

  const { data, error } = await supabase
    .from("recent_docs")
    .select("id, file_name, char_count, created_at, text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_RECENT);

  if (error) return NextResponse.json({ error: "读取失败：" + error.message }, { status: 500 });
  return NextResponse.json({ docs: data || [] });
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

  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!fileName || !text) {
    return NextResponse.json({ error: "缺少 fileName 或 text。" }, { status: 400 });
  }

  // 同名文件冲突时更新内容与时间（重开即置顶），避免重复行。
  const { data, error } = await supabase
    .from("recent_docs")
    .upsert(
      {
        user_id: userId,
        file_name: fileName,
        text,
        char_count: text.length,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,file_name" }
    )
    .select("id, file_name, char_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: "保存失败：" + error.message }, { status: 500 });
  return NextResponse.json({ doc: data });
}
