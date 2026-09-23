import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * U02のE2Eテストは「特定の店舗名・store_idの決め打ち」を避けるため、
 * アプリと同じ公開Supabaseデータをテスト実行時にREST経由（読み取り専用・publishable keyのみ使用）
 * で取得し、期待結果をその場で計算する。INSERT/UPDATE/DELETEは一切行わない。
 */

export type PublishedStore = {
  store_id: number;
  area_id: number;
  walk_minutes: number;
  has_lunch: boolean;
  has_dinner: boolean;
  scene_solo: boolean;
  scene_date: boolean;
  scene_friends: boolean;
  scene_family: boolean;
};

export type MasterArea = { area_id: number; area_name: string };

function readEnvLocal(): { url: string; key: string } {
  const envPath = path.resolve(__dirname, "../.env.local");
  const content = readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx === -1) {
      continue;
    }
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  const url = vars["NEXT_PUBLIC_SUPABASE_URL"];
  const key = vars["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error(
      ".env.localにNEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYが見つかりません",
    );
  }
  return { url, key };
}

async function restGet<T>(queryPath: string): Promise<T> {
  const { url, key } = readEnvLocal();
  const res = await fetch(`${url}/rest/v1/${queryPath}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(
      `Supabase REST取得に失敗しました: ${queryPath} (status=${res.status})`,
    );
  }
  return (await res.json()) as T;
}

export async function fetchPublishedStores(): Promise<PublishedStore[]> {
  return restGet<PublishedStore[]>(
    "stores?select=store_id,area_id,walk_minutes,has_lunch,has_dinner,scene_solo,scene_date,scene_friends,scene_family&is_published=eq.true",
  );
}

export async function fetchActiveAreas(): Promise<MasterArea[]> {
  return restGet<MasterArea[]>(
    "areas?select=area_id,area_name&is_active=eq.true&order=display_order.asc",
  );
}

export async function fetchAvailableStoreIdsForDish(
  dishId: number,
): Promise<number[]> {
  const rows = await restGet<{ store_id: number }[]>(
    `store_dishes?select=store_id&dish_id=eq.${dishId}&is_available=eq.true`,
  );
  return rows.map((row) => row.store_id);
}

export type StoreDishRow = {
  store_id: number;
  dish_id: number;
  display_order: number;
};

export async function fetchAvailableStoreDishes(): Promise<StoreDishRow[]> {
  return restGet<StoreDishRow[]>(
    "store_dishes?select=store_id,dish_id,display_order&is_available=eq.true&order=store_id.asc,display_order.asc",
  );
}

export type DishMaster = { dish_id: number; dish_name: string };

export async function fetchDishes(): Promise<DishMaster[]> {
  return restGet<DishMaster[]>("dishes?select=dish_id,dish_name");
}

/**
 * src/app/search/page.tsx の otherDishText 計算（選択料理を除く提供中料理の
 * 表示順先頭1件）をテスト側で再現する。
 */
export function computeExpectedOtherDishName(
  storeDishes: StoreDishRow[],
  dishNameById: Map<number, string>,
  storeId: number,
  excludeDishId: number,
): string | null {
  const others = storeDishes
    .filter((row) => row.store_id === storeId && row.dish_id !== excludeDishId)
    .sort((a, b) => a.display_order - b.display_order);
  const first = others[0];
  return first ? (dishNameById.get(first.dish_id) ?? null) : null;
}

export type SceneValue = "solo" | "date" | "friends" | "family";

const SCENE_COLUMN: Record<SceneValue, keyof PublishedStore> = {
  solo: "scene_solo",
  date: "scene_date",
  friends: "scene_friends",
  family: "scene_family",
};

export type FilterConditions = {
  areaId?: number | null;
  time?: "lunch" | "dinner" | null;
  scene?: SceneValue | null;
  availableStoreIds?: number[] | null;
};

/** src/lib/queries/search.ts の絞り込み・並び順ロジックをテスト側で再現する。 */
export function filterAndSortStores(
  stores: PublishedStore[],
  conditions: FilterConditions,
): PublishedStore[] {
  return stores
    .filter((s) => conditions.areaId == null || s.area_id === conditions.areaId)
    .filter((s) => conditions.time !== "lunch" || s.has_lunch)
    .filter((s) => conditions.time !== "dinner" || s.has_dinner)
    .filter((s) => !conditions.scene || s[SCENE_COLUMN[conditions.scene]])
    .filter(
      (s) =>
        !conditions.availableStoreIds ||
        conditions.availableStoreIds.includes(s.store_id),
    )
    .sort((a, b) => a.walk_minutes - b.walk_minutes || a.store_id - b.store_id);
}

/**
 * 現在のデータから「必ず0件になる エリア×利用シーン」の組み合わせを動的に探す。
 * 特定のエリア名・店舗を決め打ちせず、実行時のデータに合わせて検索する。
 */
export function findZeroResultAreaScene(
  stores: PublishedStore[],
  areas: MasterArea[],
): { area: MasterArea; scene: SceneValue } | null {
  const scenes: SceneValue[] = ["solo", "date", "friends", "family"];
  for (const area of areas) {
    for (const scene of scenes) {
      const matches = filterAndSortStores(stores, {
        areaId: area.area_id,
        scene,
      });
      if (matches.length === 0) {
        return { area, scene };
      }
    }
  }
  return null;
}
