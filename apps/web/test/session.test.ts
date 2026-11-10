import { beforeEach, describe, expect, it } from "vitest";
import { safeNext, signSession, verifySession } from "../lib/session";

const USER = { userId: "3f2b8c1e-5d4a-4b6c-9e8f-1a2b3c4d5e6f", githubId: "12345", login: "me" };

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "x".repeat(40);
  });

  it("서명된 세션은 사용자 ID 와 함께 통과한다 (누구나 가입)", async () => {
    expect(await verifySession(await signSession(USER))).toEqual(USER);
  });

  it("1인용 시절 세션(sub = GitHub 숫자 ID)은 거부해 다시 로그인하게 한다", async () => {
    const legacy = await signSession({ ...USER, userId: "12345" });
    expect(await verifySession(legacy)).toBeNull();
  });

  it("위조/빈 토큰은 거부한다", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("abc.def.ghi")).toBeNull();
    const token = await signSession(USER);
    process.env.SESSION_SECRET = "y".repeat(40);
    expect(await verifySession(token)).toBeNull();
  });
});

describe("safeNext", () => {
  it("같은 사이트 상대 경로만 허용", () => {
    expect(safeNext("/dashboard/inbox")).toBe("/dashboard/inbox");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});
