/**
 * GitHub App 이 설치된 레포에서 [since, until) 기간의 "내 활동"을 모은다.
 * 코드(diff)는 읽지 않고 제목·본문·메시지와 변경 규모(줄 수·파일 수)만 가져온다.
 */
import type { GithubApi } from "./app";

export interface RepoInfo {
  fullName: string;
  url: string;
  private: boolean;
}

export interface PrActivity {
  number: number;
  title: string;
  body: string;
  url: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  labels: string[];
}

export interface CommitActivity {
  sha: string;
  message: string;
  url: string;
  date: string;
  additions?: number;
  deletions?: number;
}

export interface ReleaseActivity {
  kind: "release" | "tag";
  tag: string;
  name: string;
  body: string;
  url: string;
  date: string;
}

export interface IssueActivity {
  number: number;
  title: string;
  body: string;
  url: string;
  /** 기간 안에 연 이슈면 openedAt, 기간 안에 닫았으면 closedAt */
  openedAt: string | null;
  closedAt: string | null;
}

export interface RepoActivity {
  repo: RepoInfo;
  prs: PrActivity[];
  commits: CommitActivity[];
  releases: ReleaseActivity[];
  issues: IssueActivity[];
}

export interface CollectWindow {
  /** ISO, 포함 */
  since: string;
  /** ISO, 미포함 */
  until: string;
}

/** 커밋 하나하나의 변경 규모는 API 호출이 커밋 수만큼 들어서 레포당 이 개수까지만 */
const COMMIT_STATS_LIMIT = 30;
const TAG_LOOKUP_LIMIT = 10;

const inWindow = (iso: string | null | undefined, w: CollectWindow) => !!iso && iso >= w.since && iso < w.until;
const sameLogin = (a: string | null | undefined, b: string) => !!a && a.toLowerCase() === b.toLowerCase();
const toIso = (s: string) => new Date(s).toISOString();

export async function listInstalledRepos(api: GithubApi): Promise<RepoInfo[]> {
  const repos = await api.paginate<{ full_name: string; html_url: string; private: boolean }>("/installation/repositories", {
    pick: (body) => (body as { repositories: { full_name: string; html_url: string; private: boolean }[] }).repositories,
  });
  return repos.map((r) => ({ fullName: r.full_name, url: r.html_url, private: r.private }));
}

