-- ============================================================
--  xuebox / 学盒 · 增量迁移 v2（在已执行 membership.sql 的库上追加）
--  作用：题集分组(last_grade) + 用户标签(tags) + 收藏提纲(title/tags)
--  执行方式：Supabase 后台 → SQL Editor → 新建查询 → 粘贴本文件 → Run
--  说明：用 add column if not exists，可重复执行，不会报错。
-- ============================================================

-- cards：最近一次评分（用于 未学/薄弱/模糊/掌握 分组）+ 用户标签
alter table public.cards add column if not exists last_grade smallint;
alter table public.cards add column if not exists tags text[] not null default '{}';

-- generations：提纲标题 + 用户标签（收藏提纲用）
alter table public.generations add column if not exists title text;
alter table public.generations add column if not exists tags text[] not null default '{}';
