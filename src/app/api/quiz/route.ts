import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@clerk/nextjs/server";
import { getServerSupabase } from "@/lib/supabase";
import { scenarioGuidance } from "@/lib/scenarios";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 匿名用户每日免费生成次数上限
const DAILY_LIMIT_ANON = 5;
// 登录用户每日上限（更高，鼓励注册）
const DAILY_LIMIT_USER = 20;
// 滚动窗口（小时）
const WINDOW_HOURS = 24;

const SYSTEM_PROMPT =
  "你是一个出题助手，帮助学生通过主动回忆（active recall）巩固知识。" +
  "根据用户提供的学习资料，生成若干道单项选择题（每题 4 个选项 A/B/C/D）。" +
  "要求：1）题目考查资料中的关键概念、定义、逻辑与易错点，不要出无关或资料外的内容；" +
  "2）只有一个正确选项，其余为合理干扰项；3）每题附一句简短解析说明为什么正确；" +
  "4）用中文；5）只输出如下 JSON 数组，不要任何额外说明或代码围栏：" +
  '[{"question":"题干","options":["A","B","C","D"],"answer":0,"explanation":"解析"}]。';

interface QuizItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

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
  let count = 5;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
    scenario = typeof body?.scenario === "string" ? body.scenario : undefined;
    if (typeof body?.count === "number") {
      count = Math.min(Math.max(Math.floor(body.count), 1), 12);
    }
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "文本不能为空。" }, { status: 400 });
  }

  // 身份识别 + 限次（与 /api/generate 一致）
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
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              scenarioGuidance(scenario) +
              `\n请生成 ${count} 道题。`,
          },
          { role: "user", content: text },
        ],
        temperature: 0.5,
        max_tokens: 2400,
        response_format: { type: "json_object" },
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
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";

    // 解析：支持直接 JSON、或包裹在 ```json 代码围栏中
    const quiz = parseQuiz(raw);

    if (!quiz || quiz.length === 0) {
      return NextResponse.json(
        { error: "模型未返回有效题目，请重试或更换资料。" },
        { status: 502 },
      );
    }

    // 优雅降级：记录使用量，失败不影响主流程返回
    void recordUsage(text.length, ip, userId);

    return NextResponse.json({ quiz });
  } catch {
    return NextResponse.json(
      { error: "调用 DeepSeek 时出错，请检查网络或 API Key 是否正确。" },
      { status: 502 },
    );
  }
}

function parseQuiz(raw: string): QuizItem[] {
  let s = raw.trim();
  // 去掉可能的 ```json ... ``` 围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // 兼容：有时模型返回 { "quiz": [...] }
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return normalize(parsed);
    if (Array.isArray(parsed?.quiz)) return normalize(parsed.quiz);
  } catch {
    // 尝试提取第一个 [ ... ] 数组
    const arr = s.match(/\[[\s\S]*\]/);
    if (arr) {
      try {
        return normalize(JSON.parse(arr[0]));
      } catch {
        return [];
      }
    }
  }
  return [];
}

function normalize(arr: unknown[]): QuizItem[] {
  return arr
    .filter(
      (it): it is Record<string, unknown> =>
        !!it && typeof it === "object",
    )
    .map((it) => {
      const options = Array.isArray(it.options)
        ? (it.options as unknown[]).map((o) => String(o))
        : [];
      let answer = typeof it.answer === "number" ? it.answer : 0;
      if (answer < 0 || answer >= options.length) answer = 0;
      return {
        question: String(it.question ?? ""),
        options,
        answer,
        explanation: String(it.explanation ?? ""),
      };
    })
    .filter((q) => q.question && q.options.length >= 2);
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip") || null;
}

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
    if (!supabase) return { ok: true, count: 0 };
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
