/**
 * 모은 GitHub 활동 → Work Log 행.
 *  - 머지된 PR · 릴리스/태그: 항목마다 1행
 *  - PR 밖 커밋 · 이슈: 레포 · 하루(KST) 단위로 1행
 * 출처 키로 이미 넣은 항목은 건너뛴다.
 */
import { kstDate } from "../time";
import type { RepoActivity } from "./collect";

export interface GithubWorkLogEntry {
  sourceKey: string;
  title: string;
  /** KST YYYY-MM-DD */
  date: string;
  content: string;
  link: string;
  projectId: string | null;
}

const BODY_LIMIT = 1500;
const LINE_BODY_LIMIT = 300;
const CONTENT_LIMIT = 6000;

const clip = (s: string, n: number) => {
  const t = s.replace(/<!--[\s\S]*?-->/g, "").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};
const firstLine = (s: string) => s.split("\n")[0]!.trim();
const restLines = (s: string) => s.split("\n").slice(1).join("\n").trim();
const repoName = (fullName: string) => fullName.split("/")[1] ?? fullName;

/** 저장소 URL 비교용 (대소문자, .git, 끝 / 무시) */
export function normalizeRepoUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "").replace(/\.git$/, "");
}

export function buildGithubWorkLogs(
  activity: RepoActivity[],
  opts: { existingKeys: Set<string>; projectIdByRepoUrl: Map<string, string> },
): GithubWorkLogEntry[] {
  const out: GithubWorkLogEntry[] = [];
  const push = (e: GithubWorkLogEntry) => {
    if (opts.existingKeys.has(e.sourceKey)) return;
    out.push({ ...e, content: clip(e.content, CONTENT_LIMIT) });
  };

  for (const a of activity) {
    const { repo } = a;
    const projectId = opts.projectIdByRepoUrl.get(normalizeRepoUrl(repo.url)) ?? null;
    const name = repoName(repo.fullName);

    for (const pr of a.prs) {
      push({
        sourceKey: `github:${repo.fullName}#pr-${pr.number}`,
        title: `[${name}] PR #${pr.number} ${pr.title}`,
        date: kstDate(new Date(pr.mergedAt)),
        link: pr.url,
        projectId,
        content: [
          `GitHub · 머지된 PR · ${repo.fullName} #${pr.number}`,
          `변경: +${pr.additions} / -${pr.deletions} · 파일 ${pr.changedFiles}개 · 커밋 ${pr.commits}개`,
          ...(pr.labels.length ? [`라벨: ${pr.labels.join(", ")}`] : []),
          ...(pr.body.trim() ? ["", clip(pr.body, BODY_LIMIT)] : []),
        ].join("\n"),
      });
    }

    for (const rel of a.releases) {
      const label = rel.kind === "release" ? "릴리스" : "태그";
      push({
        sourceKey: `github:${repo.fullName}#${rel.kind}-${rel.tag}`,
        title: `[${name}] ${label} ${rel.name}`,
        date: kstDate(new Date(rel.date)),
        link: rel.url,
        projectId,
        content: [`GitHub · ${label} · ${repo.fullName} ${rel.tag}`, ...(rel.body.trim() ? ["", clip(rel.body, BODY_LIMIT)] : [])].join("\n"),
      });
    }

    // 커밋 · 이슈는 날짜별로 묶는다
    const days = new Map<string, { commits: typeof a.commits; issues: { issue: (typeof a.issues)[number]; event: string }[] }>();
    const day = (d: string) => {
      if (!days.has(d)) days.set(d, { commits: [], issues: [] });
      return days.get(d)!;
    };
    for (const c of a.commits) day(kstDate(new Date(c.date))).commits.push(c);
    for (const i of a.issues) {
      if (i.openedAt && i.closedAt && kstDate(new Date(i.openedAt)) === kstDate(new Date(i.closedAt))) {
        day(kstDate(new Date(i.openedAt))).issues.push({ issue: i, event: "열고 닫음" });
        continue;
      }
      if (i.openedAt) day(kstDate(new Date(i.openedAt))).issues.push({ issue: i, event: "열림" });
      if (i.closedAt) day(kstDate(new Date(i.closedAt))).issues.push({ issue: i, event: "닫음" });
    }

    for (const [date, d] of [...days.entries()].sort(([x], [y]) => x.localeCompare(y))) {
      const parts: string[] = [];
      if (d.commits.length) parts.push(`커밋 ${d.commits.length}건`);
      if (d.issues.length) parts.push(`이슈 ${d.issues.length}건`);
      const add = d.commits.reduce((s, c) => s + (c.additions ?? 0), 0);
      const del = d.commits.reduce((s, c) => s + (c.deletions ?? 0), 0);
      const lines = [`GitHub · ${repo.fullName} · ${date} 활동`];
      if (d.commits.length) {
        lines.push("", `커밋 (+${add} / -${del}):`);
        for (const c of d.commits) {
          const stat = c.additions !== undefined ? ` (+${c.additions}/-${c.deletions ?? 0})` : "";
          lines.push(`- ${firstLine(c.message)}${stat}`);
          const body = restLines(c.message);
          if (body) lines.push(`  ${clip(body, LINE_BODY_LIMIT).replace(/\n/g, "\n  ")}`);
        }
      }
      if (d.issues.length) {
        lines.push("", "이슈:");
        for (const { issue, event } of d.issues) {
          lines.push(`- #${issue.number} ${issue.title} (${event})`);
          if (issue.body.trim()) lines.push(`  ${clip(issue.body, LINE_BODY_LIMIT).replace(/\n/g, "\n  ")}`);
        }
      }
      push({
        sourceKey: `github:${repo.fullName}#day-${date}`,
        title: `[${name}] ${date} ${parts.join(" · ")}`,
        date,
        link: `${repo.url}/commits`,
        projectId,
        content: lines.join("\n"),
      });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}
