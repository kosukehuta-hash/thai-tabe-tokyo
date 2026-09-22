import { describe, expect, it } from "vitest";
import {
  formatHoursForList,
  formatPriceForDetail,
  formatPriceForList,
  formatVerifiedDate,
} from "./format";

describe("formatHoursForList", () => {
  it("returns null when value is null", () => {
    expect(formatHoursForList(null)).toBeNull();
  });

  it("returns the value unchanged when there is no note or separator", () => {
    expect(formatHoursForList("11:00〜14:00")).toBe("11:00〜14:00");
  });

  it("removes a parenthetical note", () => {
    expect(formatHoursForList("11:00〜14:00（L.O.13:30）")).toBe(
      "11:00〜14:00",
    );
  });

  it("returns null when only a parenthetical note remains after trimming", () => {
    expect(formatHoursForList("（休業中）")).toBeNull();
  });

  it("summarizes as day-based when every '／'-separated segment starts with a day prefix", () => {
    expect(formatHoursForList("月〜金11:00〜14:00／土日祝11:00〜15:00")).toBe(
      "曜日により営業時間が異なります",
    );
  });

  it("summarizes as day-based when every '、'-separated segment starts with a day prefix", () => {
    expect(formatHoursForList("月11:00〜14:00、火11:00〜14:00")).toBe(
      "曜日により営業時間が異なります",
    );
  });

  it("recognizes '平日' as a day prefix", () => {
    expect(formatHoursForList("平日11:00〜14:00／土日11:00〜15:00")).toBe(
      "曜日により営業時間が異なります",
    );
  });

  it("keeps the value unchanged when segments are separated but not all day-based", () => {
    expect(formatHoursForList("11:00〜14:00／17:00〜21:00")).toBe(
      "11:00〜14:00／17:00〜21:00",
    );
  });

  it("keeps the original string when a trailing separator leaves only one non-empty segment", () => {
    expect(formatHoursForList("11:00〜14:00／")).toBe("11:00〜14:00／");
  });
});

describe("formatPriceForList", () => {
  it("returns null when value is null", () => {
    expect(formatPriceForList(null)).toBeNull();
  });

  it("formats a price with a thousands separator and trailing tilde", () => {
    expect(formatPriceForList(1000)).toBe("¥1,000〜");
  });

  it("formats zero", () => {
    expect(formatPriceForList(0)).toBe("¥0〜");
  });
});

describe("formatPriceForDetail", () => {
  it("returns null when value is null", () => {
    expect(formatPriceForDetail(null)).toBeNull();
  });

  it("formats a price with a thousands separator and trailing tilde", () => {
    expect(formatPriceForDetail(1000)).toBe("1,000円〜");
  });
});

describe("formatVerifiedDate", () => {
  it("formats a date string into Japanese year/month/day", () => {
    expect(formatVerifiedDate("2026-01-05")).toBe("2026年1月5日");
  });

  it("does not zero-pad the month or day", () => {
    expect(formatVerifiedDate("2026-09-05")).toBe("2026年9月5日");
  });
});
