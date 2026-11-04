/**
 * velog 비공식 GraphQL 클라이언트.
 *
 * ⚠️ velog 는 공식 API 를 제공하지 않는다. 아래 mutation 은 velog 오픈소스 서버(velog-server)의
 * writePost / editPost 스키마를 기준으로 하며, 예고 없이 바뀔 수 있다.
 * 실패하면 호출 측에서 "수동 발행 패키지"로 대체해야 한다.
 */

const ENDPOINT = "https://v2.velog.io/graphql";

export interface VelogCredentials {
  accessToken: string;
  refreshToken?: string;
}

export interface VelogPostInput {
  title: string;
  body: string;
  tags: string[];
  isTemp: boolean;
  isPrivate: boolean;
  urlSlug?: string;
  thumbnail?: string | null;
}

export interface VelogPostResult {
  id: string;
  urlSlug: string;
  username: string;
  url: string;
}

export class VelogApiError extends Error {
  constructor(
    message: string,
    readonly kind: "auth" | "graphql" | "http",
  ) {
    super(message);
    this.name = "VelogApiError";
  }
}

const POST_FIELDS = "id url_slug user { username }";

const WRITE_POST = `mutation WritePost($title: String, $body: String, $tags: [String], $is_markdown: Boolean, $is_temp: Boolean, $is_private: Boolean, $url_slug: String, $thumbnail: String, $meta: JSON, $series_id: ID) {
  writePost(title: $title, body: $body, tags: $tags, is_markdown: $is_markdown, is_temp: $is_temp, is_private: $is_private, url_slug: $url_slug, thumbnail: $thumbnail, meta: $meta, series_id: $series_id) { ${POST_FIELDS} }
}`;

const EDIT_POST = `mutation EditPost($id: ID!, $title: String, $body: String, $tags: [String], $is_markdown: Boolean, $is_temp: Boolean, $is_private: Boolean, $url_slug: String, $thumbnail: String, $meta: JSON, $series_id: ID) {
  editPost(id: $id, title: $title, body: $body, tags: $tags, is_markdown: $is_markdown, is_temp: $is_temp, is_private: $is_private, url_slug: $url_slug, thumbnail: $thumbnail, meta: $meta, series_id: $series_id) { ${POST_FIELDS} }
}`;

export function slugify(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || `post-${Date.now()}`
  );
}

export class VelogClient {
  constructor(
    private readonly creds: VelogCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const cookie = [`access_token=${this.creds.accessToken}`, this.creds.refreshToken && `refresh_token=${this.creds.refreshToken}`]
      .filter(Boolean)
      .join("; ");
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401 || res.status === 403) throw new VelogApiError(`velog 인증 실패 (${res.status}) — 토큰을 갱신하세요`, "auth");
    if (!res.ok) throw new VelogApiError(`velog HTTP ${res.status}`, "http");
    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join("; ");
      throw new VelogApiError(`velog GraphQL 오류: ${msg}`, /auth|login|token/i.test(msg) ? "auth" : "graphql");
    }
    if (!json.data) throw new VelogApiError("velog 응답에 data 가 없습니다", "graphql");
    return json.data;
  }

  private toVariables(input: VelogPostInput) {
    return {
      title: input.title,
      body: input.body,
      tags: input.tags,
      is_markdown: true,
      is_temp: input.isTemp,
      is_private: input.isPrivate,
      url_slug: input.urlSlug ?? slugify(input.title),
      thumbnail: input.thumbnail ?? null,
      meta: {},
      series_id: null,
    };
  }

  private toResult(p: { id: string; url_slug: string; user: { username: string } }): VelogPostResult {
    return {
      id: p.id,
      urlSlug: p.url_slug,
      username: p.user.username,
      url: `https://velog.io/@${p.user.username}/${encodeURIComponent(p.url_slug)}`,
    };
  }

  async writePost(input: VelogPostInput): Promise<VelogPostResult> {
    const data = await this.gql<{ writePost: { id: string; url_slug: string; user: { username: string } } }>(WRITE_POST, this.toVariables(input));
    return this.toResult(data.writePost);
  }

  /** 임시저장 글을 공개로 전환하는 등 기존 글 수정 */
  async editPost(id: string, input: VelogPostInput): Promise<VelogPostResult> {
    const data = await this.gql<{ editPost: { id: string; url_slug: string; user: { username: string } } }>(EDIT_POST, {
      id,
      ...this.toVariables(input),
    });
    return this.toResult(data.editPost);
  }
}
