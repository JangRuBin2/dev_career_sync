import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearEmptyAnthropicEnv, credentialSource, explainAuthError } from "../src/llm/auth";

const KEYS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID", "ANTHROPIC_IDENTITY_TOKEN_FILE", "ANTHROPIC_IDENTITY_TOKEN"];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
});

describe("credentialSource", () => {
  it("API 키가 있으면 최우선", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    process.env.ANTHROPIC_FEDERATION_RULE_ID = "fdrl_1";
    process.env.ANTHROPIC_IDENTITY_TOKEN_FILE = "/tmp/jwt";
    expect(credentialSource()).toBe("api-key");
  });
  it("WIF 변수 + 토큰 파일이면 workload-identity", () => {
    process.env.ANTHROPIC_FEDERATION_RULE_ID = "fdrl_1";
    process.env.ANTHROPIC_IDENTITY_TOKEN_FILE = "/tmp/jwt";
    expect(credentialSource()).toBe("workload-identity");
  });
  it("아무것도 없으면 ant 활성 프로필", () => expect(credentialSource()).toBe("active-profile"));
});

describe("clearEmptyAnthropicEnv", () => {
  it("빈 API 키가 WIF 를 가로채지 않게 제거", () => {
    const env: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: "  ", ANTHROPIC_AUTH_TOKEN: "tok", ANTHROPIC_FEDERATION_RULE_ID: "fdrl_1" };
    clearEmptyAnthropicEnv(env);
    expect("ANTHROPIC_API_KEY" in env).toBe(false);
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("tok");
  });
});

describe("explainAuthError", () => {
  it("401 이면 키 교체/자동 갱신 방법 안내", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    const msg = explainAuthError({ status: 401 });
    expect(msg).toContain("만료");
    expect(msg).toContain("Workload Identity Federation");
  });
  it("인증과 무관한 오류는 null", () => {
    expect(explainAuthError(new Error("boom"))).toBeNull();
    expect(explainAuthError({ status: 500 })).toBeNull();
  });
  it("SDK AuthenticationError 클래스도 인식", () => {
    const err = Object.create(Anthropic.AuthenticationError.prototype);
    expect(explainAuthError(err)).not.toBeNull();
  });
});
