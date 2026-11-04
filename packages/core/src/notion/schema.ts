/**
 * Notion DB 스키마 정의 (단일 출처).
 * - setup 스크립트는 이 정의로 DB를 생성한다.
 * - 리포지토리는 P.* 상수로 속성 이름을 참조한다 (오타 방지).
 */

export const DB_KEYS = [
  "workLog",
  "projects",
  "records",
  "metrics",
  "achievements",
  "posts",
  "attachments",
] as const;
export type DbKey = (typeof DB_KEYS)[number];

export const DB_TITLES: Record<DbKey, string> = {
  workLog: "📝 Work Log",
  projects: "📁 Projects",
  records: "📦 Records",
  metrics: "📊 Metrics",
  achievements: "🏆 Achievements",
  posts: "✍️ Posts",
  attachments: "📎 Attachments",
};

/** 각 DB의 data source ID를 담는 환경변수 이름 */
export const DB_ENV: Record<DbKey, string> = {
  workLog: "NOTION_DS_WORK_LOG",
  projects: "NOTION_DS_PROJECTS",
  records: "NOTION_DS_RECORDS",
  metrics: "NOTION_DS_METRICS",
  achievements: "NOTION_DS_ACHIEVEMENTS",
  posts: "NOTION_DS_POSTS",
  attachments: "NOTION_DS_ATTACHMENTS",
};

/** 속성 이름 상수 */
export const P = {
  workLog: {
    title: "제목",
    date: "날짜",
    content: "내용",
    type: "유형",
    tags: "기술태그",
    project: "프로젝트",
    publicOk: "공개가능",
    blogIdea: "블로그소재",
    processed: "처리됨",
    attachments: "첨부",
  },
  projects: {
    name: "이름",
    period: "기간",
    role: "역할",
    stack: "기술스택",
    teamSize: "팀 규모",
    summary: "요약",
    status: "상태",
    publicUrl: "공개 URL",
    repoUrl: "저장소 URL",
    coverImage: "대표 이미지",
    resumeOrder: "이력서 노출 순서",
    onResume: "이력서 노출",
    // 아래는 다른 DB의 dual relation이 만들어 주는 역방향 속성
    records: "기록",
    achievements: "성과",
    posts: "포스트",
    attachments: "첨부",
  },
  records: {
    title: "제목",
    period: "기간",
    cadence: "주기",
    summary: "작업 요약",
    highlights: "핵심 성과",
    role: "역할",
    contribution: "기여도",
    tech: "사용 기술",
    project: "프로젝트",
    logs: "원본 로그",
    attachments: "첨부",
    metrics: "지표", // Metrics.기록 의 역방향
    status: "상태",
    confirmedAt: "확정일",
    origin: "생성 방식",
  },
  metrics: {
    name: "지표명",
    category: "카테고리",
    before: "Before",
    after: "After",
    unit: "단위",
    direction: "방향",
    improvement: "개선율",
    method: "측정 방법",
    period: "측정 기간",
    confidence: "신뢰도",
    evidence: "근거 메모",
    record: "기록",
    status: "상태",
  },
  achievements: {
    text: "문장",
    project: "프로젝트",
    records: "근거 기록",
    assignment: "배정 상태",
    suggestedProject: "추천 프로젝트",
    suggestedProjectId: "추천 프로젝트 ID", // 비어 있으면 새 프로젝트 제안
    confidence: "추천 신뢰도",
    exposure: "노출",
    order: "정렬",
  },
  posts: {
    title: "제목",
    status: "상태",
    mode: "발행 모드",
    scheduledAt: "예약일시",
    reviewed: "검토완료",
    tags: "태그",
    velogId: "velog ID",
    url: "URL",
    publishedAt: "발행일",
    error: "실패 사유",
    platforms: "발행처", // 직접 올린 블로그 (velog, 티스토리 …)
    project: "프로젝트",
    attachments: "첨부",
  },
  attachments: {
    name: "이름",
    kind: "유형",
    blobPath: "저장 경로",
    publicUrl: "공개 URL",
    linkUrl: "링크 URL",
    ogImage: "OG 썸네일",
    visibility: "공개범위",
    maskChecked: "마스킹 확인",
    caption: "캡션",
    project: "프로젝트",
    workLog: "업무 로그", // 역방향
    record: "기록", // 역방향
    post: "포스트", // 역방향
  },
} as const satisfies Record<DbKey, Record<string, string>>;

