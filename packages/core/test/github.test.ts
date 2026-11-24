import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildGithubWorkLogs, collectRepoActivity, githubApi, githubAppFromEnv, normalizeRepoUrl, signAppJwt, type RepoActivity } from "../src/github";

const repo = { fullName: "me/app", url: "https://github.com/me/app", private: true };

const activity: RepoActivity = {
  repo,
  prs: [
    {
      number: 12,
      title: "결제 API 캐시",
      body: "<!-- 템플릿 -->응답 시간 개선",
      url: "https://github.com/me/app/pull/12",
      mergedAt: "2026-11-20T15:30:00.000Z", // KST 11-21 00:30
      additions: 120,
      deletions: 30,
      changedFiles: 5,
      commits: 4,
      labels: ["perf"],
    },
  ],
  commits: [
    { sha: "a", message: "fix: 오타\n\n상세 설명", url: "u", date: "2026-11-21T01:00:00.000Z", additions: 2, deletions: 1 },
    { sha: "b", message: "docs: README", url: "u", date: "2026-11-21T03:00:00.000Z" },
  ],
  releases: [{ kind: "release", tag: "v1.0.0", name: "첫 출시", body: "", url: "r", date: "2026-11-22T00:00:00.000Z" }],
  issues: [
    { number: 3, title: "로그인 버그", body: "", url: "i", openedAt: "2026-11-21T02:00:00.000Z", closedAt: "2026-11-21T05:00:00.000Z" },
  ],
};

describe("buildGithubWorkLogs", () => {
  const projectIdByRepoUrl = new Map([[normalizeRepoUrl("https://GitHub.com/me/app.git/"), "proj-1"]]);

  it("PR·릴리스는 1건씩, 커밋·이슈는 레포·KST 하루 단위로 묶는다", () => {
    const entries = buildGithubWorkLogs([activity], { existingKeys: new Set(), projectIdByRepoUrl });
    expect(entries.map((e) => e.sourceKey)).toEqual([
      "github:me/app#pr-12",
      "github:me/app#day-2026-11-21",
      "github:me/app#release-v1.0.0",
    ]);
    const pr = entries[0]!;
    expect(pr.date).toBe("2026-11-21");
    expect(pr.title).toBe("[app] PR #12 결제 API 캐시");
    expect(pr.content).toContain("변경: +120 / -30 · 파일 5개 · 커밋 4개");
    expect(pr.content).not.toContain("템플릿");
    expect(pr.projectId).toBe("proj-1");

    const day = entries[1]!;
    expect(day.title).toBe("[app] 2026-11-21 커밋 2건 · 이슈 1건");
    expect(day.content).toContain("- fix: 오타 (+2/-1)");
    expect(day.content).toContain("  상세 설명");
    expect(day.content).toContain("- #3 로그인 버그 (열고 닫음)");
  });

  it("이미 넣은 출처 키는 건너뛴다", () => {
    const entries = buildGithubWorkLogs([activity], { existingKeys: new Set(["github:me/app#pr-12"]), projectIdByRepoUrl: new Map() });
    expect(entries.some((e) => e.sourceKey === "github:me/app#pr-12")).toBe(false);
    expect(entries.every((e) => e.projectId === null)).toBe(true);
  });
});

describe("GitHub App 인증", () => {
  it("환경변수가 없으면 null", () => {
    expect(githubAppFromEnv({})).toBeNull();
    expect(githubAppFromEnv({ GITHUB_APP_ID: "1", GITHUB_APP_PRIVATE_KEY: "k" })).toEqual({ appId: "1", privateKey: "k", installationId: undefined });
  });

  it("한 줄로 넣은 PEM(\\n 문자)으로도 RS256 JWT 를 서명한다", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
    const jwt = signAppJwt({ appId: "42", privateKey: pem }, Date.UTC(2026, 10, 24));
    const [h, p, s] = jwt.split(".");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s!, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(p!, "base64url").toString())).toMatchObject({ iss: "42" });
  });
});

describe("collectRepoActivity", () => {
  it("기간 안의 내 PR·커밋·이슈만 모으고, PR 에 포함된 커밋은 뺀다", async () => {
    const w = { since: "2026-11-20T15:00:00.000Z", until: "2026-11-21T15:00:00.000Z" };
    const routes: Record<string, unknown> = {
      "/repos/me/app/pulls?state=closed": [
        { number: 12, merged_at: "2026-11-21T01:00:00Z", updated_at: "2026-11-21T01:00:00Z", user: { login: "Me" } },
        { number: 13, merged_at: "2026-11-21T01:00:00Z", updated_at: "2026-11-21T01:00:00Z", user: { login: "other" } },
        { number: 9, merged_at: "2026-11-10T01:00:00Z", updated_at: "2026-11-10T01:00:00Z", user: { login: "me" } },
      ],
      "/repos/me/app/pulls/12/commits": [{ sha: "in-pr" }],
      "/repos/me/app/pulls/12": {
        number: 12, title: "t", body: null, html_url: "pr", merged_at: "2026-11-21T01:00:00Z",
        additions: 1, deletions: 2, changed_files: 3, commits: 1, merge_commit_sha: "merge", labels: [],
      },
      "/repos/me/app/commits?author": [
        { sha: "in-pr", html_url: "c", parents: [{}], commit: { message: "x", author: { date: "2026-11-21T01:00:00Z" } } },
        { sha: "merge", html_url: "c", parents: [{}], commit: { message: "squash", author: { date: "2026-11-21T01:00:00Z" } } },
        { sha: "loose", html_url: "c", parents: [{}], commit: { message: "hotfix", author: { date: "2026-11-21T02:00:00Z" } } },
      ],
      "/repos/me/app/commits/loose": { stats: { additions: 5, deletions: 0 } },
      "/repos/me/app/releases": [],
      "/repos/me/app/tags": [],
      "/repos/me/app/issues": [
        { number: 1, title: "i", body: null, html_url: "i", created_at: "2026-11-21T03:00:00Z", closed_at: null },
        { number: 2, title: "pr", body: null, html_url: "p", created_at: "2026-11-21T03:00:00Z", closed_at: null, pull_request: {} },
      ],
    };
    const fakeFetch = (async (input: string | URL) => {
      const path = String(input).replace("https://api.github.com", "");
      const key = Object.keys(routes)
        .filter((k) => path.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      if (!key) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(routes[key]), { status: 200 });
    }) as typeof fetch;

    const a = await collectRepoActivity(githubApi("t", fakeFetch), repo, "me", w);
    expect(a.prs.map((p) => p.number)).toEqual([12]);
    expect(a.commits.map((c) => c.sha)).toEqual(["loose"]);
    expect(a.commits[0]).toMatchObject({ additions: 5, deletions: 0 });
    expect(a.issues.map((i) => i.number)).toEqual([1]);
  });
});
