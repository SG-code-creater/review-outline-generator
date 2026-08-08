import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { scenarioGuidance } from "@/lib/scenarios";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const DAILY_LIMIT_USER = 20;
const WINDOW_HOURS = 24;

const SYSTEM_PROMPT =
  "你是一个试卷分析助手。用户上传了一份试卷或练习的文本（可能包含题目、选项、正确答案或学生作答）。\n" +
  "请完成两件事：\n" +
  "一、识别所有题目，整理为单项选择题格式：\n" +
  "  - question：题干\n" +
  "  - options：长度为 4 的字符串数组（A/B/C/D 四个选项）\n" +
  "  - answer：正确选项的下标（0-3）\n" +
  "  - explanation：一句话解析（说明为什么选这个答案）\n" +
  "  - evidence：从原文中**原样摘录**一句与本题相关的原文（用于溯源，若原文无则留空字符串）\n" +
  "  - knowledgePoint：本题所属考点/知识点（简短，如「函数单调性」「牛顿第二定律」「文言实词」）\n" +
  "  - difficulty：难度，1=易 2=中 3=难\n" +
  "二、薄弱点分析 analysis：\n" +
  "  - summary：一句话总体评价（如「整体掌握较好，但函数与几何部分薄弱」）\n" +
  "  - weakPoints：数组，每项 { point: 考点名, count: 涉及题数, advice: 针对性复习建议 }\n" +
  "要求：\n" +
  "1）用中文；\n" +
  "2）只输出 JSON 对象，不要任何围栏（```）或额外说明；\n" +
  '{"questions":[{"question":"题干","options":["A","B","C","D"],"answer":0,"explanation":"解析","evidence":"原文依据","knowledgePoint":"考点","difficulty":2}],"analysis":{"summary":"总体评价","weakPoints":[{"point":"考点名","count":1,"advice":"建议"}]}}';

interface PaperQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  evidence?: string;
  knowledgePoint?: string;
  difficulty?: number;
}

interface PaperAnalysis {
  summary: string;
  weakPoints: Array<{ point: string; count: number; advice: string }>;
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
    return NextResponse.json({ error: "请先登录后再使用试卷分析。" }, { status: 401 });
  }

  // 限次（与 mistakes/upload 同一套）
  const rl = await checkRateLimit(userId);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `今日分析次数已用完（${DAILY_LIMIT_USER} 次/天）。明日可继续使用。`,
        code: "RATE_LIMIT",
      },
      { status: 429 },
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
    return NextResponse.json({ error: "试卷文本不能为空。" }, { status: 400 });
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
            content: SYSTEM_PROMPT + (scenario ? scenarioGuidance(scenario) : ""),
          },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 8000,
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
    const parsed = parsePaper(raw);

    if (!parsed || parsed.questions.length === 0) {
      return NextResponse.json(
        { error: "未能从文本中识别出有效题目，请确认内容清晰或换一份再试。" },
        { status: 502 },
      );
    }

    // 记录使用量（异步，不阻塞）
    void recordUsage(text.length, userId);

    return NextResponse.json({
      ok: true,
      questions: parsed.questions,
      analysis: parsed.analysis,
    });
  } catch {
    return NextResponse.json(
      { error: "分析试卷时出错，请稍后重试。" },
      { status: 502 },
    );
  }
}

// ─── 解析 ───

function parsePaper(raw: string): {
  questions: PaperQuestion[];
  analysis: PaperAnalysis;
} | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(s);
  } catch {
    const objMatch = s.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        obj = JSON.parse(objMatch[0]);
      } catch {
        obj = null;
      }
    }
  }
  if (!obj) return null;

  const questions = Array.isArray(obj.questions)
    ? normalizeQuestions(obj.questions)
    : [];

  const analysisRaw = (obj.analysis ?? {}) as Record<string, unknown>;
  const analysis: PaperAnalysis = {
    summary:
      typeof analysisRaw.summary === "string"
        ? analysisRaw.summary
        : "已完成分析。",
    weakPoints: Array.isArray(analysisRaw.weakPoints)
      ? (analysisRaw.weakPoints as unknown[])
          .filter(
            (it): it is Record<string, unknown> =>
              !!it && typeof it === "object",
          )
          .map((it) => ({
            point: String(it.point ?? "未命名考点"),
            count:
              typeof it.count === "number"
                ? it.count
                : questions.filter(
                    (q) => q.knowledgePoint === String(it.point ?? ""),
                  ).length || 1,
            advice: String(it.advice ?? "建议结合错题反复练习。"),
          }))
      : [],
  };

  return { questions, analysis };
}

function normalizeQuestions(arr: unknown[]): PaperQuestion[] {
  return arr
    .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
    .map((it) => {
      const options = Array.isArray(it.options)
        ? (it.options as unknown[]).map((o) => String(o))
        : [];
      let answer = typeof it.answer === "number" ? it.answer : 0;
      if (answer < 0 || answer >= options.length) answer = 0;
      const difficulty =
        typeof it.difficulty === "number"
          ? Math.min(3, Math.max(1, Math.round(it.difficulty)))
          : 2;
      return {
        question: String(it.question ?? ""),
        options,
        answer,
        explanation: String(it.explanation ?? ""),
        evidence: it.evidence ? String(it.evidence) : undefined,
        knowledgePoint: it.knowledgePoint ? String(it.knowledgePoint) : undefined,
        difficulty,
      };
    })
    .filter((q) => q.question && q.options.length >= 2);
}

// ─── 限次 / 使用量记录（与 mistakes/upload 同模式） ───

async function checkRateLimit(
  userId: string,
): Promise<{ ok: boolean; count: number }> {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return { ok: true, count: 0 };
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { count, error } = await supabase
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) return { ok: true, count: 0 };
    const c = count ?? 0;
    return { ok: c < DAILY_LIMIT_USER, count: c };
  } catch {
    return { ok: true, count: 0 };
  }
}

async function recordUsage(inputChars: number, userId: string) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return;
    await supabase.from("usage").insert({
      model: "deepseek-chat",
      input_chars: inputChars,
      ip: null,
      user_id: userId,
    });
  } catch (e) {
    console.error("[usage] 写入失败（已忽略）:", (e as Error).message);
  }
}
