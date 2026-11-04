/**
 * 로컬 개발용 가짜 Notion API 서버 (메모리 저장, 샘플 데이터 포함).
 * 실제 Notion 없이 대시보드를 띄워 보거나 화면을 확인할 때 사용한다.
 *
 *   pnpm mock:notion            # http://localhost:4010
 *   NOTION_BASE_URL=http://localhost:4010 NOTION_TOKEN=mock ... pnpm dev
 *
 * 지원: data source query(필터 일부), page 조회/생성/수정, page markdown 조회/수정
 */
import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { DB_ENV, DB_KEYS, P, type DbKey } from "@careersync/core/notion";

type Prop = { type: string; [k: string]: unknown };
type Page = { object: "page"; id: string; url: string; parent: { data_source_id: string }; properties: Record<string, Prop>; markdown: string; created_time: string; last_edited_time: string };

const DS: Record<DbKey, string> = Object.fromEntries(DB_KEYS.map((k) => [k, `ds-${k}`])) as Record<DbKey, string>;
const pages = new Map<string, Page>();

// ---------- 속성 변환 (요청 형식 → 응답 형식) ----------
const rt = (s: string) => [{ type: "text", text: { content: s }, plain_text: s }];
function toResponseProp(v: Record<string, unknown>): Prop {
  if ("title" in v) return { type: "title", title: (v.title as { text: { content: string } }[]).map((t) => rt(t.text.content)[0]) };
  if ("rich_text" in v) return { type: "rich_text", rich_text: (v.rich_text as { text: { content: string } }[]).map((t) => rt(t.text.content)[0]) };
  if ("number" in v) return { type: "number", number: v.number };
  if ("checkbox" in v) return { type: "checkbox", checkbox: v.checkbox };
  if ("url" in v) return { type: "url", url: v.url };
  if ("select" in v) return { type: "select", select: v.select };
  if ("multi_select" in v) return { type: "multi_select", multi_select: v.multi_select };
  if ("date" in v) return { type: "date", date: v.date };
  if ("relation" in v) return { type: "relation", relation: v.relation };
  return { type: "unknown" };
}

function withFormula(page: Page): Page {
  if (page.parent.data_source_id !== DS.metrics) return page;
  const num = (k: string) => (page.properties[k] as { number?: number })?.number ?? 0;
  const dir = (page.properties[P.metrics.direction] as { select?: { name: string } })?.select?.name;
  const b = num(P.metrics.before);
  const a = num(P.metrics.after);
  const rate = b === 0 ? 0 : Math.round(((dir === "낮을수록 좋음" ? b - a : a - b) / b) * 1000) / 10;
  return { ...page, properties: { ...page.properties, [P.metrics.improvement]: { type: "formula", formula: { type: "number", number: rate } } } };
}

function insert(key: DbKey, props: Record<string, Record<string, unknown>>, markdown = "", id: string = randomUUID()) {
  const now = new Date().toISOString();
  const properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, toResponseProp(v)]));
  const page: Page = { object: "page", id, url: `https://www.notion.so/mock-${id.replace(/-/g, "")}`, parent: { data_source_id: DS[key] }, properties, markdown, created_time: now, last_edited_time: now };
  pages.set(id, page);
  return page;
}

// ---------- 샘플 데이터 ----------
const t = (s: string) => ({ title: [{ text: { content: s } }] });
const x = (s: string) => ({ rich_text: [{ text: { content: s } }] });
const sel = (s: string | null) => ({ select: s ? { name: s } : null });
const ms = (a: string[]) => ({ multi_select: a.map((name) => ({ name })) });
const rel = (ids: string[]) => ({ relation: ids.map((id) => ({ id })) });
const date = (start: string, end: string | null = null) => ({ date: { start, end } });

