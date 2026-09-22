export type TimeValue = "lunch" | "dinner";
export type SceneValue = "solo" | "date" | "friends" | "family";

// U01検索対象の5料理（仕様書02_検索条件で定義された固定リスト）
export const U01_DISH_NAMES = [
  "ガパオ",
  "カオマンガイ",
  "パッタイ",
  "タイカレー",
  "トムヤムクン",
];

export type SearchConditions = {
  areaId: number | null;
  time: TimeValue | null;
  scene: SceneValue | null;
  dishId: number | null;
};

export function parsePositiveInt(
  value: string | null | undefined,
): number | null {
  if (!value || !/^[1-9][0-9]*$/.test(value)) {
    return null;
  }
  return Number(value);
}

export function parseTime(value: string | null | undefined): TimeValue | null {
  return value === "lunch" || value === "dinner" ? value : null;
}

export function parseScene(
  value: string | null | undefined,
): SceneValue | null {
  return value === "solo" ||
    value === "date" ||
    value === "friends" ||
    value === "family"
    ? value
    : null;
}

export function parseSearchConditions(
  getParam: (key: string) => string | null | undefined,
): SearchConditions {
  return {
    areaId: parsePositiveInt(getParam("area_id")),
    time: parseTime(getParam("time")),
    scene: parseScene(getParam("scene")),
    dishId: parsePositiveInt(getParam("dish_id")),
  };
}

export function toSearchParams(conditions: SearchConditions): URLSearchParams {
  const params = new URLSearchParams();
  if (conditions.areaId !== null) {
    params.set("area_id", String(conditions.areaId));
  }
  if (conditions.time !== null) {
    params.set("time", conditions.time);
  }
  if (conditions.scene !== null) {
    params.set("scene", conditions.scene);
  }
  if (conditions.dishId !== null) {
    params.set("dish_id", String(conditions.dishId));
  }
  return params;
}

export function buildSearchHref(conditions: SearchConditions): string {
  const query = toSearchParams(conditions).toString();
  return query ? `/search?${query}` : "/search";
}

export function buildTopHref(conditions: SearchConditions): string {
  const query = toSearchParams(conditions).toString();
  return query ? `/?${query}` : "/";
}

export function buildStoreHref(
  storeId: number,
  conditions: SearchConditions,
): string {
  const query = toSearchParams(conditions).toString();
  return query ? `/store/${storeId}?${query}` : `/store/${storeId}`;
}
