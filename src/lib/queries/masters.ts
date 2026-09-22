import "server-only";

import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { logSupabaseError } from "@/lib/logger";
import { U01_DISH_NAMES } from "@/lib/search-conditions";
import type { Database } from "@/types/database.types";

type AreaRow = Database["public"]["Tables"]["areas"]["Row"];
type DishRow = Database["public"]["Tables"]["dishes"]["Row"];

export type MasterArea = Pick<
  AreaRow,
  "area_id" | "area_name" | "display_order"
>;

export type MasterDish = Pick<
  DishRow,
  "dish_id" | "dish_name" | "description" | "search_image_url" | "display_order"
>;

async function fetchActiveAreas(): Promise<MasterArea[]> {
  const { data, error } = await supabase
    .from("areas")
    .select("area_id, area_name, display_order")
    .eq("is_active", true)
    .order("display_order");

  if (error) {
    logSupabaseError({
      route: "masters",
      operation: "fetchActiveAreas",
      table: "areas",
      error,
    });
    throw new Error("マスタ（エリア）の取得に失敗しました");
  }

  return data ?? [];
}

async function fetchActiveU01Dishes(): Promise<MasterDish[]> {
  const { data, error } = await supabase
    .from("dishes")
    .select("dish_id, dish_name, description, search_image_url, display_order")
    .eq("is_active", true)
    .in("dish_name", U01_DISH_NAMES)
    .order("display_order");

  if (error) {
    logSupabaseError({
      route: "masters",
      operation: "fetchActiveU01Dishes",
      table: "dishes",
      error,
    });
    throw new Error("マスタ（料理）の取得に失敗しました");
  }

  return data ?? [];
}

// areas / dishesは低頻度更新のマスタデータであり、U01（選択肢表示）とU02（条件検証）で
// 共有してキャッシュする。DB障害時は空配列にせずthrowし、正常なマスタ一覧として扱わない。
export const getActiveAreas = unstable_cache(
  fetchActiveAreas,
  ["masters-active-areas"],
  { revalidate: 3600 },
);

export const getActiveU01Dishes = unstable_cache(
  fetchActiveU01Dishes,
  ["masters-active-u01-dishes"],
  { revalidate: 3600 },
);
