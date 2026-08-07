-- ============================================================
--  xuebox / 学盒 · 今日任务表（登录用户跨设备同步）
--  执行方式：Supabase 后台 → SQL Editor → 粘贴 → Run
--  前置：membership.sql 已执行（public.profiles 表存在）
-- ============================================================

create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(user_id) on delete cascade,
  date       text not null,                       -- 任务所属日期 YYYY-MM-DD
  text       text not null,
  done       boolean not null default false,
  position   integer not null default 0,          -- 手动排序
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, date);
alter table public.tasks enable row level security;
