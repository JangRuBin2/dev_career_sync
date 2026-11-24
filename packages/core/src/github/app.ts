/**
 * 읽기 전용 GitHub App 인증.
 * 앱 비밀키로 JWT(10분)를 서명 → 설치(installation) 토큰(1시간)을 그때그때 발급한다. 저장·갱신할 토큰이 없다.
 */
import { createSign } from "node:crypto";

export interface GithubAppConfig {
  appId: string;
  /** PEM. Vercel 환경변수에 한 줄로 넣었으면 "\n" 이 문자 그대로 들어오므로 되돌린다 */
  privateKey: string;
  /** 없으면 앱의 첫 번째 설치를 쓴다 (1인 전용) */
  installationId?: string;
}

const API = "https://api.github.com";

/** 환경변수에서 앱 설정을 읽는다. 필수 값이 없으면 null (수집 작업은 건너뜀) */
export function githubAppFromEnv(env: Record<string, string | undefined> = process.env): GithubAppConfig | null {
  const appId = env.GITHUB_APP_ID?.trim();
  const privateKey = env.GITHUB_APP_PRIVATE_KEY?.trim();
  if (!appId || !privateKey) return null;
  return { appId, privateKey, installationId: env.GITHUB_APP_INSTALLATION_ID?.trim() || undefined };
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

export function signAppJwt(cfg: GithubAppConfig, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60; // 시계 오차 여유
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: cfg.appId }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(cfg.privateKey.replace(/\\n/g, "\n")).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const headers = (auth: string) => ({
  Authorization: `Bearer ${auth}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "careersync",
});

/** 설치 토큰 발급 (1시간 유효) */
export async function installationToken(cfg: GithubAppConfig, fetchImpl: typeof fetch = fetch): Promise<string> {
  const jwt = signAppJwt(cfg);
  let id = cfg.installationId;
  if (!id) {
    const res = await fetchImpl(`${API}/app/installations`, { headers: headers(jwt) });
    if (!res.ok) throw new Error(`GitHub App 설치 목록을 읽지 못했어요 (${res.status}). GITHUB_APP_ID·GITHUB_APP_PRIVATE_KEY 를 확인하세요.`);
    const list = (await res.json()) as { id: number }[];
    if (!list[0]) throw new Error("GitHub App 이 아직 어느 레포에도 설치되지 않았어요. 앱 설정에서 Install 후 레포를 고르세요.");
    id = String(list[0].id);
  }
  const res = await fetchImpl(`${API}/app/installations/${id}/access_tokens`, { method: "POST", headers: headers(jwt) });
  if (!res.ok) throw new Error(`GitHub App 토큰 발급 실패 (${res.status})`);
  return ((await res.json()) as { token: string }).token;
}

/** 설치 토큰으로 GitHub REST 호출. 페이지네이션은 stop 이 true 를 돌려줄 때까지 이어 읽는다 */
export function githubApi(token: string, fetchImpl: typeof fetch = fetch) {
  async function get<T>(path: string): Promise<T> {
    const res = await fetchImpl(path.startsWith("http") ? path : `${API}${path}`, { headers: headers(token) });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
    return (await res.json()) as T;
  }
  async function paginate<T>(path: string, opts: { pick?: (body: unknown) => T[]; stop?: (page: T[]) => boolean; maxPages?: number } = {}): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = `${API}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
    for (let i = 0; url && i < (opts.maxPages ?? 10); i++) {
      const res: Response = await fetchImpl(url, { headers: headers(token) });
      if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
      const body: unknown = await res.json();
      const page = opts.pick ? opts.pick(body) : (body as T[]);
      out.push(...page);
      if (opts.stop?.(page)) break;
      url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
    }
    return out;
  }
  return { get, paginate };
}
export type GithubApi = ReturnType<typeof githubApi>;
