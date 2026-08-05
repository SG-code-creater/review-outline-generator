import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

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
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "文本不能为空。" }, { status: 400 });
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
    void recordUsage(text.length);

    return NextResponse.json({ outline });
  } catch {
    return NextResponse.json(
      { error: "调用 DeepSeek 时出错，请检查网络或 API Key 是否正确。" },
      { status: 502 },
    );
  }
}

async function recordUsage(inputChars: number) {
  try {
    const supabase = getServerSupabase();
    if (!supabase) return;
    await supabase.from("usage").insert({
      model: "deepseek-chat",
      input_chars: inputChars,
    });
  } catch (e) {
    console.error("[usage] 写入失败（已忽略）:", (e as Error).message);
  }
}