/** 선택지 상수 */
export const OPT = {
  workType: ["기능개발", "트러블슈팅", "성능개선", "협업", "운영"],
  projectStatus: ["진행중", "완료", "보류"],
  cadence: ["주간", "월간", "프로젝트 종료"],
  draftStatus: ["초안", "확정"],
  origin: ["자동", "수동"],
  metricCategory: ["성능", "비용", "품질", "생산성", "사용자"],
  unit: ["ms", "%", "건", "시간", "원", "회", "초", "MB"],
  direction: ["낮을수록 좋음", "높을수록 좋음"],
  confidence: ["직접 측정", "추정", "팀 공유"],
  assignment: ["추천됨", "확인됨", "새 프로젝트", "보류", "반려"],
  exposure: ["이력서", "포트폴리오"],
  postStatus: ["소재", "초안", "검토대기", "검토완료", "임시저장됨", "발행됨", "실패"],
  // 자동 발행(velog API) 전용 — 현재는 사용하지 않음 (AUTO_PUBLISH=1 일 때만)
  postMode: ["임시저장", "공개", "비공개"],
  platform: ["velog", "티스토리", "네이버 블로그", "dev.to", "기타"],
  attachmentKind: ["이미지", "링크"],
  visibility: ["비공개", "공개가능"],
} as const;

export type WorkType = (typeof OPT.workType)[number];
export type ProjectStatus = (typeof OPT.projectStatus)[number];
export type DraftStatus = (typeof OPT.draftStatus)[number];
export type MetricCategory = (typeof OPT.metricCategory)[number];
export type Direction = (typeof OPT.direction)[number];
export type MetricConfidence = (typeof OPT.confidence)[number];
export type AssignmentStatus = (typeof OPT.assignment)[number];
export type PostStatus = (typeof OPT.postStatus)[number];
export type PostMode = (typeof OPT.postMode)[number];
export type Platform = (typeof OPT.platform)[number];
export type Visibility = (typeof OPT.visibility)[number];
export type AttachmentKind = (typeof OPT.attachmentKind)[number];

/** Metrics 개선율 Notion 수식 (방향 반영) */
export const IMPROVEMENT_FORMULA = `if(prop("${P.metrics.before}") == 0, 0, if(prop("${P.metrics.direction}") == "낮을수록 좋음", round((prop("${P.metrics.before}") - prop("${P.metrics.after}")) / prop("${P.metrics.before}") * 1000) / 10, round((prop("${P.metrics.after}") - prop("${P.metrics.before}")) / prop("${P.metrics.before}") * 1000) / 10))`;

// ---- setup 용 속성 스펙 ----

type Spec =
  | { type: "title" }
  | { type: "rich_text" }
  | { type: "number"; format?: "number" | "percent" }
  | { type: "checkbox" }
  | { type: "date" }
  | { type: "url" }
  | { type: "select"; options: readonly string[] }
  | { type: "multi_select"; options?: readonly string[] }
  | { type: "formula"; expression: string }
  /** syncedName 이 있으면 dual relation(역방향 속성 이름 지정), 없으면 단방향 */
  | { type: "relation"; target: DbKey; syncedName?: string };

export type DbSpec = Record<string, Spec>;

