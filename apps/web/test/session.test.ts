import { beforeEach, describe, expect, it } from "vitest";
import { signSession, verifySession } from "../lib/session";

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "x".repeat(40);
    process.env.ALLOWED_GITHUB_ID = "12345";
  });

  it("허용된 GitHub ID 의 세션만 통과한다", async () => {
    const token = await signSession({ githubId: "12345", login: "me" });
    expect(await verifySession(token)).toEqual({ githubId: "12345", login: "me" });
  });

  it("다른 계정 ID 는 거부한다", async () => {
    const token = await signSession({ githubId: "999", login: "other" });
    expect(await verifySession(token)).toBeNull();
  });

  it("위조/빈 토큰은 거부한다", async () => {
    const token = await signSession({ githubId: "12345", login: "me" });
    expect(await verifySession(`${token.slice(0, -2)}xx`)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });

  it("짧은 SESSION_SECRET 은 에러", async () => {
    process.env.SESSION_SECRET = "short";
    await expect(signSession({ githubId: "1", login: "a" })).rejects.toThrow("32자");
  });
});

import { isTruthyEnv } from "../lib/session";
describe("isTruthyEnv", () => {
  it("다양한 표기를 켜짐으로", () => {
    for (const v of ["1", "true", " 1 ", "1   # 메모", '"1"', "TRUE", "yes"]) expect(isTruthyEnv(v)).toBe(true);
  });
  it("그 외는 꺼짐", () => {
    for (const v of [undefined, "", "0", "false", "#1", "no"]) expect(isTruthyEnv(v)).toBe(false);
  });
});
