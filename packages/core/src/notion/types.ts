import type {
  AssignmentStatus,
  AttachmentKind,
  Direction,
  DraftStatus,
  MetricCategory,
  MetricConfidence,
  PostMode,
  PostStatus,
  ProjectStatus,
  Visibility,
  WorkType,
} from "./schema";

export type DateRange = { start: string; end: string | null } | null;

export interface WorkLog {
  id: string;
  title: string;
  date: string | null;
  content: string;
  type: WorkType | null;
  tags: string[];
  projectIds: string[];
  publicOk: boolean;
  blogIdea: boolean;
  processed: boolean;
  attachmentIds: string[];
}

export interface Project {
  id: string;
  url: string;
  name: string;
  period: DateRange;
  role: string;
  stack: string[];
  teamSize: number | null;
  summary: string;
  status: ProjectStatus | null;
  publicUrl: string | null;
  repoUrl: string | null;
  coverImage: string | null;
  resumeOrder: number | null;
  onResume: boolean;
}

export interface RecordEntry {
  id: string;
  url: string;
  title: string;
  period: DateRange;
  cadence: string | null;
  summary: string;
  highlights: string;
  role: string;
  contribution: number | null;
  tech: string[];
  projectIds: string[];
  logIds: string[];
  metricIds: string[];
  attachmentIds: string[];
  status: DraftStatus | null;
  confirmedAt: string | null;
  origin: string | null;
}

export interface Metric {
  id: string;
  name: string;
  category: MetricCategory | null;
  before: number | null;
  after: number | null;
  unit: string | null;
  direction: Direction | null;
  improvement: number | null;
  method: string;
  period: DateRange;
  confidence: MetricConfidence | null;
  evidence: string;
  recordIds: string[];
  status: DraftStatus | null;
}

export interface Achievement {
  id: string;
  text: string;
  projectIds: string[];
  recordIds: string[];
  assignment: AssignmentStatus | null;
  suggestedProject: string;
  suggestedProjectId: string | null;
  confidence: number | null;
  exposure: string[];
  order: number | null;
}

export interface Post {
  id: string;
  url: string;
  title: string;
  status: PostStatus | null;
  mode: PostMode | null;
  scheduledAt: string | null;
  reviewed: boolean;
  tags: string[];
  velogId: string;
  velogUrl: string | null;
  publishedAt: string | null;
  error: string;
  platforms: string[];
  projectIds: string[];
  attachmentIds: string[];
}

export interface Attachment {
  id: string;
  name: string;
  kind: AttachmentKind | null;
  blobPath: string;
  publicUrl: string | null;
  linkUrl: string | null;
  ogImage: string | null;
  visibility: Visibility | null;
  maskChecked: boolean;
  caption: string;
  projectIds: string[];
  workLogIds: string[];
  recordIds: string[];
  postIds: string[];
}
