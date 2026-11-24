import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../lib/db/store";
import { isDue } from "../lib/jobs";

const fri = new Date("2026-11-13T09:00:00Z"); // 금 18:00 KST
const thu = new Date("2026-11-12T09:00:00Z");
const daysAgo = (d: Date, n: number) => new Date(d.getTime() - n * 86400_000);

describe("isDue", () => {
  it("주간 정리: 처음엔 금요일에만, 이후 6.5일 간격, 끄면 안 함", () => {
    expect(isDue("weekly-digest", DEFAULT_SETTINGS, null, fri)).toBe(true);
    expect(isDue("weekly-digest", DEFAULT_SETTINGS, null, thu)).toBe(false);
    expect(isDue("weekly-digest", DEFAULT_SETTINGS, daysAgo(thu, 7), thu)).toBe(true);
    expect(isDue("weekly-digest", DEFAULT_SETTINGS, daysAgo(fri, 3), fri)).toBe(false);
    expect(isDue("weekly-digest", { ...DEFAULT_SETTINGS, autoDigest: false }, null, fri)).toBe(false);
  });
  it("초안·RSS: 하루 한 번, RSS 는 velog 아이디가 있을 때만", () => {
    expect(isDue("draft-posts", DEFAULT_SETTINGS, null, thu)).toBe(true);
    expect(isDue("draft-posts", DEFAULT_SETTINGS, new Date(thu.getTime() - 3600_000), thu)).toBe(false);
    expect(isDue("sync-rss", DEFAULT_SETTINGS, null, thu)).toBe(false);
    expect(isDue("sync-rss", { ...DEFAULT_SETTINGS, velogUsername: "me" }, null, thu)).toBe(true);
  });
});
