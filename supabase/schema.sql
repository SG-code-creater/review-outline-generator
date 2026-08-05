-- 复习提纲生成器：使用记录表
-- 在 Supabase 控制台的 SQL Editor 中执行本文件即可建表。
-- 部署到 Vercel 前需要：1) 创建 Supabase 项目；2) 执行本 SQL；3) 配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY 环境变量。

create table if not exists public.usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model text not null default 'deepseek-chat',
  input_chars int not null default 0
);

-- 开启行级安全。服务端使用 service_role key，会绕过 RLS 直接写入；
-- 此处启用 RLS 作为最小权限示范，避免未来误用 anon key 导致越权。
alter table public.usage enable row level security;