function seed() {
  const p1 = insert("projects", {
    [P.projects.name]: t("결제 시스템 고도화"),
    [P.projects.period]: date("2026-03-01"),
    [P.projects.role]: x("백엔드 리드"),
    [P.projects.stack]: ms(["Node.js", "PostgreSQL", "Redis"]),
    [P.projects.summary]: x("결제 API 성능·안정성 개선과 정산 배치 재설계"),
    [P.projects.status]: sel("진행중"),
    [P.projects.publicUrl]: { url: "https://example.com" },
    [P.projects.resumeOrder]: { number: 1 },
    [P.projects.onResume]: { checkbox: true },
  }).id;
  const p2 = insert("projects", {
    [P.projects.name]: t("사내 디자인 시스템 구축"),
    [P.projects.period]: date("2025-09-01", "2026-02-28"),
    [P.projects.role]: x("프론트엔드"),
    [P.projects.stack]: ms(["React", "TypeScript", "Storybook"]),
    [P.projects.summary]: x("공통 컴포넌트 40종 정리와 문서화"),
    [P.projects.status]: sel("완료"),
    [P.projects.resumeOrder]: { number: 2 },
    [P.projects.onResume]: { checkbox: true },
  }).id;

  const l1 = insert("workLog", {
    [P.workLog.title]: t("결제 승인 API 인덱스 튜닝"),
    [P.workLog.date]: date("2026-11-02"),
    [P.workLog.content]: x("승인 내역 조회 쿼리에 복합 인덱스 추가. p95 820ms → 490ms. 슬로우쿼리 로그로 원인 확인"),
    [P.workLog.type]: sel("성능개선"),
    [P.workLog.tags]: ms(["PostgreSQL"]),
    [P.workLog.processed]: { checkbox: true },
    [P.workLog.blogIdea]: { checkbox: true },
  }).id;
  const l2 = insert("workLog", {
    [P.workLog.title]: t("정산 배치 재시도 로직"),
    [P.workLog.date]: date("2026-11-03"),
    [P.workLog.content]: x("외부 PG 타임아웃 시 지수 백오프 재시도. 실패 건수 120건 → 8건"),
    [P.workLog.type]: sel("트러블슈팅"),
    [P.workLog.processed]: { checkbox: true },
  }).id;
  insert("workLog", {
    [P.workLog.title]: t("코드리뷰 가이드 초안"),
    [P.workLog.date]: date("2026-11-04"),
    [P.workLog.content]: x("팀 코드리뷰 체크리스트 작성"),
    [P.workLog.type]: sel("협업"),
  });

  const r1 = insert("records", {
    [P.records.title]: t("2026-W45 결제 API 응답속도 개선"),
    [P.records.period]: date("2026-11-02", "2026-11-06"),
    [P.records.cadence]: sel("주간"),
    [P.records.summary]: x("승인 내역 조회의 슬로우 쿼리를 분석해 복합 인덱스를 추가했다. 정산 배치에는 지수 백오프 재시도를 넣어 외부 PG 타임아웃 실패를 줄였다."),
    [P.records.highlights]: x("• p95 응답시간 40% 단축\n• 정산 실패 건 93% 감소"),
    [P.records.role]: x("원인 분석과 개선 주도"),
    [P.records.tech]: ms(["PostgreSQL", "Node.js"]),
    [P.records.project]: rel([p1]),
    [P.records.logs]: rel([l1, l2]),
    [P.records.status]: sel("초안"),
    [P.records.origin]: sel("자동"),
  }).id;
  insert("metrics", {
    [P.metrics.name]: t("결제 승인 API p95"),
    [P.metrics.category]: sel("성능"),
    [P.metrics.before]: { number: 820 },
    [P.metrics.after]: { number: 490 },
    [P.metrics.unit]: sel("ms"),
    [P.metrics.direction]: sel("낮을수록 좋음"),
    [P.metrics.method]: x("슬로우쿼리 로그 기준, 배포 전후 비교"),
    [P.metrics.confidence]: sel("직접 측정"),
    [P.metrics.evidence]: x('원문: "p95 820ms → 490ms"'),
    [P.metrics.record]: rel([r1]),
    [P.metrics.status]: sel("초안"),
  });
  insert("metrics", {
    [P.metrics.name]: t("정산 배치 실패 건수"),
    [P.metrics.category]: sel("품질"),
    [P.metrics.before]: { number: 120 },
    [P.metrics.after]: { number: 8 },
    [P.metrics.unit]: sel("건"),
    [P.metrics.direction]: sel("낮을수록 좋음"),
    [P.metrics.method]: x("원문에 측정 방법 없음 — 확인 필요"),
    [P.metrics.confidence]: sel("추정"),
    [P.metrics.record]: rel([r1]),
    [P.metrics.status]: sel("초안"),
  });

  insert("achievements", {
    [P.achievements.text]: t("복합 인덱스 설계로 결제 승인 API p95 응답시간 40% 단축"),
    [P.achievements.records]: rel([r1]),
    [P.achievements.suggestedProject]: x("결제 시스템 고도화"),
    [P.achievements.suggestedProjectId]: x(p1),
    [P.achievements.confidence]: { number: 0.91 },
    [P.achievements.assignment]: sel("추천됨"),
    [P.achievements.exposure]: ms(["이력서", "포트폴리오"]),
  });
  insert("achievements", {
    [P.achievements.text]: t("외부 연동 재시도 정책 도입으로 정산 실패 건 93% 감소"),
    [P.achievements.records]: rel([r1]),
    [P.achievements.suggestedProject]: x("정산 안정화"),
    [P.achievements.suggestedProjectId]: x(""),
    [P.achievements.confidence]: { number: 0.55 },
    [P.achievements.assignment]: sel("추천됨"),
    [P.achievements.exposure]: ms(["이력서"]),
  });
  insert("achievements", {
    [P.achievements.text]: t("공통 컴포넌트 40종을 정리해 화면 개발 리드타임 단축"),
    [P.achievements.project]: rel([p2]),
    [P.achievements.assignment]: sel("확인됨"),
    [P.achievements.exposure]: ms(["이력서"]),
    [P.achievements.order]: { number: 1 },
  });

  const soon = new Date(Date.now() + 3 * 86400_000).toISOString();
  insert(
    "posts",
    {
      [P.posts.title]: t("슬로우 쿼리 로그로 결제 API 40% 빠르게 만들기"),
      [P.posts.status]: sel("검토대기"),
      [P.posts.mode]: sel("공개"),
      [P.posts.scheduledAt]: date(soon),
      [P.posts.reviewed]: { checkbox: false },
      [P.posts.tags]: ms(["PostgreSQL", "성능"]),
      [P.posts.project]: rel([p1]),
    },
    "## 문제 상황\n결제 승인 내역 조회가 느려졌다.\n\n## 원인 분석\nTODO: 실행 계획 캡처\n\n## 해결\n복합 인덱스 추가\n\n## 결과\np95 40% 단축",
  );
  insert("posts", { [P.posts.title]: t("지수 백오프 재시도, 언제 써야 할까"), [P.posts.status]: sel("소재") }, `> 관점: 외부 연동 실패를 줄이는 재시도 설계\n\n근거 로그:\n- ${l2}`);
  insert("posts", {
    [P.posts.title]: t("Storybook 으로 디자인 시스템 문서화한 후기"),
    [P.posts.status]: sel("발행됨"),
    [P.posts.mode]: sel("공개"),
    [P.posts.url]: { url: "https://velog.io/@me/storybook" },
    [P.posts.publishedAt]: date("2026-02-20"),
    [P.posts.project]: rel([p2]),
  });
  insert("attachments", {
    [P.attachments.name]: t("example.com"),
    [P.attachments.kind]: sel("링크"),
    [P.attachments.linkUrl]: { url: "https://example.com" },
    [P.attachments.visibility]: sel("공개가능"),
    [P.attachments.caption]: x("서비스 소개 페이지"),
    [P.attachments.project]: rel([p1]),
  });
}