export async function collectRepoActivity(api: GithubApi, repo: RepoInfo, login: string, w: CollectWindow): Promise<RepoActivity> {
  const base = `/repos/${repo.fullName}`;

  // ---- 머지된 PR (최근 수정순으로 읽다가 기간 이전이면 멈춤) ----
  type PrListItem = { number: number; merged_at: string | null; updated_at: string; user: { login: string } | null };
  const closed = await api.paginate<PrListItem>(`${base}/pulls?state=closed&sort=updated&direction=desc`, {
    stop: (page) => page.length === 0 || toIso(page[page.length - 1]!.updated_at) < w.since,
    maxPages: 5,
  });
  const prs: PrActivity[] = [];
  const prShas = new Set<string>();
  for (const item of closed) {
    if (!item.merged_at || !inWindow(toIso(item.merged_at), w) || !sameLogin(item.user?.login, login)) continue;
    const pr = await api.get<{
      number: number;
      title: string;
      body: string | null;
      html_url: string;
      merged_at: string;
      additions: number;
      deletions: number;
      changed_files: number;
      commits: number;
      merge_commit_sha: string | null;
      labels: { name: string }[];
    }>(`${base}/pulls/${item.number}`);
    if (pr.merge_commit_sha) prShas.add(pr.merge_commit_sha);
    const commits = await api.paginate<{ sha: string }>(`${base}/pulls/${item.number}/commits`, { maxPages: 3 });
    for (const c of commits) prShas.add(c.sha);
    prs.push({
      number: pr.number,
      title: pr.title,
      body: pr.body ?? "",
      url: pr.html_url,
      mergedAt: toIso(pr.merged_at),
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      commits: pr.commits,
      labels: pr.labels.map((l) => l.name),
    });
  }

  // ---- PR 밖에서 기본 브랜치에 들어온 내 커밋 ----
  type CommitListItem = { sha: string; html_url: string; parents: unknown[]; commit: { message: string; author: { date: string } | null } };
  const rawCommits = await api.paginate<CommitListItem>(
    `${base}/commits?author=${encodeURIComponent(login)}&since=${encodeURIComponent(w.since)}&until=${encodeURIComponent(w.until)}`,
    { maxPages: 5 },
  );
  const commits: CommitActivity[] = [];
  for (const c of rawCommits) {
    if (prShas.has(c.sha) || c.parents.length > 1) continue;
    const date = c.commit.author?.date ? toIso(c.commit.author.date) : null;
    if (!inWindow(date, w)) continue;
    const entry: CommitActivity = { sha: c.sha, message: c.commit.message, url: c.html_url, date: date! };
    if (commits.length < COMMIT_STATS_LIMIT) {
      const detail = await api.get<{ stats?: { additions: number; deletions: number } }>(`${base}/commits/${c.sha}`);
      entry.additions = detail.stats?.additions;
      entry.deletions = detail.stats?.deletions;
    }
    commits.push(entry);
  }

  // ---- 릴리스 · 태그 ----
  type ReleaseItem = { tag_name: string; name: string | null; body: string | null; html_url: string; published_at: string | null; draft: boolean; author: { login: string } | null };
  const rawReleases = await api.paginate<ReleaseItem>(`${base}/releases`, { maxPages: 1 });
  const releases: ReleaseActivity[] = [];
  const releasedTags = new Set(rawReleases.map((r) => r.tag_name));
  for (const r of rawReleases) {
    const date = r.published_at ? toIso(r.published_at) : null;
    if (r.draft || !inWindow(date, w) || !sameLogin(r.author?.login, login)) continue;
    releases.push({ kind: "release", tag: r.tag_name, name: r.name || r.tag_name, body: r.body ?? "", url: r.html_url, date: date! });
  }
  const tags = await api.paginate<{ name: string; commit: { sha: string } }>(`${base}/tags`, { maxPages: 1 });
  for (const t of tags.slice(0, TAG_LOOKUP_LIMIT)) {
    if (releasedTags.has(t.name)) continue;
    const c = await api.get<{ author: { login: string } | null; commit: { author: { date: string } | null } }>(`${base}/commits/${t.commit.sha}`);
    const date = c.commit.author?.date ? toIso(c.commit.author.date) : null;
    if (!inWindow(date, w) || !sameLogin(c.author?.login, login)) continue;
    releases.push({ kind: "tag", tag: t.name, name: t.name, body: "", url: `${repo.url}/releases/tag/${encodeURIComponent(t.name)}`, date: date! });
  }

  // ---- 내가 만든 이슈 (기간 안에 열었거나 닫은 것) ----
  type IssueItem = { number: number; title: string; body: string | null; html_url: string; created_at: string; closed_at: string | null; pull_request?: unknown };
  const rawIssues = await api.paginate<IssueItem>(
    `${base}/issues?state=all&creator=${encodeURIComponent(login)}&since=${encodeURIComponent(w.since)}`,
    { maxPages: 3 },
  );
  const issues: IssueActivity[] = [];
  for (const i of rawIssues) {
    if (i.pull_request) continue;
    const openedAt = inWindow(toIso(i.created_at), w) ? toIso(i.created_at) : null;
    const closedAt = i.closed_at && inWindow(toIso(i.closed_at), w) ? toIso(i.closed_at) : null;
    if (!openedAt && !closedAt) continue;
    issues.push({ number: i.number, title: i.title, body: i.body ?? "", url: i.html_url, openedAt, closedAt });
  }

  return { repo, prs, commits, releases, issues };
}
