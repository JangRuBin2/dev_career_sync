import { describe, expect, it } from "vitest";
import { parseSettingsForm, validateVelogUsername, validateWebhookUrl } from "../lib/settings-validate";

describe("설정 검증", () => {
  it("웹훅은 Slack/Discord https 만 (SSRF 방지)", () => {
    expect(validateWebhookUrl("https://hooks.slack.com/services/A/B/C")).toBe("https://hooks.slack.com/services/A/B/C");
    expect(validateWebhookUrl("https://discord.com/api/webhooks/1/x")).toContain("discord.com");
    expect(validateWebhookUrl("")).toBe("");
    for (const bad of ["http://hooks.slack.com/x", "https://169.254.169.254/latest", "https://hooks.slack.com.evil.io/x", "https://hooks.slack.com:8443/x", "nope"]) {
      expect(() => validateWebhookUrl(bad)).toThrow();
    }
  });
  it("velog 아이디는 경로 조작 불가", () => {
    expect(validateVelogUsername("@my_id")).toBe("my_id");
    expect(() => validateVelogUsername("../admin")).toThrow();
  });
  it("폼 → 설정 (숫자 범위)", () => {
    const fd = new FormData();
    fd.set("resumeName", " 홍길동 ");
    fd.set("postIntervalDays", "7");
    fd.set("autoDigest", "on");
    const s = parseSettingsForm(fd);
    expect(s).toMatchObject({ resumeName: "홍길동", postIntervalDays: 7, postLeadDays: 3, autoDigest: true });
    fd.set("postIntervalDays", "1000");
    expect(() => parseSettingsForm(fd)).toThrow();
  });
});
