"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { useStudyStats } from "@/lib/useStudyStats";

/* ══════════════════════════════════════════════════════════════
   学盒 xuebox — 可自由布局的仪表盘
   · 卡片可拖动手柄移动位置、拖右下角调整大小（自由度高）
   · 布局/开关持久化到 localStorage
   · 连续打卡 / 学习趋势 / 学习概览 接入真实后端统计（/api/stats）
   ══════════════════════════════════════════════════════════════ */

// ─── Widget 元数据 ───
type WidgetKey =
  | "welcome"   // 每日问候（时段问候 + 可编辑座右铭）
  | "golden"    // 每日金句（励志语录 / 作文金句 / 名家片段）
  | "weather"   // 天气（Open-Meteo，免 key）
  | "tasks"     // 今日任务
  | "pomodoro"  // 番茄钟
  | "trend"     // 学习趋势曲线
  | "streak"    // 连续打卡
  | "clock"     // 日期时钟
  | "countdown" // 目标倒计时
  | "calendar"  // 迷你日历
  | "stats";    // 学习概览（真实数据）

const WIDGET_META: Record<WidgetKey, { label: string; icon: string; desc: string }> = {
  welcome:   { label: "每日问候", icon: "💡", desc: "时段问候 + 可编辑个人座右铭" },
  golden:    { label: "每日金句", icon: "✨", desc: "励志语录 / 作文金句 / 名家片段，每日更新" },
  weather:   { label: "天气", icon: "🌤️", desc: "当前城市天气（无需密钥）" },
  tasks:     { label: "今日任务", icon: "✅", desc: "随手记今日待办，本地保存" },
  pomodoro:  { label: "番茄钟", icon: "⏳", desc: "25/5 专注计时，提升专注" },
  trend:     { label: "学习趋势", icon: "📈", desc: "每日学习量与记忆保持率（真实数据）" },
  streak:    { label: "连续打卡", icon: "🔥", desc: "连续学习天数（真实数据）" },
  clock:     { label: "日期时钟", icon: "🕐", desc: "实时日期 / 星期 / 时间" },
  countdown: { label: "目标倒计时", icon: "🎯", desc: "设置考试/目标，看剩余天数" },
  calendar:  { label: "迷你日历", icon: "📅", desc: "本月日历，标记今天" },
  stats:     { label: "学习概览", icon: "📊", desc: "知识点卡 / 复习 / 保持率（真实数据）" },
};

// ─── 自由布局：每个卡片的 {x,y,w,h}（以 12 列网格为单位） ───
type LayoutItem = { i: WidgetKey; x: number; y: number; w: number; h: number };

// 所有卡片的默认位置（开启新卡片时使用）
const WIDGET_DEFAULT_POS: Record<WidgetKey, LayoutItem> = {
  welcome:   { i: "welcome",   x: 0,  y: 0,  w: 4, h: 3 },
  weather:   { i: "weather",   x: 4,  y: 0,  w: 3, h: 3 },
  streak:    { i: "streak",    x: 7,  y: 0,  w: 2, h: 3 },
  pomodoro:  { i: "pomodoro",  x: 9,  y: 0,  w: 3, h: 4 },
  tasks:     { i: "tasks",     x: 0,  y: 3,  w: 5, h: 5 },
  trend:     { i: "trend",     x: 5,  y: 3,  w: 7, h: 5 },
  stats:     { i: "stats",     x: 0,  y: 8,  w: 4, h: 4 },
  clock:     { i: "clock",     x: 4,  y: 8,  w: 3, h: 4 },
  countdown: { i: "countdown", x: 7,  y: 8,  w: 5, h: 4 },
  calendar:  { i: "calendar",  x: 0,  y: 12, w: 4, h: 4 },
  golden:    { i: "golden",    x: 4,  y: 12, w: 4, h: 4 },
};

// 默认展示的 6 个卡片（其余在「自定义」里手动加）
const DEFAULT_LAYOUT: LayoutItem[] = [
  WIDGET_DEFAULT_POS.welcome,
  WIDGET_DEFAULT_POS.weather,
  WIDGET_DEFAULT_POS.streak,
  WIDGET_DEFAULT_POS.pomodoro,
  WIDGET_DEFAULT_POS.tasks,
  WIDGET_DEFAULT_POS.trend,
  WIDGET_DEFAULT_POS.golden,
];

// ─── 后端真实统计（传给需要真实数据的 widget） ───
type Backend = {
  loggedIn: boolean;
  loading: boolean;
  streak: number;
  daily: { date: string; count: number }[];
  retentionSeries: number[];
  totalCards: number;
  reviewedCards: number;
  masteredPct: number;
  dueCards: number;
  totalOutlines: number;
  daysActive: number;
  dbReady: boolean;
};

