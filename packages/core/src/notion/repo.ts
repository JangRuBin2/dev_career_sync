import { collectPaginatedAPI, isFullPage, type Client } from "./sdk";
import type { DataSourceIds } from "./client";
import { P, type AssignmentStatus, type DbKey, type PostMode, type PostStatus, type Visibility } from "./schema";
import { write as w, type Props } from "./props";
import * as m from "./mappers";
import type { Achievement, Attachment, Metric, Post, Project, RecordEntry, WorkLog } from "./types";

type QueryArgs = Parameters<Client["dataSources"]["query"]>[0];
type Filter = QueryArgs["filter"];
type Sorts = QueryArgs["sorts"];
type CreateArgs = Parameters<Client["pages"]["create"]>[0];
type PageProps = NonNullable<CreateArgs["properties"]>;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * CareerSync 의 Notion 접근 계층.
 * 웹(대시보드)과 배치(jobs)가 함께 사용한다.
 */
export class CareerRepo {
  constructor(
    private readonly notion: Client,
    private readonly ds: DataSourceIds,
  ) {}

  // ---------- 공통 ----------

  private async queryAll(key: DbKey, filter?: Filter, sorts?: Sorts) {
    const rows = await collectPaginatedAPI(this.notion.dataSources.query, {
      data_source_id: this.ds[key],
      ...(filter ? { filter } : {}),
      ...(sorts ? { sorts } : {}),
    });
    return rows.filter((r): r is Extract<typeof r, { object: "page" }> & { properties: Props } =>
      r.object === "page" && isFullPage(r),
    ) as unknown as { id: string; url: string; properties: Props }[];
  }

  private async create(key: DbKey, properties: Record<string, unknown>, markdown?: string) {
    const page = await this.notion.pages.create({
      parent: { data_source_id: this.ds[key] },
      properties: properties as PageProps,
      ...(markdown ? { markdown } : {}),
    } as CreateArgs);
    return page.id;
  }

  private async update(pageId: string, properties: Record<string, unknown>) {
    await this.notion.pages.update({
      page_id: pageId,
      properties: properties as PageProps,
    } as Parameters<Client["pages"]["update"]>[0]);
  }

  private async getPage(pageId: string) {
    const page = await this.notion.pages.retrieve({ page_id: pageId });
    if (!isFullPage(page)) throw new Error(`페이지를 읽을 수 없습니다: ${pageId}`);
    return page as unknown as { id: string; url: string; properties: Props };
  }

  // ---------- Work Log ----------

  async listWorkLogs(opts: { unprocessedOnly?: boolean; since?: string } = {}): Promise<WorkLog[]> {
    const and: unknown[] = [];
    if (opts.unprocessedOnly) and.push({ property: P.workLog.processed, checkbox: { equals: false } });
    if (opts.since) and.push({ property: P.workLog.date, date: { on_or_after: opts.since } });
    const filter = and.length ? ({ and } as Filter) : undefined;
    const rows = await this.queryAll("workLog", filter, [{ property: P.workLog.date, direction: "ascending" }]);
    return rows.map(m.toWorkLog);
  }

  async createWorkLog(input: { title: string; date?: string; content: string; type?: string; tags?: string[]; projectId?: string }) {
    const k = P.workLog;
    return this.create("workLog", {
      [k.title]: w.title(input.title),
      [k.date]: w.date(input.date ?? today()),
      [k.content]: w.text(input.content),
      ...(input.type ? { [k.type]: w.select(input.type) } : {}),
      ...(input.tags ? { [k.tags]: w.multiSelect(input.tags) } : {}),
      ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
    });
  }

  async markWorkLogsProcessed(ids: string[]) {
    for (const id of ids) await this.update(id, { [P.workLog.processed]: w.checkbox(true) });
  }

  // ---------- Projects ----------

  async listProjects(): Promise<Project[]> {
    const rows = await this.queryAll("projects");
    return rows.map(m.toProject).sort(byPeriodDesc);
  }

  async getProject(id: string): Promise<Project> {
    return m.toProject(await this.getPage(id));
  }

  async createProject(input: {
    name: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    role?: string;
    stack?: string[];
    summary?: string;
    publicUrl?: string | null;
  }) {
    const k = P.projects;
    return this.create("projects", {
      [k.name]: w.title(input.name),
      [k.period]: w.date(input.periodStart ?? today(), input.periodEnd ?? null),
      [k.role]: w.text(input.role ?? ""),
      [k.stack]: w.multiSelect(input.stack ?? []),
      [k.summary]: w.text(input.summary ?? ""),
      [k.status]: w.select("진행중"),
      [k.publicUrl]: w.url(input.publicUrl ?? null),
      [k.onResume]: w.checkbox(true),
    });
  }

