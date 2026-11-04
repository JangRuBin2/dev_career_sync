import { describe, expect, it } from "vitest";
import { extractNumbers, formatImprovement, improvementRate, numbersAppearIn } from "../src/metrics";

describe("improvementRate", () => {
  it("낮을수록 좋음", () => expect(improvementRate(820, 490, "낮을수록 좋음")).toBe(40.2));
  it("높을수록 좋음", () => expect(improvementRate(50, 80, "높을수록 좋음")).toBe(60));
  it("before 0 은 0", () => expect(improvementRate(0, 10, "높을수록 좋음")).toBe(0));
  it("포맷", () => {
    expect(formatImprovement(40.2)).toBe("+40.2%");
    expect(formatImprovement(null)).toBe("-");
  });
});

describe("numbersAppearIn", () => {
  it("콤마·소수 숫자를 추출한다", () => expect(extractNumbers("1,200건 → 3.5초")).toEqual([1200, 3.5]));
  it("원문에 있는 숫자만 통과", () => {
    expect(numbersAppearIn("p95 820ms → 490ms", 820, 490)).toBe(true);
    expect(numbersAppearIn("p95 820ms → 490ms", 820, 400)).toBe(false);
  });
});
