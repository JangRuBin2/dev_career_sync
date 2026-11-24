/** 순서대로 한 번씩 적용된다. 이미 배포된 항목은 수정하지 말고 새 항목을 추가할 것 */
export const MIGRATIONS: string[] = [
  /* 1: 사용자 · Notion 연결 · 설정 · AI 사용량 · 배치 기록 */ `
  create table users (
    id uuid primary key default gen_random_uuid(),
    github_id text not null unique,
    login text not null default '',
    avatar_url text,
    created_at timestamptz not null default now(),
    last_login_at timestamptz not null default now()
  );

  create table notion_connections (
    user_id uuid primary key references users(id) on delete cascade,
    access_token text not null,          -- 암호화
    refresh_token text,                  -- 암호화
    bot_id text not null,
    workspace_id text not null,
    workspace_name text,
    workspace_icon text,
    parent_page_id text,
    data_sources jsonb,                  -- { workLog, projects, ... } data source ID
    resume_page_id text,
    setup_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  create index notion_connections_workspace on notion_connections (workspace_id);

  create table user_settings (
    user_id uuid primary key references users(id) on delete cascade,
    resume_name text,
    resume_headline text,
    denylist text,                       -- 암호화
    velog_username text,
    post_interval_days int not null default 14,
    post_lead_days int not null default 3,
    notify_webhook_url text,             -- 암호화
    auto_digest boolean not null default true,
    updated_at timestamptz not null default now()
  );

  create table ai_usage (
    id bigserial primary key,
    user_id uuid not null references users(id) on delete cascade,
    kind text not null,
    created_at timestamptz not null default now()
  );
  create index ai_usage_user_time on ai_usage (user_id, created_at);

  create table job_runs (
    id bigserial primary key,
    user_id uuid not null references users(id) on delete cascade,
    job text not null,
    status text not null,                -- ok | skipped | error
    message text,
    started_at timestamptz not null default now(),
    finished_at timestamptz
  );
  create index job_runs_user_job on job_runs (user_id, job, started_at desc);
  `,
];
