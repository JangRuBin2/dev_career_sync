import "server-only";
import postgres from "postgres";
import { MIGRATIONS } from "./migrations";

/**
 * Postgres (Neon) 연결.
 * Vercel Marketplace 의 Neon 연동은 DATABASE_URL(풀링 주소)을 자동으로 넣어 준다.
 * - prepare:false — Neon pooler(PgBouncer transaction 모드)에서 필요
 * - 첫 쿼리 전에 마이그레이션을 한 번 적용한다 (advisory lock 으로 동시 실행 방지)
 */
export type Sql = postgres.Sql;

let client: Sql | null = null;
let ready: Promise<void> | null = null;

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function hasDatabase(): boolean {
  return Boolean(databaseUrl());
}

function raw(): Sql {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL 이 없습니다. Vercel → Storage → Neon 을 연결하세요.");
  client ??= postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  return client;
}

async function migrate(sql: Sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727274)`;
    await tx`create table if not exists schema_migrations (version int primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await tx<{ version: number }[]>`select version from schema_migrations`).map((r) => r.version));
    for (const [i, ddl] of MIGRATIONS.entries()) {
      const version = i + 1;
      if (done.has(version)) continue;
      await tx.unsafe(ddl);
      await tx`insert into schema_migrations (version) values (${version})`;
    }
  });
}

/** 마이그레이션이 적용된 SQL 클라이언트 */
export async function db(): Promise<Sql> {
  const sql = raw();
  ready ??= migrate(sql).catch((err) => {
    ready = null;
    throw err;
  });
  await ready;
  return sql;
}
