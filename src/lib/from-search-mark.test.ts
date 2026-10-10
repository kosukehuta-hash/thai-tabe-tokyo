import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FROM_SEARCH_STORAGE_KEY,
  clearCameFromSearchMark,
  hasCameFromSearch,
  markCameFromSearch,
} from "./from-search-mark";

// Vitestはnode環境で動くため、sessionStorageの代わりに簡易な偽物を用意する
function createFakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("from-search-mark", () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
    vi.stubGlobal("sessionStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("キー文字列は従来のまま変わらない", () => {
    expect(FROM_SEARCH_STORAGE_KEY).toBe("thai-tabe-tokyo:from-search");
  });

  it("markCameFromSearch は {storeId} の文字列形式のJSONを書き込む", () => {
    markCameFromSearch(12);
    expect(storage.data.get(FROM_SEARCH_STORAGE_KEY)).toBe(
      JSON.stringify({ storeId: "12" }),
    );
  });

  it("同じ storeId なら true", () => {
    markCameFromSearch(12);
    expect(hasCameFromSearch(12)).toBe(true);
  });

  it("別の storeId なら false", () => {
    markCameFromSearch(12);
    expect(hasCameFromSearch(13)).toBe(false);
  });

  it("印がなければ false", () => {
    expect(hasCameFromSearch(12)).toBe(false);
  });

  it("JSONが壊れていても例外を出さず false", () => {
    storage.data.set(FROM_SEARCH_STORAGE_KEY, "{broken");
    expect(() => hasCameFromSearch(12)).not.toThrow();
    expect(hasCameFromSearch(12)).toBe(false);
  });

  it("storeId が文字列でないJSONは false", () => {
    storage.data.set(FROM_SEARCH_STORAGE_KEY, JSON.stringify({ storeId: 12 }));
    expect(hasCameFromSearch(12)).toBe(false);
  });

  it("clearCameFromSearchMark は印を消す", () => {
    markCameFromSearch(12);
    clearCameFromSearchMark();
    expect(storage.data.has(FROM_SEARCH_STORAGE_KEY)).toBe(false);
    expect(hasCameFromSearch(12)).toBe(false);
  });

  it("印がなくても clearCameFromSearchMark は例外を出さない", () => {
    expect(() => clearCameFromSearchMark()).not.toThrow();
  });

  describe("sessionStorage が利用できない場合", () => {
    beforeEach(() => {
      const thrower = () => {
        throw new Error("denied");
      };
      vi.stubGlobal("sessionStorage", {
        getItem: thrower,
        setItem: thrower,
        removeItem: thrower,
      });
    });

    it("3つの関数とも例外を出さない（読み取りは false）", () => {
      expect(() => markCameFromSearch(12)).not.toThrow();
      expect(() => clearCameFromSearchMark()).not.toThrow();
      expect(hasCameFromSearch(12)).toBe(false);
    });
  });

  describe("sessionStorage が存在しない場合（SSR相当）", () => {
    beforeEach(() => {
      vi.unstubAllGlobals();
    });

    it("3つの関数とも例外を出さない（読み取りは false）", () => {
      expect(typeof sessionStorage).toBe("undefined");
      expect(() => markCameFromSearch(12)).not.toThrow();
      expect(() => clearCameFromSearchMark()).not.toThrow();
      expect(hasCameFromSearch(12)).toBe(false);
    });
  });
});
