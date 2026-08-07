-- ============================================================
--  xuebox / 学盒 · 会员体系与数据底座 schema（v2：新增 cards + 间隔重复）
--  说明：用户身份（密码/邮箱/OAuth）由 Clerk 托管，本项目不碰密码。
--       这里只存业务侧数据，用 Clerk 的 userId（sub）做关联键。
--  执行方式：复制本文件全部内容，到 Supabase 后台 → SQL Editor → 粘贴 → Run。
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

-- 2) 生成历史表（做"历史提纲/卡片"功能时启用）
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references public.profiles(user_id) on delete cascade,
  kind        text not null check (kind in ('outline', 'flashcard')),
  input_text  text not null,
  result      jsonb not null,
  title       text,                              -- 提纲标题（取首行或用户填写），收藏提纲用
  tags        text[] not null default '{}',      -- 用户自定义分类标签（收藏提纲/卡片）
  created_at  timestamptz not null default now()
);
create index if not exists generations_user_id_idx on public.generations(user_id);
create index if not exists generations_created_at_idx on public.generations(created_at desc);

-- 3) 知识点卡片表（用户保存的闪卡，支撑"我的复习"与间隔重复 SM-2）
create table if not exists public.cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.profiles(user_id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  topic         text not null,
  question      text not null,
  answer        text not null,
  -- SM-2 间隔重复字段
  due_at        timestamptz not null default now(),   -- 下次应复习时间
  interval_days integer not null default 0,            -- 当前间隔（天）
  ease_factor   real not null default 2.5,             -- 难度系数（>=1.3）
  repetitions   integer not null default 0,            -- 连续答对次数
  last_reviewed timestamptz,                           -- 上次复习时间
  last_grade    smallint,                              -- 最近一次评分(1忘记/3模糊/5记得)，用于题集分组
  tags          text[] not null default '{}',          -- 用户自定义分类标签（题集）
  created_at    timestamptz not null default now()
);
create index if not exists cards_user_id_idx on public.cards(user_id);
create index if not exists cards_due_at_idx on public.cards(user_id, due_at);

-- 4) RLS 安全基线（服务端一律用 service_role key，自动绕过 RLS；
--    此处开启仅防止用 anon key 的客户端直连泄露数据）
alter table public.profiles    enable row level security;
alter table public.generations enable row level security;
alter table public.cards       enable row level security;

-- 5) Clerk Webhook（user.created/updated/deleted）→ 自动维护 profiles
--    需新建路由 src/app/api/clerk-webhook/route.ts，用 svix 校验签名后：
--      user.created   -> insert profiles(user_id, email, plan='free')
--      user.updated   -> update profiles(email)
--      user.deleted   -> delete from profiles where user_id = $sub
--    并在 Clerk Dashboard → Webhooks 配置端点 + 订阅上述事件。
--    （注：保存卡片的接口会先 upsert profiles，因此即使暂不配 webhook，
--      核心"保存/复习"功能也可正常工作。）