  async updateProjectLinks(id: string, links: { publicUrl?: string | null; repoUrl?: string | null; coverImage?: string | null }) {
    const k = P.projects;
    const props: Record<string, unknown> = {};
    if (links.publicUrl !== undefined) props[k.publicUrl] = w.url(links.publicUrl);
    if (links.repoUrl !== undefined) props[k.repoUrl] = w.url(links.repoUrl);
    if (links.coverImage !== undefined) props[k.coverImage] = w.url(links.coverImage);
    await this.update(id, props);
  }

  // ---------- Records (저장용, append-only) ----------

  async listRecords(opts: { projectId?: string } = {}): Promise<RecordEntry[]> {
    const filter = opts.projectId
      ? ({ property: P.records.project, relation: { contains: opts.projectId } } as Filter)
      : undefined;
    const rows = await this.queryAll("records", filter);
    return rows.map(m.toRecord).sort(byPeriodDesc);
  }

  async getRecord(id: string): Promise<RecordEntry> {
    return m.toRecord(await this.getPage(id));
  }

  async createRecord(input: {
    title: string;
    periodStart: string;
    periodEnd: string;
    cadence: "주간" | "월간" | "프로젝트 종료";
    summary: string;
    highlights: string;
    role?: string;
    tech: string[];
    projectId?: string | null;
    logIds: string[];
  }) {
    const k = P.records;
    return this.create("records", {
      [k.title]: w.title(input.title),
      [k.period]: w.date(input.periodStart, input.periodEnd),
      [k.cadence]: w.select(input.cadence),
      [k.summary]: w.text(input.summary),
      [k.highlights]: w.text(input.highlights),
      [k.role]: w.text(input.role ?? ""),
      [k.tech]: w.multiSelect(input.tech),
      ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
      [k.logs]: w.relation(input.logIds),
      [k.status]: w.select("초안"),
      [k.origin]: w.select("자동"),
    });
  }

  /** 확정: 이후 배치는 이 행을 수정하지 않는다 */
  async confirmRecord(id: string, projectId?: string) {
    const current = await this.getRecord(id);
    if (current.status === "확정") return;
    const k = P.records;
    await this.update(id, {
      [k.status]: w.select("확정"),
      [k.confirmedAt]: w.date(today()),
      ...(projectId ? { [k.project]: w.relation([projectId]) } : {}),
    });
    // 역방향 relation(지표) 대신 Metrics 를 직접 조회해 누락 없이 확정한다
    const metrics = await this.listMetrics({ recordId: id });
    const ids = new Set([...current.metricIds, ...metrics.map((mt) => mt.id)]);
    for (const metricId of ids) await this.confirmMetric(metricId);
  }

  // ---------- Metrics (저장용) ----------

  async listMetrics(opts: { recordId?: string } = {}): Promise<Metric[]> {
    const filter = opts.recordId
      ? ({ property: P.metrics.record, relation: { contains: opts.recordId } } as Filter)
      : undefined;
    return (await this.queryAll("metrics", filter)).map(m.toMetric);
  }

  async createMetric(input: {
    name: string;
    category: string;
    before: number;
    after: number;
    unit: string;
    direction: string;
    method: string;
    confidence: string;
    evidence?: string;
    recordId: string;
  }) {
    const k = P.metrics;
    return this.create("metrics", {
      [k.name]: w.title(input.name),
      [k.category]: w.select(input.category),
      [k.before]: w.number(input.before),
      [k.after]: w.number(input.after),
      [k.unit]: w.select(input.unit),
      [k.direction]: w.select(input.direction),
      [k.method]: w.text(input.method),
      [k.confidence]: w.select(input.confidence),
      [k.evidence]: w.text(input.evidence ?? ""),
      [k.record]: w.relation([input.recordId]),
      [k.status]: w.select("초안"),
    });
  }

  async confirmMetric(id: string) {
    await this.update(id, { [P.metrics.status]: w.select("확정") });
  }

  // ---------- Achievements (이력서 문장) ----------

  async listAchievements(opts: { assignment?: AssignmentStatus[] } = {}): Promise<Achievement[]> {
    const filter = opts.assignment?.length
      ? ({
          or: opts.assignment.map((s) => ({ property: P.achievements.assignment, select: { equals: s } })),
        } as Filter)
      : undefined;
    return (await this.queryAll("achievements", filter)).map(m.toAchievement);
  }

