import "server-only";

import { supabase } from "@/lib/supabase";
import {
  U01_DISH_NAMES,
  type SceneValue,
  type TimeValue,
} from "@/lib/search-conditions";
import type { Database } from "@/types/database.types";

const SCENE_COLUMN: Record<SceneValue, string> = {
  solo: "scene_solo",
  date: "scene_date",
  friends: "scene_friends",
  family: "scene_family",
};

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

export type Store = Pick<
  StoreRow,
  | "store_id"
  | "store_name"
  | "nearest_station_name"
  | "walk_minutes"
  | "has_lunch"
  | "lunch_hours"
  | "lunch_price_from"
  | "has_dinner"
  | "dinner_hours"
  | "dinner_price_from"
  | "scene_solo"
  | "scene_date"
  | "scene_friends"
  | "scene_family"
>;

export type StoreDish = {
  dish_id: number;
  dish_name: string;
  display_order: number;
};

export type StorePhoto = { photoUrl: string; altText: string | null };

export type SearchConditionsInput = {
  areaId: number | null;
  time: TimeValue | null;
  scene: SceneValue | null;
  dishId: number | null;
};

export type SearchQueryResult = {
  areaName: string | null;
  validatedAreaId: number | null;
  dishName: string | null;
  validatedDishId: number | null;
  stores: Store[];
  dishesByStore: Map<number, StoreDish[]>;
  photoByStore: Map<number, StorePhoto>;
};

