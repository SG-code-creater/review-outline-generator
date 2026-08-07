-- ============================================================
--  学盒 xuebox · 数据库全量初始化（清空重建版）
--  适用：开发/测试阶段，想把数据库恢复到干净初始状态时使用。
--  执行：Supabase 后台 → SQL Editor → 新建查询 → 粘贴全部 → Run
--
--  ⚠️ 警告：第 0 段的 DROP 会删除全部数据（卡片 / 提纲 / 错题 / 使用记录），
--     且不可恢复！仅在你确认没有需要保留的数据时执行。
--     若只想增量补表，请删掉第 0 段再执行。
-- ============================================================


-- ---------- 0) 清空旧表（如不存在则跳过）----------
drop table if exists public.mistakes    cascade;
drop table if exists public.cards       cascade;
drop table if exists public.generations cascade;
drop table if exists public.profiles    cascade;
drop table if exists public.usage       cascade;


-- ---------- 1) profiles：用户档案表 ----------
-- 作用：每个登录用户一行，区分 free / member。
--       cards / generations / mistakes 都通过 user_id 关联它。
-- 身份（密码/邮箱/OAuth）由 Clerk 托管，本项目不存密码。
create table if not exists public.profiles (
  user_id           text primary key,                       -- = Clerk sub (claims.sub)
  email             text,
  plan              text not null default 'free'
                      check (plan in ('free', 'member')),
  member_since      timestamptz,                            -- 首次开通会员时间
  member_expires_at timestamptz,                            -- 会员到期时间
  created_at        timestamptz not null default now()
);


-- ---------- 2) generations：生成历史表（收藏的提纲 / 闪卡原稿）----------
-- 作用：保存每次生成的提纲或闪卡，支撑"收藏提纲"列表与历史回看。
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text references public.profiles(user_id) on delete cascade,
  kind        text not null check (kind in ('outline', 'flashcard')),
  input_text  text not null,                                -- 用户原始输入文本
  result      jsonb not null,                               -- 生成的提纲/卡片结构
  title       text,                                         -- 提纲标题（收藏提纲用）
  tags        text[] not null default '{}',                 -- 用户自定义标签
  created_at  timestamptz not null default now()
);
create index if not exists generations_user_id_idx on public.generations(user_id);
create index if not exists generations_created_at_idx on public.generations(created_at desc);


-- ---------- 3) cards：知识点卡片表（我的复习 / 间隔重复）----------
-- 作用：用户保存的闪卡，支撑 SM-2 间隔重复与题集分组（未学/薄弱/模糊/掌握）。
create table if not exists public.cards (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references public.profiles(user_id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  topic         text not null,
  question      text not null,
  answer        text not null,
  due_at        timestamptz not null default now(),         -- 下次应复习时间
  interval_days integer not null default 0,                 -- 当前间隔（天）
  ease_factor   real not null default 2.5,                  -- 难度系数（>=1.3）
  repetitions   integer not null default 0,                 -- 连续答对次数
  last_reviewed timestamptz,                                -- 上次复习时间
  last_grade    smallint,                                   -- 最近评分(1忘记/3模糊/5记得)，用于分组
  tags          text[] not null default '{}',               -- 用户自定义标签
  created_at    timestamptz not null default now()
);
create index if not exists cards_user_id_idx on public.cards(user_id);
create index if not exists cards_due_at_idx on public.cards(user_id, due_at);


-- ---------- 4) mistakes：错题本表（自测错题 + 将来上传错题）----------
-- 作用：收集自测答错的题；origin 区分 'quiz'(自测) / 'upload'(上传，后续接入)。
--       evidence / source_text / source_title 用于"溯源 + 原文高亮"。
create table if not exists public.mistakes (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references public.profiles(user_id) on delete cascade,
  origin       text not null default 'quiz' check (origin in ('quiz', 'upload')),
  question     text not null,
  options      jsonb not null,                              -- ["A","B","C","D"]
  answer       integer not null,                            -- 正确选项下标
  picked       integer,                                      -- 用户选错的选项下标（仅 quiz 有）
  explanation  text,                                         -- 解析
  evidence     text,                                         -- 溯源：原文依据引文
  source_text  text not null,                                -- 溯源：生成此题的源文本
  source_title text,                                         -- 出处标题/摘要（可选）
  created_at   timestamptz not null default now()
);
create index if not exists mistakes_user_id_idx on public.mistakes(user_id);
create index if not exists mistakes_origin_idx on public.mistakes(user_id, origin);


-- ---------- 5) usage：使用记录表（接口限次统计，可选）----------
-- 作用：按 ip / user_id 统计调用次数，用于免费额度限制。
--       ⚠️ 当前 plan 分级限次尚未启用，此表暂为预留，可保留无害。
create table if not exists public.usage (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  model       text not null default 'deepseek-chat',
  input_chars int not null default 0,
  ip          text,
  user_id     text
);
create index if not exists usage_ip_created_at_idx on public.usage (ip, created_at);
create index if not exists usage_user_id_created_at_idx on public.usage (user_id, created_at);


-- ---------- 6) 统一开启行级安全 RLS ----------
-- 服务端一律用 service_role key，自动绕过 RLS；开启仅防止 anon key 直连泄露数据。
alter table public.profiles    enable row level security;
alter table public.generations enable row level security;
alter table public.cards       enable row level security;
alter table public.mistakes    enable row level security;
alter table public.usage       enable row level security;
