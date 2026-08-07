-- ────────────────────────────────────────
-- 错题集表：收集自测答错的题 + 将来用户上传的错题
-- origin 区分来源：'quiz'（自测产生）/ 'upload'（用户上传，后续接入）
-- 两个来源在 UI 中分组展示，互不打乱。
-- 在 Supabase SQL Editor 中新建查询、粘贴全部、Run。
-- ────────────────────────────────────────

create table if not exists public.mistakes (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references public.profiles(user_id) on delete cascade,
  origin       text not null default 'quiz' check (origin in ('quiz', 'upload')),
  question     text not null,
  options      jsonb not null,                 -- ["A","B","C","D"]
  answer       integer not null,               -- 正确选项下标
  picked       integer,                        -- 用户选错的选项下标（仅 quiz 来源有）
  explanation  text,                           -- 解析
  evidence     text,                           -- 溯源：原文依据引文
  source_text  text not null,                  -- 溯源：生成此题的源文本
  source_title text,                           -- 出处标题/摘要（可选）
  created_at   timestamptz not null default now()
);

create index if not exists mistakes_user_id_idx on public.mistakes(user_id);
create index if not exists mistakes_origin_idx on public.mistakes(user_id, origin);

alter table public.mistakes enable row level security;