export async function fetchSearchResults(
  conditions: SearchConditionsInput,
): Promise<SearchQueryResult> {
  const { areaId, time, scene, dishId } = conditions;

  // areas取得とdishes取得（検索条件検証用）は互いの結果に依存しないため並列実行する。
  const [areaData, dishData] = await Promise.all([
    areaId !== null
      ? supabase
          .from("areas")
          .select("area_name")
          .eq("area_id", areaId)
          .eq("is_active", true)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              throw new Error("検索条件（エリア）の取得に失敗しました");
            }
            return data;
          })
      : Promise.resolve(null),
    dishId !== null
      ? supabase
          .from("dishes")
          .select("dish_name")
          .eq("dish_id", dishId)
          .eq("is_active", true)
          .in("dish_name", U01_DISH_NAMES)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              throw new Error("検索条件（料理）の取得に失敗しました");
            }
            return data;
          })
      : Promise.resolve(null),
  ]);

  let areaName: string | null = null;
  let validatedAreaId: number | null = null;
  if (areaData) {
    areaName = areaData.area_name;
    validatedAreaId = areaId;
  }

  let dishName: string | null = null;
  let validatedDishId: number | null = null;
  if (dishData) {
    dishName = dishData.dish_name;
    validatedDishId = dishId;
  }

  let matchedStoreIds: number[] | null = null;
  if (validatedDishId !== null) {
    const { data, error } = await supabase
      .from("store_dishes")
      .select("store_id")
      .eq("dish_id", validatedDishId)
      .eq("is_available", true);
    if (error) {
      throw new Error("検索結果（該当店舗）の取得に失敗しました");
    }
    matchedStoreIds = (data ?? []).map((row) => row.store_id);
  }

  let stores: Store[] = [];

  const shouldSkipQuery =
    validatedDishId !== null && matchedStoreIds?.length === 0;

  if (!shouldSkipQuery) {
    let query = supabase
      .from("stores")
      .select(
        "store_id, store_name, nearest_station_name, walk_minutes, has_lunch, lunch_hours, lunch_price_from, has_dinner, dinner_hours, dinner_price_from, scene_solo, scene_date, scene_friends, scene_family",
      )
      .eq("is_published", true);

    if (validatedAreaId !== null) {
      query = query.eq("area_id", validatedAreaId);
    }
    if (time === "lunch") {
      query = query.eq("has_lunch", true);
    }
    if (time === "dinner") {
      query = query.eq("has_dinner", true);
    }
    if (scene !== null) {
      query = query.eq(SCENE_COLUMN[scene], true);
    }
    if (matchedStoreIds !== null) {
      query = query.in("store_id", matchedStoreIds);
    }

    const { data, error } = await query
      .order("walk_minutes", { ascending: true })
      .order("store_id", { ascending: true });

    if (error) {
      throw new Error("検索結果（店舗一覧）の取得に失敗しました");
    }

    stores = data ?? [];
  }

  const storeIds = stores.map((store) => store.store_id);

  type StoreDishRow = {
    store_id: number;
    dish_id: number;
    display_order: number;
  };

  async function fetchStoreDishRows(): Promise<StoreDishRow[]> {
    if (storeIds.length === 0) {
      return [];
    }
    const { data, error } = await supabase
      .from("store_dishes")
      .select("store_id, dish_id, display_order")
      .in("store_id", storeIds)
      .eq("is_available", true)
      .order("store_id", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) {
      throw new Error("検索結果（提供料理）の取得に失敗しました");
    }
    return data ?? [];
  }

  async function fetchPhotoByStore(): Promise<Map<number, StorePhoto>> {
    const photoByStore = new Map<number, StorePhoto>();
    if (storeIds.length > 0 && validatedDishId === null) {
      // 料理「すべて」選択時は料理画像を使わず、店舗の外観画像を表示する。
      const { data, error } = await supabase
        .from("store_photos")
        .select("store_id, photo_url, alt_text, display_order")
        .in("store_id", storeIds)
        .eq("photo_type", "外観")
        .order("store_id", { ascending: true })
        .order("display_order", { ascending: true });

      if (error) {
        throw new Error("検索結果（店舗写真）の取得に失敗しました");
      }

      for (const row of data ?? []) {
        if (!photoByStore.has(row.store_id)) {
          photoByStore.set(row.store_id, {
            photoUrl: row.photo_url,
            altText: row.alt_text,
          });
        }
      }
    } else if (storeIds.length > 0 && validatedDishId !== null) {
      const { data, error } = await supabase
        .from("store_photos")
        .select("store_id, dish_id, photo_url, alt_text, display_order")
        .in("store_id", storeIds)
        .eq("photo_type", "料理")
        .eq("dish_id", validatedDishId)
        .order("store_id", { ascending: true })
        .order("display_order", { ascending: true });

      if (error) {
        throw new Error("検索結果（料理写真）の取得に失敗しました");
      }

      // 選択中の dish_id と一致する写真だけを候補にし、他の料理画像では代用しない。
      const candidatesByStore = new Map<number, StorePhoto[]>();
      for (const row of data ?? []) {
        const photo = { photoUrl: row.photo_url, altText: row.alt_text };
        const list = candidatesByStore.get(row.store_id) ?? [];
        list.push(photo);
        candidatesByStore.set(row.store_id, list);
      }

      for (const storeId of storeIds) {
        const candidates = candidatesByStore.get(storeId) ?? [];
        const u02Photo = candidates.find((photo) =>
          photo.photoUrl.includes("-u02-"),
        );
        const photo = u02Photo ?? candidates[0];
        if (photo) {
          photoByStore.set(storeId, photo);
        }
      }
    }
    return photoByStore;
  }

  // store_dishes（表示用）とstore_photosはどちらもstoreIds確定後に取得するだけで、
  // 互いの結果には依存しないため並列実行する。
  const [storeDishRows, photoByStore] = await Promise.all([
    fetchStoreDishRows(),
    fetchPhotoByStore(),
  ]);

  const dishIdsInResults = Array.from(
    new Set(storeDishRows.map((row) => row.dish_id)),
  );

  let dishNameById = new Map<number, string>();
  if (dishIdsInResults.length > 0) {
    const { data, error } = await supabase
      .from("dishes")
      .select("dish_id, dish_name")
      .in("dish_id", dishIdsInResults);
    if (error) {
      throw new Error("検索結果（料理名）の取得に失敗しました");
    }
    dishNameById = new Map(
      (data ?? []).map((row) => [row.dish_id, row.dish_name]),
    );
  }

  const dishesByStore = new Map<number, StoreDish[]>();
  for (const row of storeDishRows) {
    const list = dishesByStore.get(row.store_id) ?? [];
    list.push({
      dish_id: row.dish_id,
      dish_name: dishNameById.get(row.dish_id) ?? "",
      display_order: row.display_order,
    });
    dishesByStore.set(row.store_id, list);
  }

  return {
    areaName,
    validatedAreaId,
    dishName,
    validatedDishId,
    stores,
    dishesByStore,
    photoByStore,
  };
}