  async createAchievementCandidate(input: {
    text: string;
    recordId: string;
    suggestedProjectId: string | null;
    suggestedProjectName: string;
    confidence: number;
  }) {
    const k = P.achievements;
    return this.create("achievements", {
      [k.text]: w.title(input.text),
      [k.records]: w.relation([input.recordId]),
      // 추천만 기록. 실제 프로젝트 relation 은 사용자가 확인한 뒤에 연결한다.
      [k.suggestedProject]: w.text(input.suggestedProjectName),
      [k.suggestedProjectId]: w.text(input.suggestedProjectId ?? ""),
      [k.confidence]: w.number(Math.round(input.confidence * 100) / 100),
      [k.assignment]: w.select("추천됨"),
      [k.exposure]: w.multiSelect(["이력서", "포트폴리오"]),
    });
  }

  /**
   * 사용자 확인 결과 반영.
   * - existing: 기존 프로젝트에 연결
   * - new: 새 프로젝트 생성 후 연결
   * - hold / reject: 상태만 변경
   * 반환값: 연결된 프로젝트 ID (이력서 섹션 재렌더 대상)
   */
  async resolveAchievement(
    id: string,
    decision:
      | { kind: "existing"; projectId: string; text?: string }
      | { kind: "new"; project: Parameters<CareerRepo["createProject"]>[0]; text?: string }
      | { kind: "hold" }
      | { kind: "reject" },
  ): Promise<string | null> {
    const k = P.achievements;
    if (decision.kind === "hold" || decision.kind === "reject") {
      await this.update(id, { [k.assignment]: w.select(decision.kind === "hold" ? "보류" : "반려") });
      return null;
    }
    const projectId = decision.kind === "existing" ? decision.projectId : await this.createProject(decision.project);
    const status: AssignmentStatus = decision.kind === "existing" ? "확인됨" : "새 프로젝트";
    await this.update(id, {
      [k.project]: w.relation([projectId]),
      [k.assignment]: w.select(status),
      ...(decision.text ? { [k.text]: w.title(decision.text) } : {}),
    });
    // 근거 Record 도 같은 프로젝트로 묶고 확정한다
    const achievement = m.toAchievement(await this.getPage(id));
    for (const recordId of achievement.recordIds) await this.confirmRecord(recordId, projectId);
    return projectId;
  }

  // ---------- Posts (velog) ----------

  async listPosts(opts: { statuses?: PostStatus[] } = {}): Promise<Post[]> {
    const filter = opts.statuses?.length
      ? ({ or: opts.statuses.map((s) => ({ property: P.posts.status, select: { equals: s } })) } as Filter)
      : undefined;
    const rows = await this.queryAll("posts", filter);
    return rows.map(m.toPost).sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
  }

  async getPost(id: string): Promise<Post> {
    return m.toPost(await this.getPage(id));
  }

  async getPageMarkdown(pageId: string): Promise<string> {
    const res = await this.notion.pages.retrieveMarkdown({ page_id: pageId });
    return (res as unknown as { markdown?: string }).markdown ?? "";
  }

  async createPostDraft(input: { title: string; markdown: string; tags: string[]; projectId?: string | null; scheduledAt?: string | null; mode?: PostMode }) {
    const k = P.posts;
    return this.create(
      "posts",
      {
        [k.title]: w.title(input.title),
        [k.status]: w.select("검토대기"),
        [k.mode]: w.select(input.mode ?? "임시저장"),
        [k.reviewed]: w.checkbox(false),
        [k.tags]: w.multiSelect(input.tags),
        ...(input.scheduledAt ? { [k.scheduledAt]: w.date(input.scheduledAt) } : {}),
        ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
      },
      input.markdown,
    );
  }

  async createPostIdea(input: { title: string; note: string; projectId?: string | null }) {
    const k = P.posts;
    return this.create(
      "posts",
      {
        [k.title]: w.title(input.title),
        [k.status]: w.select("소재"),
        ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
      },
      input.note,
    );
  }

  /** velog 에서 직접 쓴 글을 RSS 로 발견했을 때 기록용으로 추가 */
  async createPublishedPost(input: { title: string; url: string; publishedAt: string | null; platform?: string }) {
    const k = P.posts;
    return this.create("posts", {
      [k.title]: w.title(input.title),
      [k.status]: w.select("발행됨"),
      [k.mode]: w.select("공개"),
      [k.reviewed]: w.checkbox(true),
      [k.url]: w.url(input.url),
      ...(input.platform ? { [k.platforms]: w.multiSelect([input.platform]) } : {}),
      ...(input.publishedAt ? { [k.publishedAt]: w.date(input.publishedAt) } : {}),
    });
  }

