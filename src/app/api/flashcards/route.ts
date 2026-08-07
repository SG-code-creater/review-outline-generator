import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@clerk/nextjs/server";
import { getServerSupabase } from "@/lib/supabase";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 限次配置（与 /api/generate 共享同一张 usage 表，合计限额）
const DAILY_LIMIT_ANON = 5;
const DAILY_LIMIT_USER = 20;
const WINDOW_HOURS = 24;

const SYSTEM_PROMPT =
  "你是一个知识点卡片生成助手。请把用户提供的课件或笔记文本，拆解成一组问答记忆卡（Flashcards）。" +
  "要求：\n" +
  "1）每张卡片包含三个字段：question（问题）、answer（答案）、topic（所属知识点/章节，2-6个字）；\n" +
  "2）问题要具体、有针对性（不是泛泛的\"什么是X\"），答案要简洁准确、适合背诵；\n" +
  "3）生成 6-12 张卡片，覆盖文本中的核心概念、定义、公式和易错点；\n" +
  "4）用中文输出；不要编造原文没有的事实。\n" +
  "5）严格返回 JSON 数组格式，不要加 markdown 代码块标记或其他文字。格式示例：\n" +
  '[{"question":"...","answer":"...","topic":"..."}]';

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
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "文本不能为空。" }, { status: 400 });
  }

  // 身份识别 + 限次（与 generate 共享同一套逻辑）
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 3000,
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
    const raw =
      data?.choices?.[0]?.message?.content?.trim() || "";

    // 解析 DeepSeek 返回的 JSON 数组
    let cards: Array<{ question: string; answer: string; topic: string }> = [];
    try {
      // 去掉可能的 markdown 代码块标记
      const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        cards = parsed
          .filter(
            (c) =>
              c &&
              typeof c.question === "string" &&
              typeof c.answer === "string",
          )
          .map((c) => ({
            question: c.question.trim(),
            answer: c.answer.trim(),
            topic: String(c.topic || "综合").trim(),
          }));
      }
    } catch {
      // JSON 解析失败时降级：返回原始文本作为单张"大卡片"
      cards = [{ question: "知识点整理", answer: raw, topic: "综合" }];
    }

    if (cards.length === 0) {
      cards = [{ question: "知识点整理", answer: raw, topic: "综合" }];
    }

    // 记录使用量
    void recordUsage(text.length, ip, userId, "flashcards");

    return NextResponse.json({ cards, count: cards.length });
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
  feature: string,
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