// ---------- 필터 ----------
type Filter = { and?: Filter[]; or?: Filter[]; property?: string; [k: string]: unknown };
function matches(page: Page, f?: Filter): boolean {
  if (!f) return true;
  if (f.and) return f.and.every((g) => matches(page, g));
  if (f.or) return f.or.some((g) => matches(page, g));
  const prop = page.properties[f.property ?? ""] as Record<string, unknown> | undefined;
  if (!prop) return false;
  if (f.checkbox) return prop.checkbox === (f.checkbox as { equals: boolean }).equals;
  if (f.select) return (prop.select as { name?: string } | null)?.name === (f.select as { equals: string }).equals;
  if (f.relation) return ((prop.relation as { id: string }[]) ?? []).some((r) => r.id === (f.relation as { contains: string }).contains);
  if (f.date) {
    const start = (prop.date as { start?: string } | null)?.start ?? "";
    const after = (f.date as { on_or_after?: string }).on_or_after;
    return after ? start >= after : true;
  }
  return true;
}

// ---------- 서버 ----------
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const PORT = Number(process.env.MOCK_NOTION_PORT ?? 4010);
seed();

createServer(async (req, res) => {
  const send = (status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname.replace(/^\/v1/, "");
    let m: RegExpMatchArray | null;

    if (req.method === "POST" && (m = path.match(/^\/data_sources\/([^/]+)\/query$/))) {
      const b = await body(req);
      const results = [...pages.values()].filter((p) => p.parent.data_source_id === m![1] && matches(p, b.filter as Filter)).map(withFormula);
      return send(200, { object: "list", results, has_more: false, next_cursor: null, type: "page_or_data_source", page_or_data_source: {} });
    }
    if (req.method === "GET" && (m = path.match(/^\/pages\/([^/]+)\/markdown$/))) {
      const p = pages.get(m[1]!);
      return p ? send(200, { object: "page_markdown", id: p.id, markdown: p.markdown, truncated: false, unknown_block_ids: [] }) : send(404, { object: "error", code: "object_not_found", message: "not found" });
    }
    if (req.method === "PATCH" && (m = path.match(/^\/pages\/([^/]+)\/markdown$/))) {
      const p = pages.get(m[1]!);
      const b = (await body(req)) as { replace_content?: { new_str: string } };
      if (p && b.replace_content) p.markdown = b.replace_content.new_str;
      return p ? send(200, { object: "page_markdown", id: p.id, markdown: p.markdown, truncated: false, unknown_block_ids: [] }) : send(404, { object: "error", code: "object_not_found", message: "not found" });
    }
    if (req.method === "GET" && (m = path.match(/^\/pages\/([^/]+)$/))) {
      const p = pages.get(m[1]!);
      return p ? send(200, withFormula(p)) : send(404, { object: "error", code: "object_not_found", message: "not found" });
    }
    if (req.method === "PATCH" && (m = path.match(/^\/pages\/([^/]+)$/))) {
      const p = pages.get(m[1]!);
      if (!p) return send(404, { object: "error", code: "object_not_found", message: "not found" });
      const b = (await body(req)) as { properties?: Record<string, Record<string, unknown>> };
      for (const [k, v] of Object.entries(b.properties ?? {})) p.properties[k] = toResponseProp(v);
      p.last_edited_time = new Date().toISOString();
      return send(200, withFormula(p));
    }
    if (req.method === "POST" && path === "/pages") {
      const b = (await body(req)) as { parent: { data_source_id?: string; page_id?: string }; properties?: Record<string, Record<string, unknown>>; markdown?: string };
      const key = (Object.entries(DS).find(([, v]) => v === b.parent.data_source_id)?.[0] ?? "posts") as DbKey;
      const page = insert(key, b.properties ?? {}, b.markdown ?? "");
      return send(200, withFormula(page));
    }
    send(404, { object: "error", code: "invalid_request_url", message: `mock 미지원: ${req.method} ${path}` });
  } catch (err) {
    send(500, { object: "error", code: "internal_server_error", message: String(err) });
  }
}).listen(PORT, () => {
  console.log(`mock Notion API → http://localhost:${PORT}`);
  console.log("대시보드용 환경변수:");
  console.log(`NOTION_BASE_URL=http://localhost:${PORT}\nNOTION_TOKEN=mock\nNOTION_RESUME_PAGE_ID=resume-page`);
  for (const k of DB_KEYS) console.log(`${DB_ENV[k]}=${DS[k]}`);
});

// 이력서 페이지 (markdown 갱신 대상)
pages.set("resume-page", { object: "page", id: "resume-page", url: "https://www.notion.so/mock-resume", parent: { data_source_id: "" }, properties: {}, markdown: "", created_time: "", last_edited_time: "" });
