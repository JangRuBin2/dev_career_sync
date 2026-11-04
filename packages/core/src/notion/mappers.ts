import { P } from "./schema";
import { read as r, type Props } from "./props";
import type { Achievement, Attachment, Metric, Post, Project, RecordEntry, WorkLog } from "./types";

type Page = { id: string; url?: string; properties: Props };

export function toWorkLog(page: Page): WorkLog {
  const p = page.properties;
  const k = P.workLog;
  return {
    id: page.id,
    title: r.title(p, k.title),
    date: r.date(p, k.date)?.start ?? null,
    content: r.text(p, k.content),
    type: r.select(p, k.type),
    tags: r.multiSelect(p, k.tags),
    projectIds: r.relation(p, k.project),
    publicOk: r.checkbox(p, k.publicOk),
    blogIdea: r.checkbox(p, k.blogIdea),
    processed: r.checkbox(p, k.processed),
    attachmentIds: r.relation(p, k.attachments),
  };
}

export function toProject(page: Page): Project {
  const p = page.properties;
  const k = P.projects;
  return {
    id: page.id,
    url: page.url ?? "",
    name: r.title(p, k.name),
    period: r.date(p, k.period),
    role: r.text(p, k.role),
    stack: r.multiSelect(p, k.stack),
    teamSize: r.number(p, k.teamSize),
    summary: r.text(p, k.summary),
    status: r.select(p, k.status),
    publicUrl: r.url(p, k.publicUrl),
    repoUrl: r.url(p, k.repoUrl),
    coverImage: r.url(p, k.coverImage),
    resumeOrder: r.number(p, k.resumeOrder),
    onResume: r.checkbox(p, k.onResume),
  };
}

export function toRecord(page: Page): RecordEntry {
  const p = page.properties;
  const k = P.records;
  return {
    id: page.id,
    url: page.url ?? "",
    title: r.title(p, k.title),
    period: r.date(p, k.period),
    cadence: r.select(p, k.cadence),
    summary: r.text(p, k.summary),
    highlights: r.text(p, k.highlights),
    role: r.text(p, k.role),
    contribution: r.number(p, k.contribution),
    tech: r.multiSelect(p, k.tech),
    projectIds: r.relation(p, k.project),
    logIds: r.relation(p, k.logs),
    metricIds: r.relation(p, k.metrics),
    attachmentIds: r.relation(p, k.attachments),
    status: r.select(p, k.status),
    confirmedAt: r.date(p, k.confirmedAt)?.start ?? null,
    origin: r.select(p, k.origin),
  };
}

export function toMetric(page: Page): Metric {
  const p = page.properties;
  const k = P.metrics;
  return {
    id: page.id,
    name: r.title(p, k.name),
    category: r.select(p, k.category),
    before: r.number(p, k.before),
    after: r.number(p, k.after),
    unit: r.select(p, k.unit),
    direction: r.select(p, k.direction),
    improvement: r.formulaNumber(p, k.improvement),
    method: r.text(p, k.method),
    period: r.date(p, k.period),
    confidence: r.select(p, k.confidence),
    evidence: r.text(p, k.evidence),
    recordIds: r.relation(p, k.record),
    status: r.select(p, k.status),
  };
}

export function toAchievement(page: Page): Achievement {
  const p = page.properties;
  const k = P.achievements;
  return {
    id: page.id,
    text: r.title(p, k.text),
    projectIds: r.relation(p, k.project),
    recordIds: r.relation(p, k.records),
    assignment: r.select(p, k.assignment),
    suggestedProject: r.text(p, k.suggestedProject),
    suggestedProjectId: r.text(p, k.suggestedProjectId) || null,
    confidence: r.number(p, k.confidence),
    exposure: r.multiSelect(p, k.exposure),
    order: r.number(p, k.order),
  };
}

export function toPost(page: Page): Post {
  const p = page.properties;
  const k = P.posts;
  return {
    id: page.id,
    url: page.url ?? "",
    title: r.title(p, k.title),
    status: r.select(p, k.status),
    mode: r.select(p, k.mode),
    scheduledAt: r.date(p, k.scheduledAt)?.start ?? null,
    reviewed: r.checkbox(p, k.reviewed),
    tags: r.multiSelect(p, k.tags),
    velogId: r.text(p, k.velogId),
    velogUrl: r.url(p, k.url),
    publishedAt: r.date(p, k.publishedAt)?.start ?? null,
    error: r.text(p, k.error),
    platforms: r.multiSelect(p, k.platforms),
    projectIds: r.relation(p, k.project),
    attachmentIds: r.relation(p, k.attachments),
  };
}

export function toAttachment(page: Page): Attachment {
  const p = page.properties;
  const k = P.attachments;
  return {
    id: page.id,
    name: r.title(p, k.name),
    kind: r.select(p, k.kind),
    blobPath: r.text(p, k.blobPath),
    publicUrl: r.url(p, k.publicUrl),
    linkUrl: r.url(p, k.linkUrl),
    ogImage: r.url(p, k.ogImage),
    visibility: r.select(p, k.visibility),
    maskChecked: r.checkbox(p, k.maskChecked),
    caption: r.text(p, k.caption),
    projectIds: r.relation(p, k.project),
    workLogIds: r.relation(p, k.workLog),
    recordIds: r.relation(p, k.record),
    postIds: r.relation(p, k.post),
  };
}
