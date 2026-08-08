import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type Cat = "motiv" | "essay" | "master";

// 各类别专属生成提示（让 AI 产出符合场景的一句）
const PROMPTS: Record<Cat, string> = {
  motiv:
    "请写一句简短有力、适合学生用来自我激励的励志短句。要求：中文，不超过 30 字，" +
    "不要加引号或书名号包裹，不要编号，不要解释，直接给出这一句话。",
  essay:
    "请写一句适合用在中小学或高考作文里的优美金句 / 过渡句。要求：中文，不超过 40 字，" +
    "富有文采、可独立成段，不要加引号包裹，不要编号，不要解释，直接给出这一句话。",
  master:
    "请写一句化用或仿写中外名家名篇语气的优美短句。要求：中文，不超过 40 字，" +
    "可带'—— 仿写'之类的署名感，不要编号，不要解释，直接给出这一句话。",
};

// 服务端按「类别 + 当天」缓存一条，保证默认每日只生成一次（之后读缓存，零成本）
const cache = new Map<string, string>();
function dayKey(cat: Cat) {
  return `${cat}:${new Date().toISOString().slice(0, 10)}`;
}

function clean(text: string): string {
  let t = (text || "").trim();
  // 去掉常见包裹与编号
  t = t.replace(/^["'"'""''「『]/, "").replace(/["'"'""''」』]$/, "");
  t = t.replace(/^(\d+[\.、、])\s*/, "");
  t = t.replace(/^(金句|励志语录|作文金句|名家片段)[：:]\s*/, "");
  return t.trim().slice(0, 60);
}

// 取一条精选语料（接口不可用 / 限流时的优雅降级）
function curated(cat: Cat, salt = 0): string {
  const map: Record<Cat, string[]> = {
    motiv: [
      "你只管努力，剩下的交给时间。",
      "不是因为看到希望才坚持，而是坚持了才看见希望。",
      "所谓天才，不过是长久的忍耐与重复。",
      "把平凡的事做到极致，本身就是一种不平凡。",
      "今天的每一滴汗水，都是明天掌声的预付款。",
      "别着急，慢慢变好，也是一种坚定的前进。",
      "你现在读过的每一页书，都在悄悄拓宽未来的边界。",
      "所有的惊艳，都来自长久而不动声色的准备。",
    ],
    essay: [
      "岁月不居，时节如流；唯奋斗者，能在时光中刻下姓名。",
      "于高山之巅，方见大河奔涌；于群峰之上，更觉长风浩荡。",
      "以梦为马，不负韶华；以心为灯，不惧长夜。",
      "真正的远方，不在脚下，而在心中那束不肯熄灭的光。",
      "时代奔涌向前，青年当以青春之我，创建青春之国家。",
      "行而不辍，未来可期；心有所信，方能行远。",
      "落笔为剑，以思考劈开迷雾；潜心为舟，以笃行渡过江河。",
    ],
    master: [
      "世界上只有一种真正的英雄主义，那就是在认清生活真相之后，依然热爱生活。—— 罗曼·罗兰",
      "其实地上本没有路，走的人多了，也便成了路。—— 鲁迅",
      "人的一生应当这样度过：当他回首往事时，不因虚度年华而悔恨。—— 奥斯特洛夫斯基",
      "志之所趋，无远弗届；穷山距海，不能限也。——《格言联璧》",
      "海纳百川，有容乃大；壁立千仞，无欲则刚。—— 林则徐",
      "山高月小，水落石出。—— 苏轼",
    ],
  };
  const list = map[cat];
  return list[(Date.now() / 86400000 + salt) % list.length | 0];
}

export async function GET(req: NextRequest) {
  const catParam = req.nextUrl.searchParams.get("cat");
  const regen = req.nextUrl.searchParams.get("regen") === "1";
  const cat: Cat = catParam === "essay" || catParam === "master" ? catParam : "motiv";

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ text: curated(cat), ai: false, fallback: true });
  }

  // 默认（非 regen）走日期缓存；regen 每次都现生成
  const key = dayKey(cat);
  if (!regen && cache.has(key)) {
    return NextResponse.json({ text: cache.get(key)!, ai: true });
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
        messages: [{ role: "user", content: PROMPTS[cat] }],
        temperature: 0.9,
        max_tokens: 120,
      }),
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const text = clean(raw);
    if (!text) throw new Error("empty");
    if (!regen) cache.set(key, text);
    return NextResponse.json({ text, ai: true });
  } catch {
    // 任何失败都优雅降级到精选语料，保证面板永远有内容
    return NextResponse.json({ text: curated(cat, regen ? 1 : 0), ai: false, fallback: true });
  }
}
