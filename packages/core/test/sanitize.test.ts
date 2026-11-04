import { describe, expect, it } from "vitest";
import { findLeaks, maskText, parseDenylist } from "../src/sanitize";

describe("parseDenylist", () => {
  it("쉼표/줄바꿈 구분, 기본 치환어, 긴 단어 우선 정렬", () => {
    const rules = parseDenylist("토스=A사, 토스페이먼츠=A사 결제\n비밀프로젝트");
    expect(rules.map((r) => r.from)).toEqual(["토스페이먼츠", "비밀프로젝트", "토스"]);
    expect(rules.find((r) => r.from === "비밀프로젝트")?.to).toBe("[비공개]");
  });
  it("빈 값은 빈 배열", () => {
    expect(parseDenylist(undefined)).toEqual([]);
  });
});

describe("maskText", () => {
  const rules = parseDenylist("ACME=A사,ACME Pay=A사 결제");
  it("금지어를 대소문자 무시하고 치환한다", () => {
    expect(maskText("acme pay 장애 대응, ACME 내부 회의", rules)).toBe("A사 결제 장애 대응, A사 내부 회의");
  });
  it("이메일·전화번호·IP·내부 URL·토큰을 가린다", () => {
    const out = maskText("kim@acme.co.kr 010-1234-5678 10.0.0.12 https://grafana.acme.internal/d/x ghp_abcdefghijklmnopqrstuv", []);
    expect(out).toBe("[이메일] [전화번호] [IP] [내부 URL] [토큰]");
  });
});

describe("findLeaks", () => {
  it("남아 있는 금지어를 보고한다", () => {
    const rules = parseDenylist("ACME=A사");
    expect(findLeaks("ACME 에서 일했다", rules)).toContain("ACME");
    expect(findLeaks("A사 에서 일했다", rules)).toEqual([]);
  });
});
