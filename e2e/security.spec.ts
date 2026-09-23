import { test, expect } from "@playwright/test";
import {
  fetchAllAreasUnfiltered,
  fetchAllDishesUnfiltered,
  fetchAllStoresUnfiltered,
  fetchAllStoreDishesUnfiltered,
  fetchAllStorePhotos,
} from "./supabase-data";

/**
 * TC-SEC-03：Publishable key（anon role）でアクセスした場合に、
 * 公開条件（is_active/is_published/is_available）を満たす行だけが取得できることを確認する。
 *
 * 「is_published=falseで検索して0件」だけでは、RLSではなくアプリ側のクエリ条件を
 * 確認しているに過ぎない。そのため、あえて絞り込み条件を指定せずに全件取得し、
 * 返却された行がすべて公開条件を満たしていることを直接検証する
 * （supabase/migrations/20260909000200_enable_row_level_security.sqlのRLSポリシーに対応）。
 *
 * Supabaseへの書き込みは行わない（読み取り専用）。
 */
test.describe("TC-SEC-03 公開データの閲覧制御（RLS）", () => {
  test("areas: 絞り込みなしで取得してもis_active=trueの行だけが返る", async () => {
    const areas = await fetchAllAreasUnfiltered();
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(area.is_active).toBe(true);
    }
  });

  test("dishes: 絞り込みなしで取得してもis_active=trueの行だけが返る", async () => {
    const dishes = await fetchAllDishesUnfiltered();
    expect(dishes.length).toBeGreaterThan(0);
    for (const dish of dishes) {
      expect(dish.is_active).toBe(true);
    }
  });

  test("stores: 絞り込みなしで取得してもis_published=trueの行だけが返る", async () => {
    const stores = await fetchAllStoresUnfiltered();
    expect(stores.length).toBeGreaterThan(0);
    for (const store of stores) {
      expect(store.is_published).toBe(true);
    }
  });

  test("store_dishes: 絞り込みなしで取得してもis_available=trueかつ公開店舗・有効料理に紐づく行だけが返る", async () => {
    const [storeDishes, stores, dishes] = await Promise.all([
      fetchAllStoreDishesUnfiltered(),
      fetchAllStoresUnfiltered(),
      fetchAllDishesUnfiltered(),
    ]);

    expect(storeDishes.length).toBeGreaterThan(0);

    // stores/dishesも同じくRLSにより公開条件を満たす行しか返らないため、
    // ここで得たIDの集合＝「公開店舗」「有効料理」の集合として扱える。
    const publishedStoreIds = new Set(stores.map((s) => s.store_id));
    const activeDishIds = new Set(dishes.map((d) => d.dish_id));

    for (const row of storeDishes) {
      expect(row.is_available).toBe(true);
      expect(publishedStoreIds.has(row.store_id)).toBe(true);
      expect(activeDishIds.has(row.dish_id)).toBe(true);
    }
  });

  test("store_photos: 絞り込みなしで取得しても公開店舗に紐づく行だけが返る", async () => {
    const [photos, stores] = await Promise.all([
      fetchAllStorePhotos(),
      fetchAllStoresUnfiltered(),
    ]);

    expect(photos.length).toBeGreaterThan(0);

    const publishedStoreIds = new Set(stores.map((s) => s.store_id));
    for (const photo of photos) {
      expect(publishedStoreIds.has(photo.store_id)).toBe(true);
    }
  });

  test("補助確認: 明示的に非公開条件を指定しても0件になる", async () => {
    const [inactiveAreas, inactiveDishes, unpublishedStores] =
      await Promise.all([
        fetchAllAreasUnfiltered().then((rows) =>
          rows.filter((r) => !r.is_active),
        ),
        fetchAllDishesUnfiltered().then((rows) =>
          rows.filter((r) => !r.is_active),
        ),
        fetchAllStoresUnfiltered().then((rows) =>
          rows.filter((r) => !r.is_published),
        ),
      ]);

    // 「非公開データが存在する」ことを前提にはせず、上記の全件取得結果の中に
    // 非公開条件を満たす行が混ざっていないことを再確認する（0件が期待値）。
    expect(inactiveAreas).toHaveLength(0);
    expect(inactiveDishes).toHaveLength(0);
    expect(unpublishedStores).toHaveLength(0);
  });
});
