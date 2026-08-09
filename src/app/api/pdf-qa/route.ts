import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 与 /api/generate 一致的限流口径
const DAILY_LIMIT_ANON = 5;
const DAILY_LIMIT_USER = 20;
const WINDOW_HOURS = 24;

const SYSTEM_PROMPT =
  "你是一个基于教材/课件原文作答的学习问答助手。用户会提供若干段原文片段（已用 [1]、[2]… 标注序号）和一个问题。请严格遵循：\n" +
  "1）答案必须来自所给片段，禁止编造原文没有的事实；\n" +
  "2）在支撑句后标注出处编号，如「……[1]」「……[2]」；\n" +
  "3）若所给片段信息不足以回答问题，明确说明「根据提供的材料无法回答」，不要猜测；\n" +
  "4）用中文、条理清晰地作答，必要时分点。";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 DEEPSEEK_API_KEY。" },
      { status: 500 },
    );
  }

  let question = "";
  let context = "";
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question : "";
    context = typeof body?.context === "string" ? body.context : "";
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!question.trim()) {
    return NextResponse.json({ error: "问题不能为空。" }, { status: 400 });
  }
  if (!context.trim()) {
    return NextResponse.json(
      { error: "缺少原文内容，请先上传 PDF 或粘贴文本。" },
      { status: 400 },
    );
  }

  // 限流（匿名按 IP，登录按 userId）
  const userId = await getUserIdFromReq(req);
  const ip = getClientIp(req);
  const limit = userId ? DAILY_LIMIT_USER : DAILY_LIMIT_ANON;
  const rl = await checkRateLimit(userId ?? ip ?? "anon", userId ? "user_id" : "ip", limit);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: userId
          ? `今日问答次数已用完（${DAILY_LIMIT_USER} 次/天）。`
          : `今日免费问答已用完（${DAILY_LIMIT_ANON} 次/天）。登录可提升到 ${DAILY_LIMIT_USER} 次/天。`,
        code: "RATE_LIMIT",
      },
      { status: 429 },
    );
  }

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              `[原文片段]\n${context}\n\n[问题]\n${question.trim()}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: `DeepSeek 调用失败（${resp.status}）：${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content?.trim() || "";

    void recordUsage(context.length + question.length, ip, userId);

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { error: "调用 DeepSeek 时出错，请检查网络或 API Key。" },
      { status: 502 },
    );
  }
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

async function checkRateLimit(
  identifier: string,
  column: "ip" | "user_id",
  limit: number,
): Promise<{ ok: boolean; count: number }> {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return { ok: true, count: 0 };
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { count, error } = await supabase
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq(column, identifier)
      .gte("created_at", since);
    if (error) return { ok: true, count: 0 };
    const c = count ?? 0;
    return { ok: c < limit, count: c };
  } catch {
    return { ok: true, count: 0 };
  }
}

async function recordUsage(
  inputChars: number,
  ip: string | null,
  userId: string | null,
) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return;
    await supabase.from("usage").insert({
      model: "deepseek-chat",
      input_chars: inputChars,
      ip: ip ?? null,
      user_id: userId ?? null,
    });
  } catch {
    // 忽略用量写入失败
  }
}
