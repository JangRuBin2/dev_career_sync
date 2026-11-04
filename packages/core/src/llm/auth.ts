import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude 인증.
 * API 키는 코드로 "갱신"할 수 없다 (refresh token 이 없고, 새 키 발급은 Console/Admin 키 필요).
 * 대신 SDK 가 스스로 토큰을 발급·갱신하는 방식을 우선 권장한다:
 *   - GitHub Actions: Workload Identity Federation (GitHub OIDC 토큰 → 단기 Anthropic 토큰, 만료 전 자동 갱신)
 *   - 로컬: `ant auth login` (브라우저 로그인 → SDK 가 저장된 프로필 사용)
 *   - (대안) ANTHROPIC_API_KEY — 만료되면 사람이 새 키로 교체
 *
 * SDK 자격 증명 우선순위: API 키 / AUTH 토큰 → ANTHROPIC_PROFILE → WIF 환경변수 → 활성 프로필
 */

export type CredentialSource = "api-key" | "auth-token" | "profile" | "workload-identity" | "active-profile";

const has = (k: string) => Boolean(process.env[k]?.trim());

/** 빈 값(ANTHROPIC_API_KEY=)이 WIF·프로필을 가로채지 않도록 제거 */
export function clearEmptyAnthropicEnv(env: NodeJS.ProcessEnv = process.env) {
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"]) {
    if (k in env && !env[k]?.trim()) delete env[k];
  }
}

export function credentialSource(): CredentialSource {
  if (has("ANTHROPIC_API_KEY")) return "api-key";
  if (has("ANTHROPIC_AUTH_TOKEN")) return "auth-token";
  if (has("ANTHROPIC_PROFILE")) return "profile";
  if (has("ANTHROPIC_FEDERATION_RULE_ID") && (has("ANTHROPIC_IDENTITY_TOKEN_FILE") || has("ANTHROPIC_IDENTITY_TOKEN"))) return "workload-identity";
  return "active-profile";
}

export const CREDENTIAL_LABEL: Record<CredentialSource, string> = {
  "api-key": "API 키 (ANTHROPIC_API_KEY) — 만료되면 새 키로 교체 필요",
  "auth-token": "Bearer 토큰 (ANTHROPIC_AUTH_TOKEN)",
  profile: `ant 로그인 프로필 (ANTHROPIC_PROFILE=${process.env.ANTHROPIC_PROFILE ?? ""}) — 자동 갱신`,
  "workload-identity": "Workload Identity Federation — 자동 발급·갱신",
  "active-profile": "ant 로그인 활성 프로필 (`ant auth login`) — 자동 갱신",
};

export function createAnthropic(): Anthropic {
  clearEmptyAnthropicEnv();
  return new Anthropic();
}

/** 인증 오류를 사람이 바로 조치할 수 있는 안내로 바꾼다. 해당 없으면 null */
export function explainAuthError(err: unknown): string | null {
  const status = (err as { status?: number })?.status;
  const isAuth = err instanceof Anthropic.AuthenticationError || status === 401;
  const isPerm = err instanceof Anthropic.PermissionDeniedError || status === 403;
  const name = (err as { name?: string })?.name ?? "";
  const isConfig = /WorkloadIdentity|Credential/i.test(name) || /no credentials|could not resolve authentication/i.test(String((err as Error)?.message));
  if (!isAuth && !isPerm && !isConfig) return null;

  const source = credentialSource();
  const lines = [`Claude 인증 실패 (${CREDENTIAL_LABEL[source]})`];
  if (source === "api-key") {
    lines.push(
      "- API 키가 만료됐거나 잘못됐을 수 있어요. Console 에서 새 키를 만들어 .env / GitHub Secrets 의 ANTHROPIC_API_KEY 를 바꿔 주세요.",
      "- 매번 교체가 번거롭다면: 로컬은 `ant auth login`, GitHub Actions 는 Workload Identity Federation 을 쓰면 갱신이 자동이에요 (README 'Claude 인증').",
    );
  } else if (source === "workload-identity") {
    lines.push(
      "- 페더레이션 규칙의 subject/audience 가 이 워크플로와 맞는지, 서비스 계정이 워크스페이스 멤버인지 확인해 주세요.",
      "- 여러 워크스페이스를 대상으로 하는 규칙이면 ANTHROPIC_WORKSPACE_ID 도 필요해요.",
    );
  } else {
    lines.push("- `ant auth login` 으로 다시 로그인해 주세요 (리프레시 토큰도 언젠가는 만료돼요). `ant auth status` 로 상태를 볼 수 있어요.");
  }
  if (isPerm) lines.push("- 403: 이 자격 증명에 해당 워크스페이스/모델 권한이 없어요.");
  return lines.join("\n");
}
