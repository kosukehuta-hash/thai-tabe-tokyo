import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  fetchPublishedStores,
  fetchAvailableStoreDishes,
  fetchDishes,
  fetchPublishedStoreLinks,
  fetchPublishedStoreRegularHolidays,
  getOrderedDishNames,
  type PublishedStore,
  type StoreDishRow,
} from "./supabase-data";

/** 「食べられる主な料理」見出しの兄弟要素として描画される料理グリッドのコンテナ。 */
function getDishGridContainer(page: Page): Locator {
  return page
    .getByText("食べられる主な料理", { exact: true })
    .locator("xpath=following-sibling::div[1]");
}

/** 料理グリッド内で、料理名テキストからその料理カード（最も近いdiv祖先）を特定する。 */
function getDishCardByName(container: Locator, dishName: string): Locator {
  return container
    .getByText(dishName, { exact: true })
    .locator("xpath=ancestor::div[1]");
}

test.describe("U03 店舗詳細ページ", () => {
  let stores: PublishedStore[];
  let storeDishes: StoreDishRow[];
  let dishNameById: Map<number, string>;

  test.beforeAll(async () => {
    const [storesResult, storeDishesResult, dishesResult] = await Promise.all([
      fetchPublishedStores(),
      fetchAvailableStoreDishes(),
      fetchDishes(),
    ]);
    stores = storesResult;
    storeDishes = storeDishesResult;
    dishNameById = new Map(dishesResult.map((d) => [d.dish_id, d.dish_name]));
  });

  test("TC-U03-01: 提供中料理が6件の店舗では6件すべてが表示順どおりに表示される", async ({
    page,
  }) => {
    const dishCountByStore = new Map<number, number>();
    for (const row of storeDishes) {
      dishCountByStore.set(
        row.store_id,
        (dishCountByStore.get(row.store_id) ?? 0) + 1,
      );
    }

    const targetStoreId = stores
      .map((s) => s.store_id)
      .find((id) => (dishCountByStore.get(id) ?? 0) === 6);

    expect(
      targetStoreId,
      "事前条件が失われました: 提供中料理がちょうど6件の公開店舗が見つかりません",
    ).toBeDefined();

    const expectedNames = getOrderedDishNames(
      storeDishes,
      dishNameById,
      targetStoreId!,
    ).slice(0, 6);
    expect(expectedNames.length).toBe(6);

    await page.goto(`/store/${targetStoreId}`);

    const container = getDishGridContainer(page);
    const allDishNames = new Set(dishNameById.values());
    const displayedNames = (await container.locator("p").allTextContents())
      .map((t) => t.trim())
      .filter((t) => allDishNames.has(t));

    expect(displayedNames).toEqual(expectedNames);

    const cardCount = await container.locator(":scope > div").count();
    expect(cardCount).toBe(6);
  });

  test("TC-U03-02: 提供中料理が6件未満の店舗では登録された件数だけが表示される", async ({
    page,
  }) => {
    const dishCountByStore = new Map<number, number>();
    for (const row of storeDishes) {
      dishCountByStore.set(
        row.store_id,
        (dishCountByStore.get(row.store_id) ?? 0) + 1,
      );
    }

    const targetStoreId = stores
      .map((s) => s.store_id)
      .find((id) => {
        const count = dishCountByStore.get(id) ?? 0;
        return count >= 1 && count < 6;
      });

    expect(
      targetStoreId,
      "事前条件が失われました: 提供中料理が1件以上6件未満の公開店舗が見つかりません",
    ).toBeDefined();

    const expectedNames = getOrderedDishNames(
      storeDishes,
      dishNameById,
      targetStoreId!,
    );
    const expectedCount = dishCountByStore.get(targetStoreId!)!;
    expect(expectedNames.length).toBe(expectedCount);

    await page.goto(`/store/${targetStoreId}`);

    const container = getDishGridContainer(page);
    const allDishNames = new Set(dishNameById.values());
    const displayedNames = (await container.locator("p").allTextContents())
      .map((t) => t.trim())
      .filter((t) => allDishNames.has(t));

    expect(displayedNames).toEqual(expectedNames);

    // 余分な空カード等が表示されないことを、登録件数とカード件数の一致で確認する。
    const cardCount = await container.locator(":scope > div").count();
    expect(cardCount).toBe(expectedCount);
  });

  test("TC-U03-03: 検索条件の料理カードにだけ『条件一致』が表示される", async ({
    page,
  }) => {
    const rowsByStore = new Map<number, StoreDishRow[]>();
    for (const row of storeDishes) {
      const list = rowsByStore.get(row.store_id) ?? [];
      list.push(row);
      rowsByStore.set(row.store_id, list);
    }

    // 選択料理／非選択料理の両方を確認できるよう、提供中料理が2件以上の公開店舗を選ぶ。
    let targetStoreId: number | undefined;
    let selectedRow: StoreDishRow | undefined;
    let otherRow: StoreDishRow | undefined;
    for (const store of stores) {
      const rows = (rowsByStore.get(store.store_id) ?? []).sort(
        (a, b) => a.display_order - b.display_order,
      );
      if (rows.length >= 2) {
        targetStoreId = store.store_id;
        selectedRow = rows[0];
        otherRow = rows[1];
        break;
      }
    }

    expect(
      targetStoreId,
      "事前条件が失われました: 提供中料理が2件以上のstore_dishes組み合わせが見つかりません",
    ).toBeDefined();
    expect(selectedRow).toBeDefined();
    expect(otherRow).toBeDefined();

    const selectedDishName = dishNameById.get(selectedRow!.dish_id);
    const otherDishName = dishNameById.get(otherRow!.dish_id);
    expect(
      selectedDishName,
      "事前条件が失われました: 選択料理の料理名が取得できません",
    ).toBeDefined();
    expect(
      otherDishName,
      "事前条件が失われました: 比較対象の料理名が取得できません",
    ).toBeDefined();

    await page.goto(`/store/${targetStoreId}?dish_id=${selectedRow!.dish_id}`);

    const container = getDishGridContainer(page);

    const selectedCard = getDishCardByName(container, selectedDishName!);
    await expect(
      selectedCard.getByText("条件一致", { exact: true }),
    ).toBeVisible();

    const otherCard = getDishCardByName(container, otherDishName!);
    await expect(otherCard.getByText("条件一致", { exact: true })).toHaveCount(
      0,
    );
  });

  test("TC-U03-09: U02からU03を開いて『検索結果に戻る』を押すと検索条件とスクロール位置が保持される", async ({
    page,
  }) => {
    // U01: 「場所から選ぶ」の最初の実エリア（インデックス0は「すべて」）を選択する。
    await page.goto("/");
    const areaHeading = page.getByText("場所から選ぶ", { exact: true });
    const areaOptions = areaHeading.locator(
      "xpath=../following-sibling::div[1]",
    );
    const areaButtons = areaOptions.getByRole("button");
    const areaButtonCount = await areaButtons.count();
    expect(
      areaButtonCount,
      "事前条件が失われました: 場所の選択肢が見つかりません",
    ).toBeGreaterThan(1);
    await areaButtons.nth(1).click();

    // U01→U02: 検索する
    await page.getByRole("button", { name: "店舗を検索する" }).click();
    await page.waitForURL(/\/search/);
    const searchQuery = new URL(page.url()).search;
    expect(
      searchQuery.length,
      "事前条件が失われました: エリア選択が検索条件に反映されていません",
    ).toBeGreaterThan(0);

    // U02: 一覧をスクロールする（選択したエリアの件数によって実際にスクロール可能な
    // 高さが変わるため、固定値ではなく実際のページ高さから動的に決める）。
    const maxScroll = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(
      maxScroll,
      "事前条件が失われました: スクロール位置の復元を確認できるだけのページ高さがありません",
    ).toBeGreaterThan(50);
    const scrollTarget = Math.min(400, maxScroll);
    await page.evaluate((y) => window.scrollTo(0, y), scrollTarget);
    await page.waitForFunction((y) => window.scrollY >= y - 5, scrollTarget);

    // U02→U03: 最初の店舗の詳しく見るリンクから遷移する
    const detailLink = page
      .getByRole("link", { name: "詳しく見る", exact: true })
      .first();
    const detailCount = await page
      .getByRole("link", { name: "詳しく見る", exact: true })
      .count();
    expect(
      detailCount,
      "事前条件が失われました: 検索結果に店舗カードが見つかりません",
    ).toBeGreaterThan(0);
    await detailLink.click();
    await page.waitForURL(/\/store\//);

    // U03: 検索結果に戻る（デスクトップ幅ではヘッダー側のリンクが表示される）
    const backControl = page.getByText("検索結果に戻る").first();
    await backControl.click();
    await page.waitForURL(/\/search/);

    const returnedQuery = new URL(page.url()).search;
    expect(returnedQuery).toBe(searchQuery);

    // requestAnimationFrameでのスクロール復元を待つ。
    await page.waitForFunction((y) => window.scrollY >= y - 50, scrollTarget, {
      timeout: 5000,
    });
    const restoredY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(restoredY - scrollTarget)).toBeLessThanOrEqual(50);
  });

  test("TC-U03-10: 地図・公式サイトの外部リンクが正しいURLで別タブに設定されている", async ({
    page,
  }) => {
    const links = await fetchPublishedStoreLinks();
    const target = links.find((l) => l.map_url && l.official_site_url !== null);

    expect(
      target,
      "事前条件が失われました: map_url・official_site_urlの両方を持つ公開店舗が見つかりません",
    ).toBeDefined();

    await page.goto(`/store/${target!.store_id}`);

    const mapLink = page.getByRole("link", { name: "地図を見る", exact: true });
    await expect(mapLink).toHaveAttribute("href", target!.map_url);
    await expect(mapLink).toHaveAttribute("target", "_blank");
    await expect(mapLink).toHaveAttribute("rel", /noopener/);

    const officialLink = page.getByRole("link", {
      name: "公式サイトを見る",
      exact: true,
    });
    await expect(officialLink).toHaveAttribute(
      "href",
      target!.official_site_url!,
    );
    await expect(officialLink).toHaveAttribute("target", "_blank");
    await expect(officialLink).toHaveAttribute("rel", /noopener/);
  });

  test("TC-U03-05: 定休日が未登録の店舗では『定休日』欄が表示されず、最終確認日を含む共通注記は表示される", async ({
    page,
  }) => {
    // 一部自動化：現在の公開データでは定休日（regular_holiday）が未登録の店舗のみ
    // 実データで再現できる。電話番号・公式サイト等の他の任意項目は、現在すべての
    // 公開店舗で登録済みのため、未登録パターンは検証できない（無理に自動化しない）。
    const holidays = await fetchPublishedStoreRegularHolidays();
    const target = holidays.find(
      (s) => s.regular_holiday === null || s.regular_holiday.trim() === "",
    );

    expect(
      target,
      "事前条件が失われました: 定休日（regular_holiday）が未登録の公開店舗が見つかりません",
    ).toBeDefined();

    await page.goto(`/store/${target!.store_id}`);

    // 空欄の項目（定休日）は表示されない
    await expect(page.getByText("定休日", { exact: true })).toHaveCount(0);

    // 登録済みの他の項目（電話番号）は変わらず表示される
    // （空欄項目だけが選択的に非表示になっていることの対比確認）
    await expect(page.getByText("電話番号", { exact: true })).toBeVisible();

    // 最終確認日を含む共通注記は、空欄項目の有無に関わらず表示される
    await expect(page.getByText(/最終確認日：/)).toBeVisible();
  });
});
