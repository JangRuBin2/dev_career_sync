import "server-only";
import { Client, createNotion } from "@careersync/core/notion";
import { updateNotionTokens } from "./db/store";

/**
 * Notion 공개 통합(public integration) OAuth.
 * Notion 개발자 포털에서 공개 통합을 만들고 Redirect URI 를 https://<앱>/api/notion/callback 으로 등록한다.
 */
export function notionOAuthConfig() {
  const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
  const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("NOTION_OAUTH_CLIENT_ID / NOTION_OAUTH_CLIENT_SECRET 이 필요합니다.");
  return { clientId, clientSecret };
}

const oauthBase = () => process.env.NOTION_BASE_URL ?? "https://api.notion.com";

export function notionAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL("/v1/oauth/authorize", oauthBase());
  url.searchParams.set("client_id", notionOAuthConfig().clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** 토큰 엔드포인트용 클라이언트 (Basic 인증은 SDK 가 client_id/secret 으로 처리) */
function oauthClient() {
  return new Client({ notionVersion: "2025-09-03", ...(process.env.NOTION_BASE_URL ? { baseUrl: process.env.NOTION_BASE_URL } : {}) });
}

export async function exchangeNotionCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = notionOAuthConfig();
  return oauthClient().oauth.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret });
}

export async function revokeNotionToken(token: string): Promise<void> {
  const { clientId, clientSecret } = notionOAuthConfig();
  await oauthClient().oauth.revoke({ token, client_id: clientId, client_secret: clientSecret });
}

/**
 * 사용자 토큰으로 Notion 클라이언트를 만든다.
 * 401 이 오면 refresh_token 으로 한 번 갱신해 DB 에 저장하고 같은 요청을 다시 보낸다.
 */
export function notionForUser(userId: string, tokens: { accessToken: string; refreshToken: string | null }): Client {
  let access = tokens.accessToken;
  let refresh = tokens.refreshToken;
  let refreshing: Promise<boolean> | null = null;

  const doRefresh = async (): Promise<boolean> => {
    if (!refresh) return false;
    try {
      const { clientId, clientSecret } = notionOAuthConfig();
      const res = await oauthClient().oauth.token({ grant_type: "refresh_token", refresh_token: refresh, client_id: clientId, client_secret: clientSecret });
      access = res.access_token;
      refresh = res.refresh_token ?? refresh;
      await updateNotionTokens(userId, access, res.refresh_token);
      return true;
    } catch (err) {
      console.warn("[notion] 토큰 갱신 실패", err);
      return false;
    }
  };

  const refreshingFetch: typeof fetch = async (input, init) => {
    const res = await fetch(input, init);
    if (res.status !== 401 || !refresh) return res;
    refreshing ??= doRefresh().finally(() => (refreshing = null));
    if (!(await refreshing)) return res;
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${access}`);
    return fetch(input, { ...init, headers });
  };

  return createNotion(access, { fetch: refreshingFetch });
}
