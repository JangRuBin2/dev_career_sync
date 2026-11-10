import type { UserSettings } from "./db/store";

/** 알림 웹훅은 서버(cron)가 호출하므로 SSRF 방지를 위해 Slack · Discord 웹훅만 허용 */
const WEBHOOK_HOSTS = ["hooks.slack.com", "discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

export function validateWebhookUrl(raw: string): string {
  if (!raw) return "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("알림 웹훅 URL 형식이 올바르지 않아요");
  }
  if (u.protocol !== "https:" || !WEBHOOK_HOSTS.includes(u.hostname) || u.port) {
    throw new Error("알림은 Slack(hooks.slack.com) 또는 Discord 웹훅 URL 만 쓸 수 있어요");
  }
  return u.toString();
}

export function validateVelogUsername(raw: string): string {
  const v = raw.trim().replace(/^@/, "");
  if (v && !/^[A-Za-z0-9_-]{1,40}$/.test(v)) throw new Error("velog 아이디는 영문·숫자·-·_ 만 쓸 수 있어요");
  return v;
}

const intIn = (raw: string, min: number, max: number, label: string) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${label}은(는) ${min}~${max} 사이 정수여야 해요`);
  return n;
};

export function parseSettingsForm(fd: FormData): UserSettings {
  const s = (k: string) => (typeof fd.get(k) === "string" ? String(fd.get(k)).trim() : "");
  const denylist = s("denylist");
  if (denylist.length > 5000) throw new Error("금지어 목록이 너무 길어요 (5000자 이하)");
  return {
    resumeName: s("resumeName").slice(0, 80),
    resumeHeadline: s("resumeHeadline").slice(0, 200),
    denylist,
    velogUsername: validateVelogUsername(s("velogUsername")),
    postIntervalDays: intIn(s("postIntervalDays") || "14", 3, 90, "포스팅 주기"),
    postLeadDays: intIn(s("postLeadDays") || "3", 0, 14, "초안 미리 만들기"),
    notifyWebhookUrl: validateWebhookUrl(s("notifyWebhookUrl")),
    autoDigest: fd.get("autoDigest") === "on",
  };
}
