import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchConditions } from "./search-conditions";
import {
  SEARCH_SCROLL_STORAGE_KEY_PREFIX,
  buildSearchScrollKey,
  saveSearchScrollY,
  takeSearchScrollY,
} from "./search-scroll";

const conditionsA: SearchConditions = {
  areaId: 1,
  time: "lunch",
  scene: null,
  dishId: null,
};
const conditionsB: SearchConditions = {
  areaId: 2,
  time: "dinner",
  scene: "solo",
  dishId: 3,
};

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

describe("buildSearchScrollKey", () => {
  it("プレフィックスは従来のまま変わらない", () => {
    expect(SEARCH_SCROLL_STORAGE_KEY_PREFIX).toBe(
      "thai-tabe-tokyo:search-scroll-y:",
    );
  });

  it("キーは「プレフィックス + 検索条件のクエリ文字列」で、従来と同じ", () => {
    expect(buildSearchScrollKey(conditionsA)).toBe(
      "thai-tabe-tokyo:search-scroll-y:area_id=1&time=lunch",
    );
  });

  it("条件なしならプレフィックスだけになる", () => {
    expect(
      buildSearchScrollKey({
        areaId: null,
        time: null,
        scene: null,
        dishId: null,
      }),
    ).toBe(SEARCH_SCROLL_STORAGE_KEY_PREFIX);
  });

  it("同じ条件なら同じキー", () => {
    expect(buildSearchScrollKey({ ...conditionsA })).toBe(
      buildSearchScrollKey(conditionsA),
    );
  });

  it("条件が違えば違うキー", () => {
    expect(buildSearchScrollKey(conditionsA)).not.toBe(
      buildSearchScrollKey(conditionsB),
    );
  });
});

describe("saveSearchScrollY / takeSearchScrollY", () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
    vi.stubGlobal("sessionStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("保存した位置を同じ条件で取り出せ、取り出すと削除される", () => {
    saveSearchScrollY(conditionsA, 480);
    expect(storage.data.get(buildSearchScrollKey(conditionsA))).toBe("480");
    expect(takeSearchScrollY(conditionsA)).toBe(480);
    expect(storage.data.size).toBe(0);
    expect(takeSearchScrollY(conditionsA)).toBeNull();
  });

  it("検索条件ごとに別々に保存される", () => {
    saveSearchScrollY(conditionsA, 100);
    saveSearchScrollY(conditionsB, 900);
    expect(takeSearchScrollY(conditionsA)).toBe(100);
    expect(takeSearchScrollY(conditionsB)).toBe(900);
  });

  it("未保存なら null", () => {
    expect(takeSearchScrollY(conditionsA)).toBeNull();
  });

  it("不正な値（数値でない・負数）は null で、値は削除される", () => {
    const key = buildSearchScrollKey(conditionsA);
    storage.data.set(key, "abc");
    expect(takeSearchScrollY(conditionsA)).toBeNull();
    expect(storage.data.has(key)).toBe(false);

    storage.data.set(key, "-5");
    expect(takeSearchScrollY(conditionsA)).toBeNull();
    expect(storage.data.has(key)).toBe(false);
  });

  it("sessionStorage が例外を出しても、例外を出さず null を返す", () => {
    const thrower = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("sessionStorage", {
      getItem: thrower,
      setItem: thrower,
      removeItem: thrower,
    });
    expect(() => saveSearchScrollY(conditionsA, 10)).not.toThrow();
    expect(takeSearchScrollY(conditionsA)).toBeNull();
  });

  it("sessionStorage が存在しなくても例外を出さない（SSR相当）", () => {
    vi.unstubAllGlobals();
    expect(() => saveSearchScrollY(conditionsA, 10)).not.toThrow();
    expect(takeSearchScrollY(conditionsA)).toBeNull();
  });
});
