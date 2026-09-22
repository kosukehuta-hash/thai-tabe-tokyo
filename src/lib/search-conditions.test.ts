import { describe, expect, it } from "vitest";
import {
  buildSearchHref,
  buildStoreHref,
  buildTopHref,
  parsePositiveInt,
  parseScene,
  parseSearchConditions,
  parseTime,
  toSearchParams,
} from "./search-conditions";

describe("parsePositiveInt", () => {
  it("parses a positive integer string", () => {
    expect(parsePositiveInt("123")).toBe(123);
  });

  it("rejects zero", () => {
    expect(parsePositiveInt("0")).toBeNull();
  });

  it("rejects a leading zero", () => {
    expect(parsePositiveInt("01")).toBeNull();
  });

  it("rejects a negative number", () => {
    expect(parsePositiveInt("-5")).toBeNull();
  });

  it("rejects a non-numeric string", () => {
    expect(parsePositiveInt("abc")).toBeNull();
  });

  it("rejects a decimal", () => {
    expect(parsePositiveInt("12.5")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parsePositiveInt("")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(parsePositiveInt(null)).toBeNull();
    expect(parsePositiveInt(undefined)).toBeNull();
  });
});

describe("parseTime", () => {
  it("accepts 'lunch' and 'dinner'", () => {
    expect(parseTime("lunch")).toBe("lunch");
    expect(parseTime("dinner")).toBe("dinner");
  });

  it("returns null for any other value", () => {
    expect(parseTime("brunch")).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });
});

describe("parseScene", () => {
  it("accepts each known scene value", () => {
    expect(parseScene("solo")).toBe("solo");
    expect(parseScene("date")).toBe("date");
    expect(parseScene("friends")).toBe("friends");
    expect(parseScene("family")).toBe("family");
  });

  it("returns null for any other value", () => {
    expect(parseScene("other")).toBeNull();
    expect(parseScene(null)).toBeNull();
    expect(parseScene(undefined)).toBeNull();
  });
});

describe("parseSearchConditions", () => {
  it("parses all valid params from the given getter", () => {
    const params: Record<string, string> = {
      area_id: "3",
      time: "dinner",
      scene: "family",
      dish_id: "7",
    };
    const conditions = parseSearchConditions((key) => params[key]);
    expect(conditions).toEqual({
      areaId: 3,
      time: "dinner",
      scene: "family",
      dishId: 7,
    });
  });

  it("falls back to null for missing or invalid params", () => {
    const conditions = parseSearchConditions(() => undefined);
    expect(conditions).toEqual({
      areaId: null,
      time: null,
      scene: null,
      dishId: null,
    });
  });
});

describe("toSearchParams", () => {
  it("produces an empty query when all conditions are null", () => {
    const params = toSearchParams({
      areaId: null,
      time: null,
      scene: null,
      dishId: null,
    });
    expect(params.toString()).toBe("");
  });

  it("includes only the set conditions", () => {
    const params = toSearchParams({
      areaId: 1,
      time: null,
      scene: null,
      dishId: null,
    });
    expect(params.toString()).toBe("area_id=1");
  });

  it("includes all conditions when set", () => {
    const params = toSearchParams({
      areaId: 1,
      time: "lunch",
      scene: "solo",
      dishId: 2,
    });
    expect(params.toString()).toBe("area_id=1&time=lunch&scene=solo&dish_id=2");
  });
});

describe("buildSearchHref", () => {
  it("returns the bare path when there are no conditions", () => {
    expect(
      buildSearchHref({ areaId: null, time: null, scene: null, dishId: null }),
    ).toBe("/search");
  });

  it("appends the query string when conditions are set", () => {
    expect(
      buildSearchHref({ areaId: 1, time: null, scene: null, dishId: null }),
    ).toBe("/search?area_id=1");
  });
});

describe("buildTopHref", () => {
  it("returns the bare path when there are no conditions", () => {
    expect(
      buildTopHref({ areaId: null, time: null, scene: null, dishId: null }),
    ).toBe("/");
  });

  it("appends the query string when conditions are set", () => {
    expect(
      buildTopHref({ areaId: 1, time: null, scene: null, dishId: null }),
    ).toBe("/?area_id=1");
  });
});

describe("buildStoreHref", () => {
  it("returns the bare store path when there are no conditions", () => {
    expect(
      buildStoreHref(5, {
        areaId: null,
        time: null,
        scene: null,
        dishId: null,
      }),
    ).toBe("/store/5");
  });

  it("appends the query string when conditions are set", () => {
    expect(
      buildStoreHref(5, { areaId: 1, time: null, scene: null, dishId: null }),
    ).toBe("/store/5?area_id=1");
  });
});
