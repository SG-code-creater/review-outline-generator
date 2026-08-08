import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";

// ── 试卷图片识别：异步模式 ──
//
// 同步调用 MiMo 视觉模型在 EdgeOne serverless 上必然超时（函数执行上限 30–120s，
// 而 MiMo 处理含手写/涂改的试卷图常需 30–90s）。
// 本路由采用「提交→轮询」异步模式：
//   ① POST  { images }          → 立即返回 { jobId }（<100ms）
//   ② GET   ?jobId=xxx&images=… → 新函数实例调 MiMo（全新超时预算），返回结果
//
// 环境变量：
//   MIMO_API_KEY   —— 必填（Token Plan 格式 tp-xxxxx）
//   MIMO_BASE_URL  —— 默认 https://token-plan-cn.xiaomimimo.com/v1
//   MIMO_MODEL     —— 默认 mimo-v2.5

const MIMO_BASE_URL =
  process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1";
const MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2.5";

const MAX_IMAGES = 8;
const MAX_IMG_LEN = 10 * 1024 * 1024;

const SYSTEM_PROMPT =
  "你是试卷识别助手。用户会提供一张或多张学生试卷 / 练习题的照片，图片中可能包含潦草手写、红笔或蓝笔批改、涂改、订正，以及覆盖在原题上的笔迹。\n" +
  "请只识别其中的【印刷体原题】，严格遵守：\n" +
  "1）忽略所有手写字迹、红/蓝笔批改、涂改、订正和覆盖内容；\n" +
  "2）若原题被手写或涂改部分覆盖，请依据印刷体残留字形与周围上下文，尽量还原原题文字，不要照抄笔迹；\n" +
  "3）只输出还原后的原题纯文本，不要任何解释、不要你的评论、不要输出学生作答内容；\n" +
  "4）按题号或自然顺序分段，保留题干、选项（如 A/B/C/D）、公式与换行；\n" +
  "5）若图片中能清楚看到原题的标准答案，也一并保留，标注为「答案：…」；\n" +
  "6）若某处实在无法辨认，用「〔？〕」占位，不要编造。";

// ── 鉴权：先试 api-key，401 自动换 Authorization: Bearer ──
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
  if (r1.status !== 401) return r1;

  try {
    return await tryWith("Authorization", `Bearer ${apiKey}`);
  } catch {
    return r1;
  }
}

// ── 从请求中提取并验证图片数组 ──
function extractImages(body: any): string[] | { error: string; status: number } {
  let images: string[] = [];
  const imgs = body?.images;
  if (Array.isArray(imgs)) {
    images = imgs
      .filter((x): x is string => typeof x === "string" && x.startsWith("data:"))
      .slice(0, MAX_IMAGES);
  } else if (typeof body?.image === "string" && body.image.startsWith("data:")) {
    images = [body.image];
  }
  if (images.length === 0)
    return { error: "未收到有效图片。", status: 400 };
  const tooBig = images.find((img) => img.length > MAX_IMG_LEN);
  if (tooBig)
    return { error: "存在过大的图片，请压缩后重试（单图建议 < 4MB）。", status: 413 };
  return images;
}

// ════════════════════════════════════════════
//  POST — 提交识别任务（立即返回 jobId）
// ════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "服务端未配置 MIMO_API_KEY。" }, { status: 500 },
    );
  }

  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  // 如果请求带 jobId → 这是轮询请求（通过 query string 传递）
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  if (jobId) {
    return handlePoll(req, apiKey, jobId);
  }

  // 否则：首次提交 — 验证图片 → 立即返回 jobId
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const images = extractImages(body);
  if (!Array.isArray(images)) return NextResponse.json(images, { status: images.status });

  const id = crypto.randomUUID();

  // 立即返回 jobId，让前端开始轮询（< 100ms，不可能超时）
  return NextResponse.json({
    ok: true,
    jobId: id,
    message: "任务已提交，正在识别中...",
  });
}

// ════════════════════════════════════════════
//  GET — 轮询识别结果（每次都是新函数实例，全新超时预算）
// ════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "服务端未配置 MIMO_API_KEY。" }, { status: 500 });
  }

  const userId = await getUserIdFromReq(req);
  if (!userId) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "缺少 jobId 参数。" }, { status: 400 });
  }

  // GET 轮询：从 query 取 base64 图片（URL-encoded）
  const imagesParam = url.searchParams.get("images");
  if (!imagesParam) {
    return NextResponse.json({
      status: "waiting",
      jobId,
      message: "等待客户端重新发送图片数据...",
    });
  }

  let images: string[];
  try {
    images = JSON.parse(decodeURIComponent(imagesParam));
    if (!Array.isArray(images)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "图片参数格式错误。" }, { status: 400 });
  }

  return doRecognize(apiKey, images, jobId);
}

// ════════════════════════════════════════════
//  轮询处理：调用 MiMo 并返回结果
//  （每次轮询都是新函数实例，有完整的 maxDuration 超时预算）
// ════════════════════════════════════════════
async function handlePoll(req: NextRequest, apiKey: string, jobId: string) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }

  const images = extractImages(body);
  if (!Array.isArray(images)) return NextResponse.json(images, { status: images.status });

  return doRecognize(apiKey, images, jobId);
}

// ── 核心：调用 MiMo 视觉模型，返回识别文本 ──
async function doRecognize(
  apiKey: string,
  images: string[],
  _jobId: string,
) {
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
      max_tokens: 2048,
      stream: false, // 异步模式下不需要流式（每次轮询有独立超时预算）
    });

    if (!resp.ok) {
      const ct = resp.headers.get("content-type") || "";
      const detail = await resp.text();
      const isTimeout =
        resp.status === 504 ||
        detail.includes("504") ||
        detail.toLowerCase().includes("timeout") ||
        ct.includes("text/html");

      if (isTimeout) {
        // 超时 → 返回 processing 让前端继续轮询（下次是新实例，新超时预算）
        return NextResponse.json({
          status: "processing",
          retryAfter: 3,
          message: "识别仍在处理中，请稍候...",
        });
      }

      const safeDetail =
        ct.includes("application/json") && !detail.trimStart().startsWith("<")
          ? detail.slice(0, 300)
          : detail.slice(0, 200).replace(/\s+/g, " ").trim();
      return NextResponse.json(
        { status: "error", error: `识别失败（${resp.status}）：${safeDetail}` },
        { status: 502 },
      );
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    if (!raw || raw.trim().length < 10) {
      return NextResponse.json(
        { status: "error", error: "识别结果为空或过短，请换一张更清晰的图。" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: "done",
      text: raw.trim(),
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      // AbortError → 返回 processing 让前端继续轮询
      return NextResponse.json({
        status: "processing",
        retryAfter: 3,
        message: "识别仍在处理中...",
      });
    }
    return NextResponse.json(
      { status: "error", error: `调用识别服务出错：${err?.message || "未知"}` },
      { status: 502 },
    );
  }
}
