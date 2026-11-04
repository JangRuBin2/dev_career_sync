import type { Achievement, Project } from "../notion/types";

export interface ResumeProfile {
  name?: string;
  headline?: string;
  links?: { label: string; url: string }[];
}

const isConfirmed = (a: Achievement) =>
  (a.assignment === "확인됨" || a.assignment === "새 프로젝트") && a.exposure.includes("이력서");

function formatPeriod(p: Project["period"]): string {
  if (!p) return "";
  const fmt = (d: string) => d.slice(0, 7).replace("-", ".");
  return `${fmt(p.start)} ~ ${p.end ? fmt(p.end) : "진행중"}`;
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const ao = a.resumeOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.resumeOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (b.period?.start ?? "").localeCompare(a.period?.start ?? "");
  });
}

function sortAchievements(list: Achievement[]): Achievement[] {
  return [...list].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/** 프로젝트 한 개의 이력서 섹션 (Markdown) */
export function renderProjectSection(project: Project, achievements: Achievement[]): string {
  const lines: string[] = [];
  lines.push(`### ${project.name}`);
  const meta = [formatPeriod(project.period), project.role].filter(Boolean).join(" · ");
  if (meta) lines.push(`*${meta}*`);
  if (project.summary) lines.push("", project.summary);
  if (project.stack.length) lines.push("", `**기술스택** ${project.stack.join(", ")}`);
  const links = [project.publicUrl && `[서비스](${project.publicUrl})`, project.repoUrl && `[저장소](${project.repoUrl})`].filter(Boolean);
  if (links.length) lines.push("", links.join(" · "));
  const items = sortAchievements(achievements.filter((a) => a.projectIds.includes(project.id) && isConfirmed(a)));
  if (items.length) {
    lines.push("");
    for (const a of items) lines.push(`- ${a.text}`);
  }
  return lines.join("\n");
}

/** 이력서 전체 (Markdown) */
export function renderResume(input: { profile?: ResumeProfile; projects: Project[]; achievements: Achievement[]; generatedAt?: string }): string {
  const { profile = {}, achievements } = input;
  const projects = sortProjects(input.projects.filter((p) => p.onResume));
  const out: string[] = [];
  if (profile.name) out.push(`# ${profile.name}`);
  if (profile.headline) out.push(profile.headline);
  if (profile.links?.length) out.push(profile.links.map((l) => `[${l.label}](${l.url})`).join(" · "));
  out.push(`> CareerSync 자동 생성 · ${input.generatedAt ?? new Date().toISOString().slice(0, 10)}`);
  out.push("", "## 경력 · 프로젝트");
  for (const p of projects) out.push("", renderProjectSection(p, achievements));
  return out.join("\n").trim() + "\n";
}

/**
 * 프로젝트 배정 확인 화면용 미리보기:
 * 성과 하나를 특정 프로젝트(또는 새 프로젝트)에 넣었을 때 해당 섹션의 Before / After.
 */
export function previewAssignment(input: {
  project: Project;
  achievements: Achievement[];
  candidate: Achievement;
  text?: string;
}): { before: string; after: string } {
  const before = renderProjectSection(input.project, input.achievements);
  const assigned: Achievement = {
    ...input.candidate,
    text: input.text ?? input.candidate.text,
    projectIds: [input.project.id],
    assignment: "확인됨",
    exposure: input.candidate.exposure.length ? input.candidate.exposure : ["이력서"],
  };
  const after = renderProjectSection(input.project, [...input.achievements.filter((a) => a.id !== assigned.id), assigned]);
  return { before, after };
}

/** 줄 단위 간단 diff (미리보기 강조용) */
export function lineDiff(before: string, after: string): { type: "same" | "add" | "remove"; line: string }[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const out: { type: "same" | "add" | "remove"; line: string }[] = [];
  for (const line of a) if (!setB.has(line)) out.push({ type: "remove", line });
  for (const line of b) out.push({ type: setA.has(line) ? "same" : "add", line });
  return out;
}
