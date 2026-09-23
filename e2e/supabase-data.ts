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

function readEnvLocalFile(): Record<string, string> {
  const envPath = path.resolve(__dirname, "../.env.local");
  let content: string;
  try {
    content = readFileSync(envPath, "utf-8");
  } catch {
    return {};
  }
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
  return vars;
}

/**
 * GitHub Actionsではprocess.env（Secrets経由）を最優先で使用し、
 * ローカル開発では.env.localへフォールバックする。
 * 値そのものはログに出力しない。
 */
function readSupabaseEnv(): { url: string; key: string } {
  const fileVars = readEnvLocalFile();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    fileVars["NEXT_PUBLIC_SUPABASE_URL"];
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    fileVars["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYが見つかりません。" +
        "process.env（CI）または.env.local（ローカル）のいずれかに設定してください。",
    );
  }
  return { url, key };
}

async function restGet<T>(queryPath: string): Promise<T> {
  const { url, key } = readSupabaseEnv();
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

/** 店舗の提供中料理を表示順（display_order昇順）の料理名配列にする。 */
export function getOrderedDishNames(
  storeDishes: StoreDishRow[],
  dishNameById: Map<number, string>,
  storeId: number,
): string[] {
  return storeDishes
    .filter((row) => row.store_id === storeId)
    .sort((a, b) => a.display_order - b.display_order)
    .map((row) => dishNameById.get(row.dish_id))
    .filter((name): name is string => name !== undefined);
}

/**
 * src/app/search/page.tsx の mainDishText 計算（提供中料理のうち
 * 表示順先頭maxCount件、「・」連結）をテスト側で再現する。
 */
export function computeExpectedMainDishText(
  storeDishes: StoreDishRow[],
  dishNameById: Map<number, string>,
  storeId: number,
  maxCount = 2,
): string | null {
  const names = getOrderedDishNames(storeDishes, dishNameById, storeId).slice(
    0,
    maxCount,
  );
  return names.length > 0 ? names.join("・") : null;
}

export type StoreLinks = {
  store_id: number;
  map_url: string;
  official_site_url: string | null;
};

export async function fetchPublishedStoreLinks(): Promise<StoreLinks[]> {
  return restGet<StoreLinks[]>(
    "stores?select=store_id,map_url,official_site_url&is_published=eq.true",
  );
}

export type StoreRegularHoliday = {
  store_id: number;
  regular_holiday: string | null;
};

export async function fetchPublishedStoreRegularHolidays(): Promise<
  StoreRegularHoliday[]
> {
  return restGet<StoreRegularHoliday[]>(
    "stores?select=store_id,regular_holiday&is_published=eq.true",
  );
}

export type StorePhotoRow = {
  store_id: number;
  photo_type: "外観" | "店内" | "料理";
  dish_id: number | null;
  photo_url: string;
  alt_text: string;
};

export async function fetchAllStorePhotos(): Promise<StorePhotoRow[]> {
  return restGet<StorePhotoRow[]>(
    "store_photos?select=store_id,photo_type,dish_id,photo_url,alt_text",
  );
}

/** 指定店舗に登録されている写真種別（外観／店内／料理）の集合を返す。 */
export function getPhotoTypesForStore(
  photos: StorePhotoRow[],
  storeId: number,
): Set<string> {
  return new Set(
    photos.filter((p) => p.store_id === storeId).map((p) => p.photo_type),
  );
}

export type StoreAtmosphere = { store_id: number; atmosphere_text: string };

export async function fetchPublishedStoreAtmosphere(): Promise<
  StoreAtmosphere[]
> {
  return restGet<StoreAtmosphere[]>(
    "stores?select=store_id,atmosphere_text&is_published=eq.true",
  );
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

export type StoreHours = {
  store_id: number;
  has_lunch: boolean;
  lunch_hours: string | null;
  lunch_price_from: number | null;
  has_dinner: boolean;
  dinner_hours: string | null;
  dinner_price_from: number | null;
};

export async function fetchPublishedStoreHours(): Promise<StoreHours[]> {
  return restGet<StoreHours[]>(
    "stores?select=store_id,has_lunch,lunch_hours,lunch_price_from,has_dinner,dinner_hours,dinner_price_from&is_published=eq.true",
  );
}

/**
 * TC-SEC-03用：Publishable keyで「公開条件による絞り込みを指定せず」に取得する。
 * RLSが正しく効いていれば、結果は常に公開可能な行だけに限定されるはずである。
 * （supabase/migrations/20260909000200_enable_row_level_security.sqlのポリシーに対応）
 */
export type RawArea = { area_id: number; is_active: boolean };
export async function fetchAllAreasUnfiltered(): Promise<RawArea[]> {
  return restGet<RawArea[]>("areas?select=area_id,is_active");
}

export type RawDish = { dish_id: number; is_active: boolean };
export async function fetchAllDishesUnfiltered(): Promise<RawDish[]> {
  return restGet<RawDish[]>("dishes?select=dish_id,is_active");
}

export type RawStore = { store_id: number; is_published: boolean };
export async function fetchAllStoresUnfiltered(): Promise<RawStore[]> {
  return restGet<RawStore[]>("stores?select=store_id,is_published");
}

export type RawStoreDish = {
  store_id: number;
  dish_id: number;
  is_available: boolean;
};
export async function fetchAllStoreDishesUnfiltered(): Promise<RawStoreDish[]> {
  return restGet<RawStoreDish[]>(
    "store_dishes?select=store_id,dish_id,is_available",
  );
}
