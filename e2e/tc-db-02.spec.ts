import { test, expect, type Page } from "@playwright/test";
import {
  fetchAvailableStoreIdsForDish,
  fetchAvailableStoreDishes,
  fetchDishes,
  getOrderedDishNames,
} from "./supabase-data";

/**
 * TC-DB-02（AC20）：同一店舗に提供中料理と提供停止料理が混在する場合、
 * is_available=TRUEの料理だけが検索・表示対象になることを確認する。
 *
 * 事前確認済みの既存データ（store_id=2「タイ国料理 ゲウチャイ 新宿店」）を使う。
 * パッタイ（dish_id=3）はこの店舗でis_available=falseとして登録されている。
 * Supabaseへの書き込みは行わない（読み取り専用）。
 */
const TARGET_STORE_ID = 2;
const PATTAI_DISH_ID = 3;
const PATTAI_DISH_NAME = "パッタイ";

/** 「食べられる主な料理」見出しの兄弟要素として描画される料理グリッドのコンテナ（U03用）。 */
function getDishGridContainer(page: Page) {
  return page
    .getByText("食べられる主な料理", { exact: true })
    .locator("xpath=following-sibling::div[1]");
}

/** 検索結果カードの「詳しく見る」リンクhrefから、表示順のstore_id配列を取得する（U02用）。 */
async function getRenderedStoreIds(page: Page): Promise<number[]> {
  const hrefs = await page
    .getByRole("link", { name: "詳しく見る", exact: true })
    .evaluateAll((links) => links.map((el) => el.getAttribute("href") ?? ""));
  return hrefs
    .map((href) => href.match(/\/store\/(\d+)/)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
}

test.describe("TC-DB-02 提供停止料理の除外", () => {
  test("U02: 提供停止料理（パッタイ）で検索しても、対象店舗は検索結果に表示されない", async ({
    page,
  }) => {
    const availableStoreIds =
      await fetchAvailableStoreIdsForDish(PATTAI_DISH_ID);
    expect(
      availableStoreIds,
      "事前条件が失われました: パッタイがis_available=falseで登録されているはずの店舗が、is_available=true側に含まれています",
    ).not.toContain(TARGET_STORE_ID);

    await page.goto(`/search?dish_id=${PATTAI_DISH_ID}`);

    const renderedIds = await getRenderedStoreIds(page);
    expect(renderedIds).not.toContain(TARGET_STORE_ID);
  });

  test("U03: 店舗詳細ページで提供停止料理（パッタイ）は表示されず、提供中料理は表示される", async ({
    page,
  }) => {
    const [storeDishes, dishes] = await Promise.all([
      fetchAvailableStoreDishes(),
      fetchDishes(),
    ]);
    const dishNameById = new Map(dishes.map((d) => [d.dish_id, d.dish_name]));

    const expectedAvailableNames = getOrderedDishNames(
      storeDishes,
      dishNameById,
      TARGET_STORE_ID,
    );
    expect(
      expectedAvailableNames.length,
      "事前条件が失われました: store_id=2の提供中料理が取得できません",
    ).toBeGreaterThan(0);
    expect(
      expectedAvailableNames,
      "事前条件が失われました: 提供停止のはずのパッタイがis_available=true側に含まれています",
    ).not.toContain(PATTAI_DISH_NAME);

    await page.goto(`/store/${TARGET_STORE_ID}`);

    const container = getDishGridContainer(page);

    // 提供停止料理（パッタイ）は料理グリッド内に表示されない
    await expect(
      container.getByText(PATTAI_DISH_NAME, { exact: true }),
    ).toHaveCount(0);

    // 提供中料理は変わらず表示される
    const allDishNames = new Set(dishNameById.values());
    const displayedNames = (await container.locator("p").allTextContents())
      .map((t) => t.trim())
      .filter((t) => allDishNames.has(t));
    expect(new Set(displayedNames)).toEqual(new Set(expectedAvailableNames));
  });
});
