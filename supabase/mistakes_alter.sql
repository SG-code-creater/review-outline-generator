-- ============================================================
--  xuebox / 学盒 · 错题 AI 归因补充字段
--  前置：supabase/mistakes.sql 已执行（mistakes 表已存在）
--  执行方式：Supabase 后台 → SQL Editor → 粘贴 → Run
--  作用：给错题加「错因类型」与「薄弱知识点」，支持按错因分组复习
-- ============================================================

alter table public.mistakes add column if not exists cause text;
alter table public.mistakes add column if not exists weak_point text;

create index if not exists mistakes_cause_idx on public.mistakes (user_id, cause);
