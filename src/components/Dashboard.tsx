"use client";

import { useState, useEffect, useRef, useMemo } from "react";

/* ══════════════════════════════════════════════════════════════
   学盒 xuebox — 可自由搭配的仪表盘组件
   学生可在顶栏「自定义」面板里自由开关 / 拖拽排序这些 widget
   ══════════════════════════════════════════════════════════════ */

// ─── Widget 元数据 ───
type WidgetKey =
  | "welcome"   // 问候 + 座右铭 + 每日语录
  | "weather"   // 天气（Open-Meteo，免 key）
  | "tasks"     // 今日任务
  | "pomodoro"  // 番茄钟
  | "trend"     // 学习趋势曲线
  | "streak";   // 连续打卡

const WIDGET_META: Record<WidgetKey, { label: string; icon: string; desc: string }> = {
  welcome:  { label: "问候与座右铭", icon: "💡", desc: "时段问候 + 可编辑座右铭 + 每日语录" },
  weather:  { label: "天气", icon: "🌤️", desc: "当前城市天气（无需密钥）" },
  tasks:    { label: "今日任务", icon: "✅", desc: "随手记今日待办，本地保存" },
  pomodoro: { label: "番茄钟", icon: "⏳", desc: "25/5 专注计时，提升专注" },
  trend:    { label: "学习趋势", icon: "📈", desc: "每日学习量与记忆保持率" },
  streak:   { label: "连续打卡", icon: "🔥", desc: "展示连续学习天数" },
};

const DEFAULT_ORDER: WidgetKey[] = ["welcome", "weather", "tasks", "pomodoro", "trend", "streak"];

// 占整行（跨 2 列）的 widget
const WIDE: Set<WidgetKey> = new Set(["trend", "tasks"]);

const QUOTES = [
  "每一步都在靠近更好的自己。",
  "今天的努力，是明天的底气。",
  "把书读薄，把知识学厚。",
  "慢一点也没关系，只要一直在走。",
  "你背的每一个知识点，都在为未来铺路。",
  "专注当下，结果会自己到来。",
  "复习不是重复，而是让记忆生根。",
  "你不需要很厉害才能开始，但开始了就会变厉害。",
];

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
  const len = Math.max(words.length, retention.length);
  const xStep = (W - pad * 2) / (len - 1);
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
      <circle cx={W - pad} cy={H - pad - (retention[len - 1] / 100) * (H - pad * 2)} r="3.5" fill="var(--accent-purple)" />
      <circle cx={W - pad} cy={H - pad - (words[len - 1] / wMax) * (H - pad * 2) * 0.9} r="3.5" fill="var(--accent-teal)" />
    </svg>
  );
}

