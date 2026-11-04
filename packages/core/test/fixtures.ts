import type { Achievement, Post, Project, WorkLog } from "../src/notion/types";

export const project = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  url: "",
  name: "결제 시스템 고도화",
  period: { start: "2026-03-01", end: null },
  role: "백엔드 리드",
  stack: ["Node.js", "PostgreSQL"],
  teamSize: 4,
  summary: "결제 API 성능·안정성 개선",
  status: "진행중",
  publicUrl: null,
  repoUrl: null,
  coverImage: null,
  resumeOrder: 1,
  onResume: true,
  ...over,
});

export const achievement = (over: Partial<Achievement> = {}): Achievement => ({
  id: "a1",
  text: "쿼리 튜닝으로 결제 API p95 응답시간 40% 단축",
  projectIds: ["p1"],
  recordIds: ["r1"],
  assignment: "확인됨",
  suggestedProject: "결제 시스템 고도화",
  suggestedProjectId: "p1",
  confidence: 0.9,
  exposure: ["이력서"],
  order: 1,
  ...over,
});

export const post = (over: Partial<Post> = {}): Post => ({
  id: "post1",
  url: "",
  title: "N+1 쿼리 잡기",
  status: "검토대기",
  mode: "공개",
  scheduledAt: "2026-11-01T00:00:00.000Z",
  reviewed: false,
  tags: ["db"],
  velogId: "",
  velogUrl: null,
  publishedAt: null,
  error: "",
  platforms: [],
  projectIds: [],
  attachmentIds: [],
  ...over,
});

export const log = (over: Partial<WorkLog> = {}): WorkLog => ({
  id: "l1",
  title: "결제 API 튜닝",
  date: "2026-11-02",
  content: "인덱스 추가로 p95 820ms → 490ms",
  type: "성능개선",
  tags: ["PostgreSQL"],
  projectIds: [],
  publicOk: false,
  blogIdea: true,
  processed: false,
  attachmentIds: [],
  ...over,
});
