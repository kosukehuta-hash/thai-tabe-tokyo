import { describe, expect, it } from "vitest";
import { parseStoreIdFromForm } from "./form-values";

describe("parseStoreIdFromForm", () => {
  it("正の整数の文字列を数値にする", () => {
    expect(parseStoreIdFromForm("123")).toBe(123);
  });

  it.each(["0", "01", "-1", "1.5", "abc", "1a", " 1", ""])(
    "不正な値 %j は null にする",
    (value) => {
      expect(parseStoreIdFromForm(value)).toBeNull();
    },
  );

  it("文字列以外（null・File）は null にする", () => {
    expect(parseStoreIdFromForm(null)).toBeNull();
    expect(parseStoreIdFromForm(new File(["1"], "1.txt"))).toBeNull();
  });
});