  async updatePost(
    id: string,
    patch: Partial<{ status: PostStatus; mode: PostMode; reviewed: boolean; scheduledAt: string | null; velogId: string; velogUrl: string | null; publishedAt: string | null; error: string; platforms: string[] }>,
  ) {
    const k = P.posts;
    const props: Record<string, unknown> = {};
    if (patch.status) props[k.status] = w.select(patch.status);
    if (patch.mode) props[k.mode] = w.select(patch.mode);
    if (patch.reviewed !== undefined) props[k.reviewed] = w.checkbox(patch.reviewed);
    if (patch.scheduledAt !== undefined) props[k.scheduledAt] = w.date(patch.scheduledAt);
    if (patch.velogId !== undefined) props[k.velogId] = w.text(patch.velogId);
    if (patch.velogUrl !== undefined) props[k.url] = w.url(patch.velogUrl);
    if (patch.publishedAt !== undefined) props[k.publishedAt] = w.date(patch.publishedAt);
    if (patch.error !== undefined) props[k.error] = w.text(patch.error);
    if (patch.platforms !== undefined) props[k.platforms] = w.multiSelect(patch.platforms);
    await this.update(id, props);
  }

  async updatePostBody(id: string, markdown: string) {
    await this.notion.pages.updateMarkdown({
      page_id: id,
      type: "replace_content",
      replace_content: { new_str: markdown, allow_deleting_content: true },
    });
  }

  // ---------- Attachments ----------

  async listAttachments(opts: { projectId?: string; recordId?: string } = {}): Promise<Attachment[]> {
    let filter: Filter | undefined;
    if (opts.projectId) filter = { property: P.attachments.project, relation: { contains: opts.projectId } } as Filter;
    else if (opts.recordId) filter = { property: P.attachments.record, relation: { contains: opts.recordId } } as Filter;
    return (await this.queryAll("attachments", filter)).map(m.toAttachment);
  }

  async getAttachment(id: string): Promise<Attachment> {
    return m.toAttachment(await this.getPage(id));
  }

  async createImageAttachment(input: { name: string; blobPath: string; caption?: string; projectId?: string | null; recordId?: string | null }) {
    const k = P.attachments;
    return this.create("attachments", {
      [k.name]: w.title(input.name),
      [k.kind]: w.select("이미지"),
      [k.blobPath]: w.text(input.blobPath),
      [k.visibility]: w.select("비공개"),
      [k.maskChecked]: w.checkbox(false),
      [k.caption]: w.text(input.caption ?? ""),
      ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
      ...(input.recordId ? { [k.record]: w.relation([input.recordId]) } : {}),
    });
  }

  async createLinkAttachment(input: { name: string; url: string; ogImage?: string | null; caption?: string; projectId?: string | null; recordId?: string | null }) {
    const k = P.attachments;
    return this.create("attachments", {
      [k.name]: w.title(input.name),
      [k.kind]: w.select("링크"),
      [k.linkUrl]: w.url(input.url),
      [k.ogImage]: w.url(input.ogImage ?? null),
      [k.visibility]: w.select("공개가능"),
      [k.maskChecked]: w.checkbox(true),
      [k.caption]: w.text(input.caption ?? ""),
      ...(input.projectId ? { [k.project]: w.relation([input.projectId]) } : {}),
      ...(input.recordId ? { [k.record]: w.relation([input.recordId]) } : {}),
    });
  }

  async setAttachmentVisibility(id: string, visibility: Visibility, publicUrl: string | null) {
    const k = P.attachments;
    await this.update(id, {
      [k.visibility]: w.select(visibility),
      [k.maskChecked]: w.checkbox(visibility === "공개가능"),
      [k.publicUrl]: w.url(publicUrl),
    });
  }

  // ---------- 이력서 페이지 ----------

  async replacePageMarkdown(pageId: string, markdown: string) {
    await this.notion.pages.updateMarkdown({
      page_id: pageId,
      type: "replace_content",
      replace_content: { new_str: markdown, allow_deleting_content: true },
    });
  }
}

function byPeriodDesc<T extends { period: { start: string } | null }>(a: T, b: T) {
  return (b.period?.start ?? "").localeCompare(a.period?.start ?? "");
}