/* ─── 单个 Widget 外壳 ─── */
function WidgetShell({ title, icon, children, wide }: { title: string; icon: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`glass-card flex flex-col gap-3 p-4 sm:p-5 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
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
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

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
    <WidgetShell title="问候与座右铭" icon="💡">
      <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {greeting.icon} {greeting.text}，{""}
        <span style={{ color: "var(--accent-teal)" }}>xuebox</span> 为你准备好了
      </p>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          className="glass-input w-full px-3 py-1.5 text-sm"
          placeholder="写下你的座右铭…"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(motto); setEditing(true); }}
          className="text-left text-sm italic transition-colors hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-secondary)" }}
          title="点击编辑座右铭"
        >
          {motto || "写下一句属于你的座右铭，点击即可编辑"}
        </button>
      )}
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>“{quote}”</p>
    </WidgetShell>
  );
}

function WeatherWidget() {
  const [data, setData] = useState<{ temp: number; desc: string; city: string; icon: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    // 优先用浏览器地理；失败则用中国默认城市（IP 定位免 key 不稳，给个默认）
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
      } catch (e) {
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
  const [tasks, setTasks] = useState<{ id: number; text: string; done: boolean }[]>([]);
  const [input, setInput] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("xuebox_tasks_" + today);
      if (raw) setTasks(JSON.parse(raw));
    } catch {}
  }, [today]);
  useEffect(() => {
    try { localStorage.setItem("xuebox_tasks_" + today, JSON.stringify(tasks)); } catch {}
  }, [tasks, today]);

  const add = () => {
    const t = input.trim();
    if (!t) return;
    setTasks((p) => [...p, { id: Date.now(), text: t, done: false }]);
    setInput("");
  };

  return (
    <WidgetShell title="今日任务" icon="✅" wide>
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
      <div className="flex flex-col gap-1.5 max-h-40 overflow-auto">
        {tasks.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>还没有任务，写下今天要完成的事吧。</p>}
        {tasks.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: t.done ? "var(--text-muted)" : "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => setTasks((p) => p.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))}
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

function TrendWidget() {
  const words = useMemo(() => makeCurve(1.2, 12, 10, 1.1), []);
  const retention = useMemo(() => makeCurve(3.7, 55, 20, 2.2).map((v) => Math.min(100, Math.round(v))), []);
  return (
    <WidgetShell title="学习趋势" icon="📈" wide>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent-teal)" }} /> 每日学习量</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent-purple)" }} /> 记忆保持率</span>
      </div>
      <TrendChart words={words} retention={retention} />
    </WidgetShell>
  );
}

function StreakWidget() {
  const [streak, setStreak] = useState(1);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    try {
      const last = localStorage.getItem("xuebox_streak_last");
      const prev = Number(localStorage.getItem("xuebox_streak") || "1");
      if (last === today) { setStreak(prev); return; }
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const next = last === y ? prev + 1 : 1;
      setStreak(next);
      localStorage.setItem("xuebox_streak", String(next));
      localStorage.setItem("xuebox_streak_last", today);
    } catch {}
  }, [today]);

  return (
    <WidgetShell title="连续打卡" icon="🔥">
      <div className="flex items-center justify-between">
        <span className="text-3xl font-semibold" style={{ color: "var(--accent-coral)" }}>{streak}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>天连续学习</span>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>每天打开学盒就续上 🔥</p>
    </WidgetShell>
  );
}

const WIDGET_RENDER: Record<WidgetKey, () => React.ReactElement> = {
  welcome: () => <WelcomeWidget />,
  weather: () => <WeatherWidget />,
  tasks: () => <TasksWidget />,
  pomodoro: () => <PomodoroWidget />,
  trend: () => <TrendWidget />,
  streak: () => <StreakWidget />,
};

/* ════════════════ 主仪表盘（含自定义面板） ════════════════ */
export default function Dashboard() {
  const [order, setOrder] = useState<WidgetKey[]>(DEFAULT_ORDER);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("xuebox_dash_order");
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetKey[];
        // 保留已知 key，补回缺失的
        const known = parsed.filter((k) => k in WIDGET_META);
        const missing = DEFAULT_ORDER.filter((k) => !known.includes(k));
        setOrder([...known, ...missing]);
      }
    } catch {}
  }, []);
  const persist = (o: WidgetKey[]) => {
    setOrder(o);
    try { localStorage.setItem("xuebox_dash_order", JSON.stringify(o)); } catch {}
  };

  const toggle = (k: WidgetKey) => {
    if (order.includes(k)) persist(order.filter((x) => x !== k));
    else persist([...order, k]);
  };
  const move = (k: WidgetKey, dir: -1 | 1) => {
    const i = order.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>我的仪表盘</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>按你习惯自由搭配，点右侧「自定义」增删排序。</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="glass-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          style={{ borderColor: "rgba(45,212,191,0.25)", color: "var(--accent-teal)" }}
        >
          ⚙ 自定义
        </button>
      </div>

      {open && (
        <div className="glass-card flex flex-col gap-2 p-4">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>点击开关组件，用 ↑↓ 调整顺序（自动保存）</p>
          {(Object.keys(WIDGET_META) as WidgetKey[]).map((k) => {
            const on = order.includes(k);
            return (
              <div key={k} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                   style={{ background: on ? "rgba(45,212,191,0.06)" : "transparent" }}>
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(k)} className="accent-[var(--accent-teal)]" />
                  <span>{WIDGET_META[k].icon} {WIDGET_META[k].label}</span>
                </label>
                <div className="flex gap-1">
                  <button onClick={() => move(k, -1)} className="glass-btn px-2 py-0.5 text-xs" disabled={!on}>↑</button>
                  <button onClick={() => move(k, 1)} className="glass-btn px-2 py-0.5 text-xs" disabled={!on}>↓</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {order.map((k) => {
          const Render = WIDGET_RENDER[k];
          return <div key={k} className={WIDE.has(k) ? "sm:col-span-2 lg:col-span-2" : ""}>{<Render />}</div>;
        })}
      </div>
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