export const DB_SPECS: Record<DbKey, DbSpec> = {
  workLog: {
    [P.workLog.title]: { type: "title" },
    [P.workLog.date]: { type: "date" },
    [P.workLog.content]: { type: "rich_text" },
    [P.workLog.type]: { type: "select", options: OPT.workType },
    [P.workLog.tags]: { type: "multi_select" },
    [P.workLog.project]: { type: "relation", target: "projects" },
    [P.workLog.publicOk]: { type: "checkbox" },
    [P.workLog.blogIdea]: { type: "checkbox" },
    [P.workLog.processed]: { type: "checkbox" },
    [P.workLog.attachments]: { type: "relation", target: "attachments", syncedName: P.attachments.workLog },
  },
  projects: {
    [P.projects.name]: { type: "title" },
    [P.projects.period]: { type: "date" },
    [P.projects.role]: { type: "rich_text" },
    [P.projects.stack]: { type: "multi_select" },
    [P.projects.teamSize]: { type: "number" },
    [P.projects.summary]: { type: "rich_text" },
    [P.projects.status]: { type: "select", options: OPT.projectStatus },
    [P.projects.publicUrl]: { type: "url" },
    [P.projects.repoUrl]: { type: "url" },
    [P.projects.coverImage]: { type: "url" },
    [P.projects.resumeOrder]: { type: "number" },
    [P.projects.onResume]: { type: "checkbox" },
  },
  records: {
    [P.records.title]: { type: "title" },
    [P.records.period]: { type: "date" },
    [P.records.cadence]: { type: "select", options: OPT.cadence },
    [P.records.summary]: { type: "rich_text" },
    [P.records.highlights]: { type: "rich_text" },
    [P.records.role]: { type: "rich_text" },
    [P.records.contribution]: { type: "number", format: "percent" },
    [P.records.tech]: { type: "multi_select" },
    [P.records.project]: { type: "relation", target: "projects", syncedName: P.projects.records },
    [P.records.logs]: { type: "relation", target: "workLog" },
    [P.records.attachments]: { type: "relation", target: "attachments", syncedName: P.attachments.record },
    [P.records.status]: { type: "select", options: OPT.draftStatus },
    [P.records.confirmedAt]: { type: "date" },
    [P.records.origin]: { type: "select", options: OPT.origin },
  },
  metrics: {
    [P.metrics.name]: { type: "title" },
    [P.metrics.category]: { type: "select", options: OPT.metricCategory },
    [P.metrics.before]: { type: "number" },
    [P.metrics.after]: { type: "number" },
    [P.metrics.unit]: { type: "select", options: OPT.unit },
    [P.metrics.direction]: { type: "select", options: OPT.direction },
    [P.metrics.method]: { type: "rich_text" },
    [P.metrics.period]: { type: "date" },
    [P.metrics.confidence]: { type: "select", options: OPT.confidence },
    [P.metrics.evidence]: { type: "rich_text" },
    [P.metrics.record]: { type: "relation", target: "records", syncedName: P.records.metrics },
    [P.metrics.status]: { type: "select", options: OPT.draftStatus },
    // formula는 참조 속성이 생긴 뒤 추가해야 하므로 setup 2단계에서 처리
    [P.metrics.improvement]: { type: "formula", expression: IMPROVEMENT_FORMULA },
  },
  achievements: {
    [P.achievements.text]: { type: "title" },
    [P.achievements.project]: { type: "relation", target: "projects", syncedName: P.projects.achievements },
    [P.achievements.records]: { type: "relation", target: "records" },
    [P.achievements.assignment]: { type: "select", options: OPT.assignment },
    [P.achievements.suggestedProject]: { type: "rich_text" },
    [P.achievements.suggestedProjectId]: { type: "rich_text" },
    [P.achievements.confidence]: { type: "number" },
    [P.achievements.exposure]: { type: "multi_select", options: OPT.exposure },
    [P.achievements.order]: { type: "number" },
  },
  posts: {
    [P.posts.title]: { type: "title" },
    [P.posts.status]: { type: "select", options: OPT.postStatus },
    [P.posts.mode]: { type: "select", options: OPT.postMode },
    [P.posts.scheduledAt]: { type: "date" },
    [P.posts.reviewed]: { type: "checkbox" },
    [P.posts.tags]: { type: "multi_select" },
    [P.posts.velogId]: { type: "rich_text" },
    [P.posts.url]: { type: "url" },
    [P.posts.publishedAt]: { type: "date" },
    [P.posts.error]: { type: "rich_text" },
    [P.posts.platforms]: { type: "multi_select", options: OPT.platform },
    [P.posts.project]: { type: "relation", target: "projects", syncedName: P.projects.posts },
    [P.posts.attachments]: { type: "relation", target: "attachments", syncedName: P.attachments.post },
  },
  attachments: {
    [P.attachments.name]: { type: "title" },
    [P.attachments.kind]: { type: "select", options: OPT.attachmentKind },
    [P.attachments.blobPath]: { type: "rich_text" },
    [P.attachments.publicUrl]: { type: "url" },
    [P.attachments.linkUrl]: { type: "url" },
    [P.attachments.ogImage]: { type: "url" },
    [P.attachments.visibility]: { type: "select", options: OPT.visibility },
    [P.attachments.maskChecked]: { type: "checkbox" },
    [P.attachments.caption]: { type: "rich_text" },
    [P.attachments.project]: { type: "relation", target: "projects", syncedName: P.projects.attachments },
    // 업무 로그 / 기록 / 포스트 역방향 속성은 각 DB의 dual relation이 생성
  },
};
