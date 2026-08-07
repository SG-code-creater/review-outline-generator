import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { scenarioGuidance } from "@/lib/scenarios";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

// 限次（复用 quiz 同一套）
const DAILY_LIMIT_ANON = 5;
const DAILY_LIMIT_USER = 20;
const WINDOW_HOURS = 24;

// 上传错题专用 prompt：从试卷/错题图片文本中识别题目
const SYSTEM_PROMPT =
  "你是一个错题整理助手。用户上传了一份试卷、作业或错题记录的文本。" +
  "你的任务是从中**识别出所有题目**，每道题整理为单项选择题格式。" +
  "要求：" +
  "1）提取每道题的题干和选项（若原题不是选择题，请根据题意构造 4 个合理选项 A/B/C/D）；" +
  "2）给出正确答案；" +
  "3）附一句简短解析；" +
  "4）evidence 字段：从原文中**原样摘录**一句与该题相关的原文（用于溯源）；" +
  "5）用中文；只输出 JSON 数组，不要围栏或额外说明：" +
  '[{"question":"题干","options":["A","B","C","D"],"answer":0,"explanation":"解析","evidence":"原文依据"}]。';

interface MistakeItem {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  evidence?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 DEEPSEEK_API_KEY。" },
      { status: 500 },
    );
  }

  // 鉴权
  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录后再上传错题。" }, { status: 401 });
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

  // 限次检查
  const rl = await checkRateLimit(userId, "user_id", DAILY_LIMIT_USER);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `今日上传次数已用完（${DAILY_LIMIT_USER} 次/天）。明日可继续使用。`,
        code: "RATE_LIMIT",
      },
      { status: 429 },
    );
  }

  try {
    // 调用 DeepSeek 从文本中识别题目
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
              "\n尽可能多地识别出文本中的题目。",
          },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 3200,
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
    const items = parseMistakes(raw);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "未能从文本中识别出有效题目，请确认内容清晰或换一份再试。" },
        { status: 502 },
      );
    }

    // 批量写入 mistakes 表（origin='upload'）
    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "服务端数据库未配置。" }, { status: 500 });
    }

    const rows = items.map((item) => ({
      user_id: userId,
      origin: "upload",
      question: item.question,
      options: item.options,
      answer: item.answer,
      picked: null,
      explanation: item.explanation || null,
      evidence: item.evidence || null,
      source_text: text,
      source_title:
        scenario && scenario !== "通用"
          ? `${scenario} - 上传错题`
          : text.slice(0, 50) + (text.length > 50 ? "…" : ""),
    }));

    const { error } = await supabase.from("mistakes").insert(rows);

    if (error) {
      return NextResponse.json(
        { error: `保存失败：${error.message}` },
        { status: 500 },
      );
    }

    // 记录使用量（异步，不阻塞）
    void recordUsage(text.length, null, userId);

    return NextResponse.json({
      ok: true,
      count: rows.length,
      mistakes: rows.map((r, i) => ({
        id: "", // insert 不返回 id，前端 reload 即可
        ...r,
        ...items[i],
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "处理上传错题时出错，请稍后重试。" },
      { status: 502 },
    );
  }
}

// ─── 解析（与 quiz 路由同模式） ───

function parseMistakes(raw: string): MistakeItem[] {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return normalize(parsed);
    if (Array.isArray(parsed?.mistakes)) return normalize(parsed.mistakes);
  } catch {
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

function normalize(arr: unknown[]): MistakeItem[] {
  return arr
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
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
        evidence: it.evidence ? String(it.evidence) : undefined,
      };
    })
    .filter((q) => q.question && q.options.length >= 2);
}

// ─── 限次 / 使用量记录（复用 quiz 模式） ───

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
  _ip: string | null,
  userId: string | null,
) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return;
    await supabase.from("usage").insert({
      model: "deepseek-chat",
      input_chars: inputChars,
      ip: null,
      user_id: userId ?? null,
    });
  } catch (e) {
    console.error("[usage] 写入失败（已忽略）:", (e as Error).message);
  }
}
