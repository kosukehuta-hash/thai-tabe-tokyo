import "server-only";

import { supabase } from "@/lib/supabase";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/logger";
import type { Database } from "@/types/database.types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

export type Store = Pick<
  StoreRow,
  | "store_id"
  | "store_name"
  | "catch_copy"
  | "scene_solo"
  | "scene_date"
  | "scene_friends"
  | "scene_family"
  | "spice_support_text"
  | "reservation_text"
  | "seat_type_text"
  | "atmosphere_text"
  | "address"
  | "nearest_station_name"
  | "walk_minutes"
  | "has_lunch"
  | "lunch_hours"
  | "lunch_price_from"
  | "has_dinner"
  | "dinner_hours"
  | "dinner_price_from"
  | "regular_holiday"
  | "phone_number"
  | "map_url"
  | "official_site_url"
  | "last_verified_on"
  | "is_published"
>;

export type StoreFetchResult =
  | { status: "invalid_id" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "found"; store: Store };

export async function fetchStore(storeId: number): Promise<StoreFetchResult> {
  const { data, error } = await supabase
    .from("stores")
    .select(
      "store_id, store_name, catch_copy, scene_solo, scene_date, scene_friends, scene_family, spice_support_text, reservation_text, seat_type_text, atmosphere_text, address, nearest_station_name, walk_minutes, has_lunch, lunch_hours, lunch_price_from, has_dinner, dinner_hours, dinner_price_from, regular_holiday, phone_number, map_url, official_site_url, last_verified_on, is_published",
    )
    .eq("store_id", storeId)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchStore",
      table: "stores",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }
  if (!data) {
    return { status: "not_found" };
  }
  return { status: "found", store: data };
}

export type StorePhoto = {
  photo_url: string;
  alt_text: string;
};

export type PhotoFetchResult =
  | { status: "error" }
  | { status: "empty" }
  | { status: "found"; photo: StorePhoto };

export async function fetchExteriorPhoto(
  storeId: number,
): Promise<PhotoFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("photo_url, alt_text")
    .eq("store_id", storeId)
    .eq("photo_type", "外観")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchExteriorPhoto",
      table: "store_photos",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }
  if (!data) {
    return { status: "empty" };
  }
  return { status: "found", photo: data };
}

export type InteriorPhotosFetchResult =
  { status: "error" } | { status: "success"; photos: StorePhoto[] };

export async function fetchInteriorPhotos(
  storeId: number,
): Promise<InteriorPhotosFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("photo_url, alt_text, display_order")
    .eq("store_id", storeId)
    .eq("photo_type", "店内")
    .order("display_order", { ascending: true });

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchInteriorPhotos",
      table: "store_photos",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }
  return { status: "success", photos: (data ?? []).slice(0, 2) };
}

export type MainDish = {
  dish_id: number;
  dish_name: string;
  description: string;
};

export type MainDishesFetchResult =
  { status: "error" } | { status: "success"; dishes: MainDish[] };

export async function fetchMainDishes(
  storeId: number,
): Promise<MainDishesFetchResult> {
  const { data: storeDishRows, error: storeDishError } = await supabase
    .from("store_dishes")
    .select("store_id, dish_id, display_order, is_available")
    .eq("store_id", storeId)
    .eq("is_available", true)
    .order("display_order", { ascending: true })
    .limit(6);

  if (storeDishError) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchMainDishes.storeDishes",
      table: "store_dishes",
      error: storeDishError,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }

  const orderedRows = storeDishRows ?? [];
  if (orderedRows.length === 0) {
    return { status: "success", dishes: [] };
  }

  const dishIds = orderedRows.map((row) => row.dish_id);

  const { data: dishRows, error: dishError } = await supabase
    .from("dishes")
    .select("dish_id, dish_name, description")
    .in("dish_id", dishIds);

  if (dishError) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchMainDishes.dishes",
      table: "dishes",
      error: dishError,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }

  const dishById = new Map<
    number,
    { dish_name: string; description: string }
  >();
  for (const dish of dishRows ?? []) {
    dishById.set(dish.dish_id, {
      dish_name: dish.dish_name,
      description: dish.description,
    });
  }

  const dishes: MainDish[] = orderedRows
    .map((row) => {
      const dish = dishById.get(row.dish_id);
      return dish
        ? {
            dish_id: row.dish_id,
            dish_name: dish.dish_name,
            description: dish.description,
          }
        : null;
    })
    .filter((dish): dish is MainDish => dish !== null);

  return { status: "success", dishes };
}

export type DishPhotosFetchResult =
  | { status: "error" }
  | { status: "success"; photoByDishId: Map<number, StorePhoto> };

export async function fetchMainDishPhotos(
  storeId: number,
  dishIds: number[],
): Promise<DishPhotosFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("dish_id, photo_url, alt_text, display_order")
    .eq("store_id", storeId)
    .eq("photo_type", "料理")
    .in("dish_id", dishIds)
    .order("display_order", { ascending: true });

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchMainDishPhotos",
      table: "store_photos",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }

  const photoByDishId = new Map<number, StorePhoto>();
  for (const row of data ?? []) {
    if (row.dish_id === null || photoByDishId.has(row.dish_id)) {
      continue;
    }
    photoByDishId.set(row.dish_id, {
      photo_url: row.photo_url,
      alt_text: row.alt_text,
    });
  }

  return { status: "success", photoByDishId };
}

export type OwnNoteFetchResult =
  { status: "error" } | { status: "success"; noteText: string | null };

export async function fetchOwnNote(
  supabaseServer: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  storeId: number,
): Promise<OwnNoteFetchResult> {
  const { data, error } = await supabaseServer
    .from("store_visit_notes")
    .select("note_text")
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    logSupabaseError({
      route: "/store/[storeId]",
      operation: "fetchOwnNote",
      table: "store_visit_notes",
      error,
      context: { store_id: storeId },
    });
    return { status: "error" };
  }
  return { status: "success", noteText: data?.note_text ?? null };
}
