-- 最近打开的 PDF 文档（PDF 问答快速重开，仅本人可见，零成本）
-- 与 exams / 错题本 同款模式：数据落在用户自己的 Supabase 账户内，RLS 隔离。
-- 文字在浏览器本地提取后保存到本表，便于下次免重新上传直接重开（不上传第三方）。

create table if not exists public.recent_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  text text not null,
  char_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists recent_docs_user_idx
  on public.recent_docs (user_id, created_at desc);

-- 同一用户同名文件只保留一条（重开时更新内容与时间，而非新增）
create unique index if not exists recent_docs_user_name_idx
  on public.recent_docs (user_id, file_name);

alter table public.recent_docs enable row level security;

drop policy if exists "recent_docs_select" on public.recent_docs;
create policy "recent_docs_select" on public.recent_docs
  for select using (auth.uid() = user_id);

drop policy if exists "recent_docs_upsert" on public.recent_docs;
create policy "recent_docs_upsert" on public.recent_docs
  for insert with check (auth.uid() = user_id);

drop policy if exists "recent_docs_update" on public.recent_docs;
create policy "recent_docs_update" on public.recent_docs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recent_docs_delete" on public.recent_docs;
create policy "recent_docs_delete" on public.recent_docs
  for delete using (auth.uid() = user_id);