// ─── 每日金句语料库（按类别组织，每日按日期取一句，可“换一句”切换） ───
type GoldenCat = "motiv" | "essay" | "master";
const GOLDEN: Record<GoldenCat, { name: string; items: string[] }> = {
  motiv: {
    name: "励志语录",
    items: [
      "你只管努力，剩下的交给时间。",
      "不是因为看到希望才坚持，而是坚持了才看见希望。",
      "所谓天才，不过是长久的忍耐与重复。",
      "把平凡的事做到极致，本身就是一种不平凡。",
      "今天的每一滴汗水，都是明天掌声的预付款。",
      "别着急，慢慢变好，也是一种坚定的前进。",
      "你现在读过的每一页书，都在悄悄拓宽未来的边界。",
      "所有的惊艳，都来自长久而不动声色的准备。",
    ],
  },
  essay: {
    name: "作文金句",
    items: [
      "岁月不居，时节如流；唯奋斗者，能在时光中刻下姓名。",
      "于高山之巅，方见大河奔涌；于群峰之上，更觉长风浩荡。",
      "以梦为马，不负韶华；以心为灯，不惧长夜。",
      "真正的远方，不在脚下，而在心中那束不肯熄灭的光。",
      "时代奔涌向前，青年当以青春之我，创建青春之国家。",
      "行而不辍，未来可期；心有所信，方能行远。",
      "落笔为剑，以思考劈开迷雾；潜心为舟，以笃行渡过江河。",
    ],
  },
  master: {
    name: "名家片段",
    items: [
      "世界上只有一种真正的英雄主义，那就是在认清生活真相之后，依然热爱生活。—— 罗曼·罗兰",
      "其实地上本没有路，走的人多了，也便成了路。—— 鲁迅",
      "人的一生应当这样度过：当他回首往事时，不因虚度年华而悔恨。—— 奥斯特洛夫斯基",
      "志之所趋，无远弗届；穷山距海，不能限也。——《格言联璧》",
      "海纳百川，有容乃大；壁立千仞，无欲则刚。—— 林则徐",
      "山高月小，水落石出。—— 苏轼",
    ],
  },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return { icon: "🌙", text: "夜深了" };
  if (h < 12) return { icon: "☀️", text: "早上好" };
  if (h < 14) return { icon: "🍃", text: "中午好" };
  if (h < 18) return { icon: "🌤️", text: "下午好" };
  if (h < 22) return { icon: "🌆", text: "晚上好" };
  return { icon: "🌙", text: "夜深了" };
}

function makeCurve(seed: number, base: number, amp: number, trend: number) {
  const arr: number[] = [];
  let v = base;
  for (let i = 0; i < 14; i++) {
    v += Math.sin(i * 0.7 + seed) * amp * 0.5 + trend;
    v = Math.max(0, v);
    arr.push(Math.round(v));
  }
  return arr;
}

