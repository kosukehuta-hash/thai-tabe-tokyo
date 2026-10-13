import { describe, expect, it } from "vitest";
import {
  LIST_ORIGIN_PARAM,
  buildStoreHrefFromList,
  getListOriginTarget,
  parseListOrigin,
} from "./list-origin";

describe("parseListOrigin（店舗詳細の from の検証）", () => {
  it("パラメータ名は from", () => {
    expect(LIST_ORIGIN_PARAM).toBe("from");
  });

  it.each(["notes", "favorites"] as const)(
    "有効な値（%s）はそのまま返る",
    (value) => {
      expect(parseListOrigin(value)).toBe(value);
    },
  );

  it.each([
    ["未指定", undefined],
    ["null", null],
    ["空文字", ""],
    ["空白だけ", " "],
    ["前後に空白がある", " notes "],
    ["大文字小文字が違う", "Notes"],
    ["大文字", "FAVORITES"],
    ["別の一覧名", "search"],
    ["パス形式（/notes）", "/notes"],
    ["パス形式（/favorites）", "/favorites"],
    ["外部URL", "https://evil.example"],
    ["プロトコル相対URL", "//evil.example"],
    ["バックスラッシュ始まり", "/\\evil"],
    ["制御文字を含む", "notes\n"],
    ["NULL文字を含む", "notes\u0000"],
    ["オブジェクトの組み込み名（__proto__）", "__proto__"],
    ["オブジェクトの組み込み名（constructor）", "constructor"],
    ["オブジェクトの組み込み名（toString）", "toString"],
    ["複数値を連結した文字列", "notes,favorites"],
  ])("無効な値（%s）は null になる", (_label, value) => {
    expect(parseListOrigin(value)).toBeNull();
  });
});

describe("getListOriginTarget（戻り先は固定の対応表）", () => {
  it("notes → /notes『メモ一覧』", () => {
    expect(getListOriginTarget("notes")).toEqual({
      href: "/notes",
      label: "メモ一覧",
    });
  });

  it("favorites → /favorites『お気に入り』", () => {
    expect(getListOriginTarget("favorites")).toEqual({
      href: "/favorites",
      label: "お気に入り",
    });
  });
});

describe("buildStoreHrefFromList（一覧から店舗詳細へのリンク先）", () => {
  it("メモ一覧から: /store/{id}?from=notes", () => {
    expect(buildStoreHrefFromList(123, "notes")).toBe("/store/123?from=notes");
  });

  it("お気に入りから: /store/{id}?from=favorites", () => {
    expect(buildStoreHrefFromList(5, "favorites")).toBe(
      "/store/5?from=favorites",
    );
  });

  it("作ったリンク先の from は、検証を通り、同じ一覧になる", () => {
    for (const origin of ["notes", "favorites"] as const) {
      const href = buildStoreHrefFromList(1, origin);
      const from = new URL(href, "http://internal.invalid").searchParams.get(
        LIST_ORIGIN_PARAM,
      );
      expect(parseListOrigin(from)).toBe(origin);
    }
  });
});
