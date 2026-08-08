"use client";

import { useState, useEffect, useMemo } from "react";

// 考试倒计时视图：多考试管理 + 实时倒计时。
// 数据落在 exams 表（user_id 隔离），通过 /api/exams 增删改查。

type Exam = {
  id: string;
  title: string;
  exam_at: string; // ISO
  subject: string | null;
  color: string;
  note: string | null;
  created_at: string;
};

const COLOR_HEX: Record<string, string> = {
  teal: "#2dd4bf",
  emerald: "#34d399",
  purple: "#a78bfa",
  coral: "#fb7185",
  amber: "#fbbf24",
  blue: "#60a5fa",
};
const COLOR_KEYS = Object.keys(COLOR_HEX);

// 把 ISO 转成本地 datetime-local 输入值（YYYY-MM-DDTHH:mm）
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

// 友好展示日期：2026年9月1日 周二 10:00
function formatExamDate(iso: string): string {
  const d = new Date(iso);
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${week} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 倒计时拆分
function diffParts(targetMs: number, nowMs: number) {
  const ms = targetMs - nowMs;
  if (ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="font-bold tabular-nums leading-none"
        style={{ fontSize: "1.9rem", color: "var(--text-primary)" }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

export default function ExamsView({ isSignedIn }: { isSignedIn?: boolean }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  // 实时「现在」——每秒刷新驱动倒计时
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2600);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formExamAt, setFormExamAt] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formColor, setFormColor] = useState("teal");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const res = await fetch("/api/exams", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "加载失败");
      setExams(data.exams || []);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSignedIn) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  // 拆分：未结束（升序）在前，已结束（降序）在后
  const { upcoming, past } = useMemo(() => {
    const up: Exam[] = [];
    const pa: Exam[] = [];
    for (const e of exams) {
      if (new Date(e.exam_at).getTime() > now) up.push(e);
      else pa.push(e);
    }
    up.sort((a, b) => new Date(a.exam_at).getTime() - new Date(b.exam_at).getTime());
    pa.sort((a, b) => new Date(b.exam_at).getTime() - new Date(a.exam_at).getTime());
    return { upcoming: up, past: pa };
  }, [exams, now]);

  const nextExam = upcoming[0] ?? null;
  const nextParts = nextExam ? diffParts(new Date(nextExam.exam_at).getTime(), now) : null;

  function openAdd() {
    setEditingId(null);
    setFormTitle("");
    setFormSubject("");
    setFormNote("");
    setFormColor("teal");
    // 默认填一个稍后的时间，方便用户改
    const d = new Date(Date.now() + 7 * 86400000);
    setFormExamAt(isoToLocalInput(d.toISOString()));
    setShowForm(true);
  }

  function openEdit(e: Exam) {
    setEditingId(e.id);
    setFormTitle(e.title);
    setFormSubject(e.subject || "");
    setFormNote(e.note || "");
    setFormColor(e.color || "teal");
    setFormExamAt(isoToLocalInput(e.exam_at));
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function submitForm() {
    if (!formTitle.trim()) {
      setToast("请填写考试名称。");
      return;
    }
    if (!formExamAt || isNaN(Date.parse(formExamAt))) {
      setToast("请选择考试日期时间。");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        exam_at: new Date(formExamAt).toISOString(),
        subject: formSubject.trim() || null,
        color: formColor,
        note: formNote.trim() || null,
      };
      let res: Response;
      if (editingId) {
        res = await fetch("/api/exams", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        res = await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "保存失败");
      setToast(editingId ? "已更新 ✅" : "已添加考试 ✅");
      closeForm();
      await loadAll();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeExam(id: string) {
    try {
      const res = await fetch(`/api/exams?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "删除失败");
      setExams((prev) => prev.filter((e) => e.id !== id));
      setToast("已删除");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "删除失败");
    }
  }

  if (!isSignedIn) {
    return (
      <section className="glass-card flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ background: "rgba(251,191,36,0.12)", color: "var(--accent-amber)" }}>⏰</div>
        <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>考试倒计时</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>登录后即可添加考试、实时查看倒计时，多端同步。</p>
        <a href="https://accounts.xuebox.me/sign-in?redirect_url=https%3A%2F%2Fxuebox.me%2F"
          className="btn-primary-glow px-5 py-2 text-sm">登录 / 注册</a>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>考试倒计时</h2>
          <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            添加你的考试，随时掌握备考节奏。支持多考试并行管理。
          </p>
        </div>
        {!showForm && (
          <button onClick={openAdd}
            className="btn-primary-glow px-4 py-2 text-sm">+ 添加考试</button>
        )}
      </div>

      {/* ─── 最近考试大倒计时 ─── */}
      {nextExam && nextParts ? (
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
          style={{
            background: `linear-gradient(135deg, ${COLOR_HEX[nextExam.color]}1f, rgba(255,255,255,0.02))`,
            border: `1px solid ${COLOR_HEX[nextExam.color]}40`,
            boxShadow: `0 0 40px ${COLOR_HEX[nextExam.color]}18`,
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[nextExam.color] }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              最近考试{nextExam.subject ? ` · ${nextExam.subject}` : ""}
            </span>
          </div>
          <h3 className="mt-2 text-2xl font-bold sm:text-3xl" style={{ color: "var(--text-primary)" }}>
            {nextExam.title}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{formatExamDate(nextExam.exam_at)}</p>

          <div className="mt-5 flex items-end gap-3 sm:gap-5">
            <CountUnit value={nextParts.days} label="天" />
            <span className="pb-1 text-2xl font-light" style={{ color: "var(--text-muted)" }}>:</span>
            <CountUnit value={nextParts.hours} label="时" />
            <span className="pb-1 text-2xl font-light" style={{ color: "var(--text-muted)" }}>:</span>
            <CountUnit value={nextParts.minutes} label="分" />
            <span className="pb-1 text-2xl font-light" style={{ color: "var(--text-muted)" }}>:</span>
            <CountUnit value={nextParts.seconds} label="秒" />
          </div>
        </div>
      ) : (
        !loading && (
          <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
            <div className="text-3xl">🎯</div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              暂无即将到来的考试，点击「添加考试」开始规划吧。
            </p>
          </div>
        )
      )}

      {/* ─── 新增 / 编辑表单 ─── */}
      {showForm && (
        <div className="glass-card flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {editingId ? "编辑考试" : "添加考试"}
            </h3>
            <button onClick={closeForm} className="text-xs underline opacity-60 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}>取消</button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>考试名称 *</label>
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                placeholder="如：高考数学 / 期末英语"
                className="glass-input px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>考试日期时间 *</label>
              <input type="datetime-local" value={formExamAt} onChange={(e) => setFormExamAt(e.target.value)}
                className="glass-input px-3 py-2 text-sm [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>科目 / 分类</label>
              <input value={formSubject} onChange={(e) => setFormSubject(e.target.value)}
                placeholder="如：数学 / 英语（可选）"
                className="glass-input px-3 py-2 text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>备注</label>
              <input value={formNote} onChange={(e) => setFormNote(e.target.value)}
                placeholder="如：考场、复习重点（可选）"
                className="glass-input px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>主题色</label>
            <div className="flex items-center gap-2">
              {COLOR_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => setFormColor(k)}
                  aria-label={`颜色 ${k}`}
                  className="h-7 w-7 rounded-full transition-all duration-150"
                  style={{
                    background: COLOR_HEX[k],
                    outline: formColor === k ? `2px solid ${COLOR_HEX[k]}` : "none",
                    outlineOffset: formColor === k ? 3 : 0,
                    transform: formColor === k ? "scale(1.1)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={closeForm}
              className="glass-btn px-4 py-2 text-sm font-medium">取消</button>
            <button onClick={submitForm} disabled={saving}
              className="btn-primary-glow px-5 py-2 text-sm disabled:opacity-50">
              {saving ? "保存中…" : editingId ? "保存修改" : "添加考试"}
            </button>
          </div>
        </div>
      )}

      {/* ─── 即将到来的考试列表 ─── */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>即将到来（{upcoming.length}）</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {upcoming.map((e) => {
              const p = diffParts(new Date(e.exam_at).getTime(), now);
              const hex = COLOR_HEX[e.color] || COLOR_HEX.teal;
              return (
                <div key={e.id}
                  className="glass-card flex flex-col gap-3 p-4"
                  style={{ borderColor: `${hex}30` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} />
                      <h4 className="truncate text-base font-semibold" style={{ color: "var(--text-primary)" }}>{e.title}</h4>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openEdit(e)} className="text-xs underline opacity-60 hover:opacity-100"
                        style={{ color: "var(--text-muted)" }}>编辑</button>
                      <button onClick={() => removeExam(e.id)} className="text-xs underline opacity-60 hover:opacity-100"
                        style={{ color: "var(--accent-coral)" }}>删除</button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: hex }}>
                      {p ? p.days : 0}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>天后</span>
                    <span className="ml-2 text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {p ? `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}:${String(p.seconds).padStart(2, "0")}` : "00:00:00"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{formatExamDate(e.exam_at)}</span>
                    {e.subject && (
                      <span className="rounded-full px-2 py-0.5" style={{ background: `${hex}18`, color: hex }}>{e.subject}</span>
                    )}
                  </div>
                  {e.note && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{e.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 已结束的考试 ─── */}
      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>已结束（{past.length}）</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {past.map((e) => {
              const hex = COLOR_HEX[e.color] || COLOR_HEX.teal;
              return (
                <div key={e.id}
                  className="glass-card flex items-center justify-between gap-2 p-4 opacity-70"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-2 w-2 rounded-full" style={{ background: hex }} />
                      <h4 className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</h4>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{formatExamDate(e.exam_at)}</p>
                  </div>
                  <button onClick={() => removeExam(e.id)} className="text-xs underline opacity-60 hover:opacity-100 shrink-0"
                    style={{ color: "var(--accent-coral)" }}>删除</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>加载中…</p>
      )}

      {toast && (
        <div className="glass-toast fixed bottom-6 left-1/2 z-50 px-5 py-2.5 text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}
    </section>
  );
}