// 轻量折线图（渐变填充 + 光点）
function TrendChart({ words, retention }: { words: number[]; retention: number[] }) {
  const W = 560, H = 170, pad = 10;
  const len = Math.max(words.length, retention.length, 1);
  const xStep = len > 1 ? (W - pad * 2) / (len - 1) : 0;
  const toPath = (data: number[], max: number, scale = 1) => {
    const m = Math.max(max, 1);
    return data.map((d, i) => {
      const x = pad + i * xStep;
      const y = H - pad - (d / m) * (H - pad * 2) * scale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  };
  const wMax = Math.max(...words, 10);
  const wPath = toPath(words, wMax, 0.9);
  const rPath = toPath(retention, 100);
  const wArea = `${wPath} L${W - pad},${H - pad} L${pad},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }} role="img" aria-label="学习趋势曲线">
      <defs>
        <linearGradient id="cgW" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-teal)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent-teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path d={wArea} fill="url(#cgW)" />
      <path d={wPath} fill="none" stroke="var(--accent-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={rPath} fill="none" stroke="var(--accent-purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {len > 0 && (
        <>
          <circle cx={W - pad} cy={H - pad - (retention[len - 1] / 100) * (H - pad * 2)} r="3.5" fill="var(--accent-purple)" />
          <circle cx={W - pad} cy={H - pad - (words[len - 1] / wMax) * (H - pad * 2) * 0.9} r="3.5" fill="var(--accent-teal)" />
        </>
      )}
    </svg>
  );
}

/* ─── 单个 Widget 外壳 ─── */
function WidgetShell({ title, icon, children, badge }: { title: string; icon: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="glass-card flex h-full flex-col gap-3 overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ════════════════ 各 Widget 实现 ════════════════ */

function WelcomeWidget() {
  const [motto, setMotto] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const greeting = getGreeting();

  useEffect(() => {
    try { const s = localStorage.getItem("xuebox_motto"); if (s) setMotto(s); } catch {}
  }, []);
  const save = () => {
    const v = draft.trim();
    setMotto(v);
    try { localStorage.setItem("xuebox_motto", v); } catch {}
    setEditing(false);
  };

  return (
    <WidgetShell title="每日问候" icon="💡">
      {/* 主问候区：大图标 + 问候语 + 品牌名 */}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl"
          style={{ background: 'rgba(45,212,191,0.1)', boxShadow: '0 0 20px rgba(45,212,191,0.1)' }}>
          {greeting.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            {greeting.text}，<span style={{ color: "var(--accent-teal)" }}>xuebox</span> 为你准备好了
          </p>
        </div>
      </div>

      {/* 座右铭：引用样式编辑区 */}
      <div className="relative rounded-lg border px-4 py-3 transition-colors"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderColor: editing ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.06)',
          borderLeftWidth: '3px',
          borderLeftColor: 'var(--accent-teal)',
        }}
      >
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            className="w-full bg-transparent py-1 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder="写下你的座右铭…"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(motto); setEditing(true); }}
            className="w-full text-left text-sm leading-relaxed italic transition-opacity hover:opacity-80"
            style={{ color: motto ? "var(--text-primary)" : "var(--text-muted)" }}
            title="点击编辑座右铭"
          >
            {motto || "写下一句属于你的座右铭，点击即可编辑"}
          </button>
        )}
      </div>
    </WidgetShell>
  );
}

function GoldenWidget() {
  const cats: GoldenCat[] = ["motiv", "essay", "master"];
  const [cat, setCat] = useState<GoldenCat>("motiv");
  const [text, setText] = useState("");
  const [ai, setAi] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // 立刻展示一句精选（按日期取，零等待），AI 结果回来后再覆盖
  const dayBase = Math.floor(Date.now() / 86400000);
  const curatedText = GOLDEN[cat].items[dayBase % GOLDEN[cat].items.length];
  const display = text || curatedText;

  // 切换类别时拉取该类别的「每日 AI 金句」（服务端按天缓存，每天只生成一次）
  useEffect(() => {
    setText("");
    setAi(false);
    const id = ++reqId.current;
    fetch(`/api/daily-golden?cat=${cat}`)
      .then((r) => r.json())
      .then((j) => { if (id === reqId.current && j?.text) { setText(j.text); setAi(!!j.ai); } })
      .catch(() => {});
  }, [cat]);

  // 「✨ AI 生成」：不想要当前这句，随时让 AI 重新生成一句
  const generate = async () => {
    setLoading(true);
    const id = ++reqId.current;
    try {
      const r = await fetch(`/api/daily-golden?cat=${cat}&regen=1`);
      const j = await r.json();
      if (id === reqId.current && j?.text) { setText(j.text); setAi(!!j.ai); }
    } catch {}
    finally { if (id === reqId.current) setLoading(false); }
  };

  return (
    <WidgetShell
      title="每日金句"
      icon="✨"
      badge={
        ai
          ? <span className="glass-badge glass-badge-live">AI 生成</span>
          : <span className="glass-badge glass-badge-soon">每日更新</span>
      }
    >
      {/* 类别切换 */}
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
            style={
              c === cat
                ? { background: "rgba(45,212,191,0.14)", color: "var(--accent-teal)", border: "1px solid rgba(45,212,191,0.3)" }
                : { background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {GOLDEN[c].name}
          </button>
        ))}
      </div>

      {/* 金句主体 */}
      <div className="relative flex flex-1 items-center">
        <span className="pointer-events-none absolute -top-1 left-0 text-4xl leading-none"
          style={{ color: "var(--accent-amber)", fontFamily: "Georgia, serif", opacity: 0.45 }}>"</span>
        <p className="pl-6 pr-1 text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {display}
        </p>
      </div>

      {/* AI 生成 / 换一句 */}
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="glass-btn self-start px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
        style={{ color: "var(--accent-teal)", borderColor: "rgba(45,212,191,0.25)" }}
      >
        {loading ? "生成中…" : "✨ AI 生成"}
      </button>
    </WidgetShell>
  );
}

function WeatherWidget() {
  const [data, setData] = useState<{ temp: number; desc: string; city: string; icon: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fallback = () => fetchWeather(39.9, 116.4, "北京");
    if (!navigator.geolocation) { fallback(); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try { await fetchWeather(pos.coords.latitude, pos.coords.longitude); }
        catch { fallback(); }
      },
      () => fallback(),
      { timeout: 4000 }
    );
    async function fetchWeather(lat: number, lon: number, cityName?: string) {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`);
        const j = await r.json();
        const t = Math.round(j.current.temperature_2m);
        const code = j.current.weather_code;
        setData({ temp: t, desc: weatherDesc(code), city: cityName || "当前位置", icon: weatherIcon(code) });
      } catch {
        setErr("天气获取失败");
      }
    }
  }, []);

  if (err) return <WidgetShell title="天气" icon="🌤️"><p className="text-sm" style={{ color: "var(--text-muted)" }}>{err}</p></WidgetShell>;
  if (!data) return <WidgetShell title="天气" icon="🌤️"><p className="text-sm" style={{ color: "var(--text-muted)" }}>定位中…</p></WidgetShell>;
  return (
    <WidgetShell title="天气" icon="🌤️">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{data.icon}</span>
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{data.temp}°C</span>
        </div>
        <div className="text-right">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>{data.desc}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{data.city}</p>
        </div>
      </div>
    </WidgetShell>
  );
}

