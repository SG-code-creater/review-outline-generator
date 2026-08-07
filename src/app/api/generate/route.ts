import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@clerk/nextjs/server";
import { getServerSupabase } from "@/lib/supabase";
import { scenarioGuidance } from "@/lib/scenarios";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 匿名用户每日免费生成次数上限
const DAILY_LIMIT_ANON = 5;
// 登录用户每日上限（更高，鼓励注册）
const DAILY_LIMIT_USER = 20;
// 滚动窗口（小时）：按最近 24 小时计数，避免跨零点清零的体验问题
const WINDOW_HOURS = 24;

const SYSTEM_PROMPT =
  "你是一个复习提纲生成助手。请把用户提供的课件或笔记文本，整理成结构清晰、层级分明的 Markdown 复习提纲。" +
  "要求：1）用 # / ## / ### 表示章节与知识点的层级；2）保留关键术语、定义、公式与易错点；" +
  "3）省略冗余铺垫与无关内容；4）用中文输出；5）不要编造原文没有的事实。";

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "服务端未配置 DEEPSEEK_API_KEY，请在项目根目录的 .env.local 中填入你的 DeepSeek API Key。",
      },
      { status: 500 },
    );
  }

  let text = "";
  let scenario: string | undefined;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
    scenario = typeof body?.scenario === "string" ? body.scenario : undefined;
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "文本不能为空。" }, { status: 400 });
  }

  // 身份识别：Clerk 登录用户拿 userId（手动校验 cookie，避免 EdgeOne proxy 运行时与 clerkMiddleware 不兼容），否则按 IP 限次
  const userId = await getUserId(req);
  const ip = getClientIp(req);

  if (userId) {
    const rl = await checkRateLimit(userId, "user_id", DAILY_LIMIT_USER);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: `今日生成次数已用完（会员 ${DAILY_LIMIT_USER} 次/天）。明日可继续使用。`,
          code: "RATE_LIMIT",
          remaining: 0,
        },
        { status: 429 },
      );
    }
  } else if (ip) {
    const rl = await checkRateLimit(ip, "ip", DAILY_LIMIT_ANON);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: `今日免费次数已用完（${DAILY_LIMIT_ANON} 次/天）。登录可提升到 ${DAILY_LIMIT_USER} 次/天。`,
          code: "RATE_LIMIT",
          remaining: 0,
        },
        { status: 429 },
      );
    }
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
          { role: "system", content: SYSTEM_PROMPT + scenarioGuidance(scenario) },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 2000,
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
    const outline =
      data?.choices?.[0]?.message?.content?.trim() || "";

    // 优雅降级：记录使用量，失败不影响主流程返回
    void recordUsage(text.length, ip, userId);

    return NextResponse.json({ outline });
  } catch {
    return NextResponse.json(
      { error: "调用 DeepSeek 时出错，请检查网络或 API Key 是否正确。" },
      { status: 502 },
    );
  }
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

// 手动校验 Clerk 登录态：读 __session cookie（或 Authorization Bearer），verifyToken 验 JWT
// 不依赖 clerkMiddleware，规避 EdgeOne proxy 运行时对 RequestInit.eo 字段的校验报错
async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const cookieToken =
      req.cookies.get("__session")?.value ||
      req.cookies.get("__clerk_session")?.value;
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const token = cookieToken || bearer;
    if (!token) return null;
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return (claims.sub as string) ?? null;
  } catch {
    return null;
  }
}

async function checkRateLimit(
  identifier: string,
  column: "ip" | "user_id",
  limit: number,
): Promise<{ ok: boolean; count: number }> {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return { ok: true, count: 0 }; // 无 DB 时降级放行
    const since = new Date(
      Date.now() - WINDOW_HOURS * 3600 * 1000,
    ).toISOString();
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
  } catch (e) {
    console.error("[usage] 写入失败（已忽略）:", (e as Error).message);
  }
}
