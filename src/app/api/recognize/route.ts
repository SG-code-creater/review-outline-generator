import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";

// 试卷/习题图片识别路由：接收图片（base64 dataURL，可多张），调用小米 MiMo 视觉模型，
// 只还原印刷体原题、忽略手写/批改/涂改，返回纯文本。下游复用 /api/analyze-paper（DeepSeek）做诊断。
//
// 环境变量（与 DEEPSEEK_API_KEY 同位置配置到 EdgeOne）：
//   MIMO_API_KEY   —— 必填（Token Plan 格式 tp-xxxxx）
//   MIMO_BASE_URL  —— 默认 Token Plan 专属网关；若控制台显示别的地址请改这里
//   MIMO_MODEL     —— 默认 mimo-v2.5（视觉多模态）

const MIMO_BASE_URL =
  process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1";
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2.5";

const MAX_IMAGES = 8;
const MAX_IMG_LEN = 10 * 1024 * 1024; // base64 长度上限，约 < 7.5MB 原图

const SYSTEM_PROMPT =
  "你是试卷识别助手。用户会提供一张或多张学生试卷 / 练习题的照片，图片中可能包含潦草手写、红笔或蓝笔批改、涂改、订正，以及覆盖在原题上的笔迹。\n" +
  "请只识别其中的【印刷体原题】，严格遵守：\n" +
  "1）忽略所有手写字迹、红/蓝笔批改、涂改、订正和覆盖内容；\n" +
  "2）若原题被手写或涂改部分覆盖，请依据印刷体残留字形与周围上下文，尽量还原原题文字，不要照抄笔迹；\n" +
  "3）只输出还原后的原题纯文本，不要任何解释、不要你的评论、不要输出学生作答内容；\n" +
  "4）按题号或自然顺序分段，保留题干、选项（如 A/B/C/D）、公式与换行；\n" +
  "5）若图片中能清楚看到原题的标准答案，也一并保留，标注为「答案：…」；\n" +
  "6）若某处实在无法辨认，用「〔？〕」占位，不要编造。";

// 调用 MiMo 视觉接口。MiMo 官方文档两处写法不一致：
// 多模态图片接口示例用 `api-key` 头，OpenAI SDK 风格用 `Authorization: Bearer`。
// 为免用户线上测出 401 再手动改代码，这里自动兜底：先试 api-key，若返回 401 改用 Bearer 重试。
async function callMimo(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const endpoint = `${MIMO_BASE_URL}/chat/completions`;
  const tryWith = (header: string, value: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", [header]: value },
      body: JSON.stringify(body),
    });

  const r1 = await tryWith("api-key", apiKey);
  if (r1.status !== 401) return r1; // 非 401 直接返回（含成功与其他错误）

  // 鉴权头不匹配（401）时才回退到 Authorization: Bearer
  try {
    const r2 = await tryWith("Authorization", `Bearer ${apiKey}`);
    return r2;
  } catch {
    return r1; // 回退请求本身出错，保留原始 401 响应
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 MIMO_API_KEY（请在环境变量中配置）。" },
      { status: 500 },
    );
  }

  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录后再使用图片识别。" }, { status: 401 });
  }

  let images: string[] = [];
  try {
    const body = await req.json();
    const imgs = body?.images;
    if (Array.isArray(imgs)) {
      images = imgs
        .filter((x): x is string => typeof x === "string" && x.startsWith("data:"))
        .slice(0, MAX_IMAGES);
    } else if (typeof body?.image === "string" && body.image.startsWith("data:")) {
      images = [body.image];
    }
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  if (images.length === 0) {
    return NextResponse.json({ error: "未收到有效图片。" }, { status: 400 });
  }

  const tooBig = images.find((img) => img.length > MAX_IMG_LEN);
  if (tooBig) {
    return NextResponse.json(
      { error: "存在过大的图片，请压缩后重试（单图建议 < 4MB）。" },
      { status: 413 },
    );
  }

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: "请按系统要求识别这张试卷照片中的原题。" },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  try {
    const resp = await callMimo(apiKey, {
      model: MIMO_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      temperature: 0.2,
      max_tokens: 8000,
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: `识别服务调用失败（${resp.status}）：${detail.slice(0, 220)}` },
        { status: 502 },
      );
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) {
      return NextResponse.json(
        { error: "识别结果为空，请换一张更清晰、少遮挡的图再试。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, text: raw });
  } catch {
    return NextResponse.json(
      { error: "调用识别服务时出错，请稍后重试。" },
      { status: 502 },
    );
  }
}
