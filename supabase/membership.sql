-- ============================================================
--  xuebox / 学盒 · 会员体系与数据底座 schema
--  说明：用户身份（密码/邮箱/OAuth）由 Clerk 托管，本项目不碰密码。
--       这里只存业务侧数据，用 Clerk 的 userId（sub）做关联键。
-- ============================================================

-- 1) 用户档案表：区分 普通用户(free) / 会员(member)
create table if not exists public.profiles (
  user_id           text primary key,                       -- = Clerk sub (claims.sub)
  email             text,
  plan              text not null default 'free'
                      check (plan in ('free', 'member')),
  member_since      timestamptz,                            -- 首次开通会员时间
  member_expires_at timestamptz,                            -- 会员到期时间（订阅制用）
  created_at        timestamptz not null default now()
);

-- 2) 生成历史表（做"历史提纲/卡片"功能时启用；当前前端未调用）
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references public.profiles(user_id) on delete cascade,
  kind        text not null check (kind in ('outline', 'flashcard')),
  input_text  text not null,
  result      jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists generations_user_id_idx on public.generations(user_id);
create index if not exists generations_created_at_idx on public.generations(created_at desc);

-- 3) 限额定义（文档化，实际判断在 route.ts 查 profiles.plan）
--    free    -> 20 次/天
--    member  -> 9999 次/天（视为不限）
--    anonymous(无 user_id) -> 5 次/天（按 ip，沿用现有 usage 表）

-- 4) Clerk Webhook（user.created/updated/deleted）→ 自动维护 profiles
--    需新建路由 src/app/api/clerk-webhook/route.ts，用 svix 校验签名后：
--      user.created   -> insert profiles(user_id, email, plan='free')
--      user.updated   -> update profiles(email)
--      user.deleted   -> delete from profiles where user_id = $sub
--    并在 Clerk Dashboard → Webhooks 配置端点 + 订阅上述事件。