function TasksWidget() {
  const today = new Date().toISOString().slice(0, 10);
  const [tasks, setTasks] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [offline, setOffline] = useState(true);

  // 加载：登录→拉后端；未登录→本地
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/tasks?date=${today}`);
        if (r.status === 401) {
          const raw = localStorage.getItem("xuebox_tasks_" + today);
          if (alive) { setTasks(raw ? JSON.parse(raw) : []); setOffline(true); }
        } else if (r.ok) {
          const j = await r.json();
          if (alive) { setTasks(j.tasks || []); setOffline(false); }
        } else if (alive) setOffline(true);
      } catch {
        if (alive) setOffline(true);
      }
    })();
    return () => { alive = false; };
  }, [today]);

  // 离线时本地持久化
  useEffect(() => {
    if (offline) {
      try { localStorage.setItem("xuebox_tasks_" + today, JSON.stringify(tasks)); } catch {}
    }
  }, [tasks, offline, today]);

  const add = async () => {
    const t = input.trim();
    if (!t) return;
    if (offline) {
      setTasks((p) => [...p, { id: String(Date.now()), text: t, done: false }]);
      setInput("");
      return;
    }
    setInput("");
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, text: t }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.task) { setTasks((p) => [...p, { id: j.task.id, text: j.task.text, done: false }]); return; }
      }
    } catch {}
    setTasks((p) => [...p, { id: String(Date.now()), text: t, done: false }]);
  };

  const toggle = async (id: string) => {
    const cur = tasks.find((t) => t.id === id);
    if (!cur) return;
    const next = !cur.done;
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, done: next } : t)));
    if (!offline) {
      try {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, done: next }),
        });
      } catch {}
    }
  };

  return (
    <WidgetShell title="今日任务" icon="✅" badge={!offline ? <span className="glass-badge glass-badge-live">已同步</span> : undefined}>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          className="glass-input flex-1 px-3 py-1.5 text-sm"
          placeholder="添加今日任务，回车确认…"
        />
        <button onClick={add} className="btn-primary-glow px-3 py-1.5 text-sm">添加</button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-auto">
        {tasks.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>还没有任务，写下今天要完成的事吧。</p>}
        {tasks.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: t.done ? "var(--text-muted)" : "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              className="accent-[var(--accent-teal)]"
            />
            <span className={t.done ? "line-through" : ""}>{t.text}</span>
          </label>
        ))}
      </div>
    </WidgetShell>
  );
}

function PomodoroWidget() {
  const [sec, setSec] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => setSec((s) => (s > 0 ? s - 1 : 0)), 1000);
    } else if (timer.current) clearInterval(timer.current);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const reset = (m: number) => { setRunning(false); setSec(m * 60); };

  return (
    <WidgetShell title="番茄钟" icon="⏳">
      <p className="text-3xl font-mono font-semibold text-center" style={{ color: "var(--accent-teal)" }}>{mm}:{ss}</p>
      <div className="flex justify-center gap-2">
        <button onClick={() => setRunning((r) => !r)} className="btn-primary-glow px-4 py-1.5 text-sm">
          {running ? "暂停" : "开始"}
        </button>
        <button onClick={() => reset(25)} className="glass-btn px-3 py-1.5 text-sm">重置</button>
      </div>
    </WidgetShell>
  );
}

function TrendWidget({ backend }: { backend: Backend }) {
  const words = useMemo(
    () => (backend.loggedIn && backend.daily.length ? backend.daily.map((d) => d.count) : makeCurve(1.2, 12, 10, 1.1)),
    [backend.loggedIn, backend.daily],
  );
  const retention = useMemo(
    () => (backend.loggedIn && backend.retentionSeries.length ? backend.retentionSeries : makeCurve(3.7, 55, 20, 2.2).map((v) => Math.min(100, Math.round(v)))),
    [backend.loggedIn, backend.retentionSeries],
  );
  return (
    <WidgetShell
      title="学习趋势"
      icon="📈"
      badge={backend.loggedIn ? <span className="glass-badge glass-badge-live">真实数据</span> : undefined}
    >
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent-teal)" }} /> 每日学习量</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent-purple)" }} /> 记忆保持率</span>
      </div>
      <TrendChart words={words} retention={retention} />
    </WidgetShell>
  );
}

function StreakWidget({ backend }: { backend: Backend }) {
  const [localStreak, setLocalStreak] = useState(1);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    try {
      const last = localStorage.getItem("xuebox_streak_last");
      const prev = Number(localStorage.getItem("xuebox_streak") || "1");
      if (last === today) { setLocalStreak(prev); return; }
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const next = last === y ? prev + 1 : 1;
      setLocalStreak(next);
      localStorage.setItem("xuebox_streak", String(next));
      localStorage.setItem("xuebox_streak_last", today);
    } catch {}
  }, [today]);

  const shown = backend.loggedIn ? (backend.loading ? localStreak : backend.streak) : localStreak;

  return (
    <WidgetShell
      title="连续打卡"
      icon="🔥"
      badge={backend.loggedIn ? <span className="glass-badge glass-badge-live">真实数据</span> : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-3xl font-semibold" style={{ color: "var(--accent-coral)" }}>{shown}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>天连续学习</span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>每天打开学盒就续上 🔥</p>
    </WidgetShell>
  );
}

/* ─── 日期时钟（实时） ─── */
function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return (
    <WidgetShell title="日期时钟" icon="🕐">
      <p className="text-3xl font-mono font-semibold" style={{ color: "var(--accent-blue)" }}>{hh}:{mm}<span className="text-lg opacity-70">:{ss}</span></p>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{now.getMonth() + 1}月{now.getDate()}日 · 星期{week}</p>
    </WidgetShell>
  );
}

/* ─── 目标倒计时 ─── */
function CountdownWidget() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [editing, setEditing] = useState(false);
  const [dName, setDName] = useState("");
  const [dDate, setDDate] = useState("");

  useEffect(() => {
    try {
      const n = localStorage.getItem("xuebox_goal_name");
      const d = localStorage.getItem("xuebox_goal_date");
      if (n) setName(n);
      if (d) setDate(d);
    } catch {}
  }, []);

  const save = () => {
    setName(dName.trim());
    setDate(dDate);
    try {
      localStorage.setItem("xuebox_goal_name", dName.trim());
      localStorage.setItem("xuebox_goal_date", dDate);
    } catch {}
    setEditing(false);
  };

  let days: number | null = null;
  if (date) {
    const diff = new Date(date + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
    days = Math.round(diff / 864e5);
  }

  return (
    <WidgetShell title="目标倒计时" icon="🎯">
      {editing || !date ? (
        <div className="flex flex-col gap-2">
          <input value={dName} onChange={(e) => setDName(e.target.value)} className="glass-input px-3 py-1.5 text-sm" placeholder="目标名称（如：期末考试）" />
          <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className="glass-input px-3 py-1.5 text-sm" />
          <button onClick={save} className="btn-primary-glow px-3 py-1.5 text-sm" disabled={!dDate}>保存</button>
        </div>
      ) : (
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold" style={{ color: days !== null && days < 7 ? "var(--accent-coral)" : "var(--accent-amber)" }}>{days}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>天后 · {name || "目标"}</p>
          </div>
          <button onClick={() => { setDName(name); setDDate(date); setEditing(true); }} className="glass-btn px-3 py-1 text-xs">修改</button>
        </div>
      )}
    </WidgetShell>
  );
}

/* ─── 迷你日历 ─── */
function CalendarWidget() {
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const today = new Date();
  const first = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const shift = (dir: number) => setView((v) => { const d = new Date(v.y, v.m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const isToday = (d: number) => d === today.getDate() && view.m === today.getMonth() && view.y === today.getFullYear();

  return (
    <WidgetShell title="迷你日历" icon="📅">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} className="glass-btn px-2 py-0.5 text-xs">‹</button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{view.y} 年 {view.m + 1} 月</span>
        <button onClick={() => shift(1)} className="glass-btn px-2 py-0.5 text-xs">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => <span key={d}>{d}</span>)}
        {cells.map((d, i) => (
          <span key={i} className="rounded py-0.5"
            style={d && isToday(d) ? { background: "var(--accent-teal)", color: "#021a17", fontWeight: 600 } : d ? { color: "var(--text-secondary)" } : {}}>
            {d || ""}
          </span>
        ))}
      </div>
    </WidgetShell>
  );
}

/* ─── 学习概览（真实后端数据；未登录回退本地任务） ─── */
function StatsWidget({ backend }: { backend: Backend }) {
  const [taskDone, setTaskDone] = useState(0);
  const [taskTotal, setTaskTotal] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("xuebox_tasks_" + today);
      if (raw) {
        const arr = JSON.parse(raw) as { done: boolean }[];
        setTaskTotal(arr.length);
        setTaskDone(arr.filter((t) => t.done).length);
      }
    } catch {}
  }, [today]);

  if (backend.loggedIn) {
    if (!backend.dbReady) {
      return (
        <WidgetShell title="学习概览" icon="📊">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>数据暂未接入，请稍后重试。</p>
        </WidgetShell>
      );
    }
    const pct = backend.reviewedCards ? Math.round((backend.masteredPct)) : 0;
    return (
      <WidgetShell title="学习概览" icon="📊" badge={<span className="glass-badge glass-badge-live">真实数据</span>}>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(45,212,191,0.07)" }}>
            <p className="text-lg font-semibold" style={{ color: "var(--accent-teal)" }}>{backend.totalCards}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>知识点卡</p>
          </div>
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(96,165,250,0.07)" }}>
            <p className="text-lg font-semibold" style={{ color: "var(--accent-blue)" }}>{backend.reviewedCards}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>已复习</p>
          </div>
          <div className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(167,139,250,0.07)" }}>
            <p className="text-lg font-semibold" style={{ color: "var(--accent-purple)" }}>{backend.masteredPct}%</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>保持率</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          累计学习 {backend.daysActive} 天 · 待复习 {backend.dueCards} 张
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: "var(--accent-purple)" }} />
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>已复习卡片记忆保持率 {pct}%</p>
      </WidgetShell>
    );
  }

  // 未登录：展示本地今日任务进度
  const pct = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;
  return (
    <WidgetShell title="学习概览" icon="📊">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(45,212,191,0.07)" }}>
          <p className="text-xl font-semibold" style={{ color: "var(--accent-teal)" }}>{taskDone}/{taskTotal}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>今日任务</p>
        </div>
        <div className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(251,113,133,0.07)" }}>
          <p className="text-xl font-semibold" style={{ color: "var(--accent-coral)" }}>{localStorage.getItem("xuebox_streak") ?? "1"}天</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>连续打卡</p>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: "var(--accent-teal)" }} />
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>登录后展示真实学习数据</p>
    </WidgetShell>
  );
}

/* ════════════════ 自由布局网格 ════════════════ */

const GAP = 16;
const ROW_H = 88;
const MIN_W = 2;
const MIN_H = 2;

function colsForWidth(w: number) {
  if (w < 520) return 2;
  if (w < 768) return 4;
  if (w < 1024) return 6;
  if (w < 1280) return 8;
  return 12;
}
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function overlaps(a: LayoutItem, b: LayoutItem) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
// 把卡片向下推，直到不再与其他卡片重叠（保证自由布局但不乱叠）
function resolve(item: LayoutItem, others: LayoutItem[]): LayoutItem {
  let y = item.y;
  let guard = 0;
  while (others.some((o) => overlaps({ ...item, y }, o)) && guard < 500) { y++; guard++; }
  return { ...item, y };
}

// 把一组卡片整体排布：按顺序（先 y 后 x）逐个向下推，直到彼此不再重叠。
// 用于响应式降级时把"自由布局"重排成不重叠的干净堆叠（堆叠/双列都依赖它）。
function packAll(items: LayoutItem[]): LayoutItem[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: LayoutItem[] = [];
  for (const it of sorted) {
    let cur: LayoutItem = { ...it };
    let guard = 0;
    while (placed.some((p) => overlaps(cur, p)) && guard < 1000) {
      cur = { ...cur, y: cur.y + 1 };
      guard++;
    }
    placed.push(cur);
  }
  return placed;
}

// 把 12 列坐标系的自由布局，缩放并重排到当前列数，保证任何屏幕都不重叠/不溢出。
// cols === 12 时原样返回（桌面精确还原）；cols < 12 时等比缩放 x/w 再整体打包。
function reflowToCols(layout: LayoutItem[], cols: number): LayoutItem[] {
  if (cols === 12) return layout;
  const f = cols / 12;
  const scaled = layout.map((it) => {
    const w = clamp(Math.round(it.w * f), MIN_W, cols);
    const x = clamp(Math.round(it.x * f), 0, Math.max(0, cols - w));
    return { ...it, x, w };
  });
  return packAll(scaled);
}

// 计算与其他卡片边缘对齐的参考线（px）。网格本身已做吸附，这里负责"对齐参考线"的可视化。
function computeGuides(moved: LayoutItem, others: LayoutItem[], cw: number) {
  const v: number[] = [];
  const h: number[] = [];
  const leftX = (x: number) => x * (cw + GAP);
  const rightX = (x: number, w: number) => (x + w) * (cw + GAP) - GAP;
  const centerX = (x: number, w: number) => x * (cw + GAP) + (w * cw + GAP * (w - 1)) / 2;
  const topY = (y: number) => y * (ROW_H + GAP);
  const botY = (y: number, hgt: number) => (y + hgt) * (ROW_H + GAP) - GAP;
  const midY = (y: number, hgt: number) => y * (ROW_H + GAP) + (hgt * ROW_H + GAP * (hgt - 1)) / 2;
  for (const o of others) {
    if (moved.x === o.x) v.push(leftX(o.x));
    if (moved.x + moved.w === o.x + o.w) v.push(rightX(moved.x, moved.w));
    if (Math.round(centerX(moved.x, moved.w)) === Math.round(centerX(o.x, o.w))) v.push(centerX(moved.x, moved.w));
    if (moved.y === o.y) h.push(topY(o.y));
    if (moved.y + moved.h === o.y + o.h) h.push(botY(moved.y, moved.h));
    if (Math.round(midY(moved.y, moved.h)) === Math.round(midY(o.y, o.h))) h.push(midY(moved.y, moved.h));
  }
  return { v: [...new Set(v)], h: [...new Set(h)] };
}

function DashboardGrid({
  layout,
  setLayout,
  editing,
  renderItem,
}: {
  layout: LayoutItem[];
  setLayout: (next: LayoutItem[]) => void;
  editing: boolean;
  renderItem: (k: WidgetKey) => React.ReactElement;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<LayoutItem[] | null>(null);
  const [dragId, setDragId] = useState<WidgetKey | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  const dragRef = useRef<{ id: WidgetKey; sx: number; sy: number; orig: LayoutItem } | null>(null);
  const previewRef = useRef<LayoutItem[] | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dimsRef = useRef({ cols: 12, cw: 0 });
  // 编辑态强制 12 列画布（坐标体系恒定、存储始终为 12 列）；
  // 查看态按实际宽度选列数，再 reflowToCols 重排为不重叠的响应式布局。
  const gridCols = editing ? 12 : (width ? colsForWidth(width) : 12);
  dimsRef.current = { cols: gridCols, cw: width ? (width - GAP * (gridCols - 1)) / gridCols : 0 };
  // 查看态：把 12 列自由布局重排到当前列数（缩放 + 打包），杜绝手机端重叠/溢出。
  const viewLayout = editing ? layout : reflowToCols(layout, gridCols);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 在首次绘制前量好宽度，避免卡片初始闪烁成小方块
  const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
  useIso(() => {
    if (ref.current) setWidth(ref.current.clientWidth);
  }, []);

  const commit = useCallback(() => {
    if (previewRef.current) setLayout(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setGuides({ v: [], h: [] });
    setDragId(null);
    dragRef.current = null;
  }, [setLayout]);

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { cw, cols: c } = dimsRef.current;
    if (!cw) return;
    const dc = Math.round((e.clientX - d.sx) / (cw + GAP));
    const dr = Math.round((e.clientY - d.sy) / (ROW_H + GAP));
    const nx = clamp(d.orig.x + dc, 0, c - d.orig.w);
    const ny = Math.max(0, d.orig.y + dr);
    const moved = resolve({ ...d.orig, x: nx, y: ny }, layoutRef.current.filter((l) => l.i !== d.id));
    const next = layoutRef.current.map((l) => (l.i === d.id ? moved : l));
    previewRef.current = next;
    setPreview(next);
    setGuides(computeGuides(moved, layoutRef.current.filter((l) => l.i !== d.id), cw));
  }, []);

  const onUp = useCallback(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    commit();
  }, [onMove, commit]);

  const onResizeMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { cw, cols: c } = dimsRef.current;
    if (!cw) return;
    const dc = Math.round((e.clientX - d.sx) / (cw + GAP));
    const dr = Math.round((e.clientY - d.sy) / (ROW_H + GAP));
    const nw = clamp(d.orig.w + dc, MIN_W, c - d.orig.x);
    const nh = Math.max(MIN_H, d.orig.h + dr);
    const resized = resolve({ ...d.orig, w: nw, h: nh }, layoutRef.current.filter((l) => l.i !== d.id));
    const next = layoutRef.current.map((l) => (l.i === d.id ? resized : l));
    previewRef.current = next;
    setPreview(next);
    setGuides(computeGuides(resized, layoutRef.current.filter((l) => l.i !== d.id), cw));
  }, []);

  const onResizeUp = useCallback(() => {
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeUp);
    commit();
  }, [onResizeMove, commit]);

  const startDrag = (e: React.PointerEvent, id: WidgetKey) => {
    e.preventDefault();
    e.stopPropagation();
    const item = layout.find((l) => l.i === id);
    if (!item) return;
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, orig: item };
    setDragId(id);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const startResize = (e: React.PointerEvent, id: WidgetKey) => {
    e.preventDefault();
    e.stopPropagation();
    const item = layout.find((l) => l.i === id);
    if (!item) return;
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, orig: item };
    setDragId(id);
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeUp);
  };

  const active = preview ?? viewLayout;
  const cw = width ? (width - GAP * (gridCols - 1)) / gridCols : 0;
  const geom = (it: LayoutItem) => {
    const w = Math.min(it.w, gridCols);
    const x = Math.min(it.x, gridCols - w);
    return {
      left: x * (cw + GAP),
      top: it.y * (ROW_H + GAP),
      pw: w * cw + GAP * (w - 1),
      ph: it.h * ROW_H + GAP * (it.h - 1),
    };
  };
  const maxBottom = active.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  const containerH = maxBottom * (ROW_H + GAP) - GAP;

  return (
    <div ref={ref} data-editing={editing} className="relative w-full" style={{ height: containerH }}>
      {active.map((it) => {
        const { left, top, pw, ph } = geom(it);
        return (
          <div key={it.i} className="absolute" style={{ left, top, width: pw, height: ph }}>
            {editing && (
              <>
                <button
                  aria-label="拖动移动"
                  onPointerDown={(e) => startDrag(e, it.i)}
                  className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                  style={{ background: "rgba(45,212,191,0.18)", color: "var(--accent-teal)", cursor: "grab", border: "0.5px solid rgba(45,212,191,0.35)", touchAction: "none" }}
                >⠿</button>
                <button
                  aria-label="拖动调整大小"
                  onPointerDown={(e) => startResize(e, it.i)}
                  className="absolute bottom-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-lg text-xs"
                  style={{ background: "rgba(255,255,255,0.10)", color: "var(--text-secondary)", cursor: "nwse-resize", border: "0.5px solid var(--glass-border)", touchAction: "none" }}
                >⤡</button>
              </>
            )}
            {renderItem(it.i)}
          </div>
        );
      })}
      {/* 对齐参考线：拖动/缩放时与其他卡片边缘对齐时显示（网格本身已吸附） */}
      {editing && dragId && guides.v.map((x, i) => (
        <div key={"gv" + i} className="pointer-events-none absolute z-10" style={{ left: x, top: 0, height: containerH, width: 2, background: "var(--accent-teal)", opacity: 0.55 }} />
      ))}
      {editing && dragId && guides.h.map((y, i) => (
        <div key={"gh" + i} className="pointer-events-none absolute z-10" style={{ top: y, left: 0, width: "100%", height: 2, background: "var(--accent-teal)", opacity: 0.55 }} />
      ))}
    </div>
  );
}

/* ════════════════ 主仪表盘（含自定义面板） ════════════════ */
export default function Dashboard() {
  const { stats, loading } = useStudyStats();
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // 测量容器宽度，判断是否为手机/窄屏（≤4 列）——窄屏隐藏自由布局编辑，仅展示干净堆叠
  const sectionRef = useRef<HTMLElement | null>(null);
  const [secWidth, setSecWidth] = useState(0);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const measure = () => setSecWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const secCols = secWidth ? colsForWidth(secWidth) : 12;
  const compact = secCols <= 4; // 手机/窄屏
  const effectiveEditing = compact ? false : editing;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("xuebox_dash_layout");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LayoutItem>[];
        // 归一化到 12 列安全范围，防止旧数据（曾在窄屏编辑）导致溢出/重叠
        const valid = parsed
          .filter((l): l is LayoutItem => !!l && l.i != null && l.i in WIDGET_META)
          .map((l) => ({
            ...l,
            w: clamp(Math.round(l.w) || MIN_W, MIN_W, 12),
            x: clamp(Math.round(l.x) || 0, 0, 12 - MIN_W),
            h: clamp(Math.round(l.h) || MIN_H, MIN_H, 50),
            y: Math.max(0, Math.round(l.y) || 0),
          }));
        if (valid.length) setLayout(valid);
      }
    } catch {}
  }, []);

  const persist = (next: LayoutItem[]) => {
    setLayout(next);
    try { localStorage.setItem("xuebox_dash_layout", JSON.stringify(next)); } catch {}
  };

  const enabledKeys = new Set(layout.map((l) => l.i));
  const toggleWidget = (k: WidgetKey) => {
    if (enabledKeys.has(k)) {
      persist(layout.filter((l) => l.i !== k));
    } else {
      const maxBottom = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      const def = WIDGET_DEFAULT_POS[k];
      persist([...layout, { ...def, y: maxBottom }]);
    }
  };
  const resetLayout = () => persist(DEFAULT_LAYOUT);

  const backend: Backend = {
    loggedIn: stats.loggedIn,
    loading,
    streak: stats.streak,
    daily: stats.daily,
    retentionSeries: stats.retentionSeries,
    totalCards: stats.totalCards,
    reviewedCards: stats.reviewedCards,
    masteredPct: stats.masteredPct,
    dueCards: stats.dueCards,
    totalOutlines: stats.totalOutlines,
    daysActive: stats.daysActive,
    dbReady: stats.dbReady ?? true,
  };

  const renderItem = (k: WidgetKey): React.ReactElement => {
    switch (k) {
      case "welcome": return <WelcomeWidget />;
      case "golden": return <GoldenWidget />;
      case "weather": return <WeatherWidget />;
      case "tasks": return <TasksWidget />;
      case "pomodoro": return <PomodoroWidget />;
      case "trend": return <TrendWidget backend={backend} />;
      case "streak": return <StreakWidget backend={backend} />;
      case "clock": return <ClockWidget />;
      case "countdown": return <CountdownWidget />;
      case "calendar": return <CalendarWidget />;
      case "stats": return <StatsWidget backend={backend} />;
    }
  };

  return (
    <section ref={sectionRef} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>我的仪表盘</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            点「自定义」增删组件；更宽屏幕上可开启「自由布局」自由拖动调整大小与位置。
          </p>
        </div>
        <div className="flex gap-2">
          {!compact && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="glass-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
              style={effectiveEditing ? { borderColor: "rgba(45,212,191,0.35)", color: "var(--accent-teal)", background: "rgba(45,212,191,0.08)" } : {}}
            >
              ✥ 自由布局{effectiveEditing ? "：开" : ""}
            </button>
          )}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="glass-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ borderColor: "rgba(45,212,191,0.25)", color: "var(--accent-teal)" }}
          >
            ⚙ 自定义
          </button>
        </div>
      </div>

      {effectiveEditing && (
        <p className="glass-badge glass-badge-soon self-start">拖动卡片右上角 ⠿ 移动，右下角 ⤡ 调整大小，自动保存</p>
      )}

      {panelOpen && (
        <div className="glass-card flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>点击开关组件（自动保存）</p>
            <button onClick={resetLayout} className="glass-btn px-3 py-1 text-xs">重置布局</button>
          </div>
          {(Object.keys(WIDGET_META) as WidgetKey[]).map((k) => {
            const on = enabledKeys.has(k);
            return (
              <div key={k} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                   style={{ background: on ? "rgba(45,212,191,0.06)" : "transparent" }}>
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={on} onChange={() => toggleWidget(k)} className="accent-[var(--accent-teal)]" />
                  <span>{WIDGET_META[k].icon} {WIDGET_META[k].label}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      <DashboardGrid layout={layout} setLayout={persist} editing={effectiveEditing} renderItem={renderItem} />
    </section>
  );
}

/* ─── 天气码 → 文案/图标 ─── */
function weatherDesc(code: number) {
  if (code === 0) return "晴";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾/霜";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "阵雨";
  if (code <= 99) return "雷暴";
  return "未知";
}
function weatherIcon(code: number) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 82) return "🌧️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}
