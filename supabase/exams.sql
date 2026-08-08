-- ============================================================
--  xuebox / 学盒 · 考试倒计时表（多考试管理，登录用户跨设备同步）
--  执行方式：Supabase 后台 → SQL Editor → 粘贴 → Run
--  前置：membership.sql 已执行（public.profiles 表存在）
-- ============================================================

create table if not exists public.exams (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(user_id) on delete cascade,
  title      text not null,                       -- 考试名称（如「高考数学」「期末英语」）
  exam_at    timestamptz not null,                -- 考试日期时间（用于倒计时）
  subject    text,                                -- 科目/分类（可选）
  color      text not null default 'teal',        -- 主题色 key：teal/purple/emerald/coral/amber/blue
  note       text,                                -- 备注（可选，如考场、复习重点）
  created_at timestamptz not null default now()
);

create index if not exists exams_user_exam_at_idx on public.exams (user_id, exam_at);
alter table public.exams enable row level security;
