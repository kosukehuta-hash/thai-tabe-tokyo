import { test, expect, type Page, type Locator } from "@playwright/test";
import { fetchAllStorePhotos, type StorePhotoRow } from "./supabase-data";

/**
 * TC-NFR-04（操作性・アクセシビリティ、NF13〜NF17）のうち
 * Playwrightで自動判定できる部分だけを対象とする。
 * NF14（色以外での判別）はe2e/u01.spec.tsのTC-U01-02に、
 * NF15（状態変化）は既存のTC-U01-02・TC-U02-04で担保済みのため、ここでは扱わない。
 */

/** カテゴリ見出しのテキストを起点に、選択肢コンテナを特定する（e2e/u01.spec.tsと同じ考え方）。 */
function getCategoryOptionsContainer(page: Page, headingText: string): Locator {
  const heading = page.getByText(headingText, { exact: true });
  return heading.locator("xpath=../following-sibling::div[1]");
}

function getAllButton(container: Locator): Locator {
  return container
    .getByText("すべて", { exact: true })
    .locator("xpath=ancestor-or-self::button[1]");
}

/** Tabキーを繰り返し押し、指定ロケーターにフォーカスが移るまで進める。 */
async function tabUntilFocused(
  page: Page,
  target: Locator,
  maxPresses: number,
): Promise<boolean> {
  for (let i = 0; i < maxPresses; i += 1) {
    const isFocused = await target
      .evaluate((el) => el === document.activeElement)
      .catch(() => false);
    if (isFocused) {
      return true;
    }
    await page.keyboard.press("Tab");
  }
  return false;
}

test.describe("TC-NFR-04 操作性・アクセシビリティ", () => {
  test("NF13: U01の主要な操作部品の高さが44px以上である（PC viewport）", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const areaContainer = getCategoryOptionsContainer(page, "場所から選ぶ");
    const areaAllButton = getAllButton(areaContainer);
    const searchButton = page.getByRole("button", { name: "店舗を検索する" });
    const resetButton = page.getByRole("button", { name: "条件をリセット" });

    for (const button of [areaAllButton, searchButton, resetButton]) {
      const box = await button.boundingBox();
      expect(
        box,
        "対象ボタンのboundingBoxが取得できませんでした",
      ).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("NF16: U01→U02→U03の主要操作がTabキーとEnterキーだけで完了できる", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // U01: 「場所から選ぶ」の「すべて」ボタンまでTabで到達できる
    const areaContainer = getCategoryOptionsContainer(page, "場所から選ぶ");
    const areaAllButton = getAllButton(areaContainer);
    const reachedArea = await tabUntilFocused(page, areaAllButton, 30);
    expect(
      reachedArea,
      "Tabキーで場所カテゴリの操作要素へ到達できませんでした",
    ).toBe(true);

    // 検索ボタンまでTabで到達し、Enterキーで検索を実行する
    const searchButton = page.getByRole("button", { name: "店舗を検索する" });
    const reachedSearch = await tabUntilFocused(page, searchButton, 60);
    expect(reachedSearch, "Tabキーで検索ボタンへ到達できませんでした").toBe(
      true,
    );
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/search/);

    // U02: 「詳しく見る」までTabで到達し、Enterキーで店舗詳細を開く
    const detailLink = page
      .getByRole("link", { name: "詳しく見る", exact: true })
      .first();
    const reachedDetail = await tabUntilFocused(page, detailLink, 200);
    expect(
      reachedDetail,
      "Tabキーで『詳しく見る』リンクへ到達できませんでした",
    ).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/store\//);

    // U03: 「検索結果に戻る」までTabで到達し、Enterキーで戻る
    const backControl = page.getByText("検索結果に戻る").first();
    const reachedBack = await tabUntilFocused(page, backControl, 60);
    expect(
      reachedBack,
      "Tabキーで『検索結果に戻る』へ到達できませんでした",
    ).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/search/);
  });

  test("NF17: 店舗写真・料理写真のalt属性がSupabaseのalt_textと完全一致する", async ({
    page,
  }) => {
    const photos = await fetchAllStorePhotos();

    // U03店舗詳細ページは、同じ店舗・同じ写真区分（外観は店舗単位、料理はdish_id単位）で
    // display_orderが最も小さい1件だけを表示する
    // （src/lib/queries/store.tsのfetchExteriorPhoto・fetchMainDishPhotosと同じ考え方）。
    // store_photosにはU02検索結果専用に別途display_orderの大きい重複写真が
    // 登録されているため、単に配列の先頭要素を採用するとU03に表示されない写真を
    // 誤って選んでしまう。ここでも同じ基準（グループごとのdisplay_order最小）で選ぶ。
    function pickLowestDisplayOrderPerGroup(
      rows: StorePhotoRow[],
      keyFn: (row: StorePhotoRow) => string,
    ): StorePhotoRow[] {
      const best = new Map<string, StorePhotoRow>();
      for (const row of rows) {
        const key = keyFn(row);
        const current = best.get(key);
        if (!current || row.display_order < current.display_order) {
          best.set(key, row);
        }
      }
      return [...best.values()];
    }

    const u03ExteriorPhotos = pickLowestDisplayOrderPerGroup(
      photos.filter((p) => p.photo_type === "外観"),
      (p) => `${p.store_id}`,
    );
    const exteriorPhoto = u03ExteriorPhotos[0];
    expect(
      exteriorPhoto,
      "事前条件が失われました: 外観写真が登録されている公開店舗の写真が見つかりません",
    ).toBeDefined();

    const u03DishPhotos = pickLowestDisplayOrderPerGroup(
      photos.filter((p) => p.photo_type === "料理" && p.dish_id !== null),
      (p) => `${p.store_id}-${p.dish_id}`,
    );
    const dishPhoto = u03DishPhotos[0];
    expect(
      dishPhoto,
      "事前条件が失われました: 料理写真が登録されている店舗・料理の組み合わせが見つかりません",
    ).toBeDefined();

    // 外観写真：alt属性が単に空でないだけでなく、Supabaseのalt_textと完全一致することを確認する
    await page.goto(`/store/${exteriorPhoto!.store_id}`);
    await expect(
      page.locator(`img[alt="${exteriorPhoto!.alt_text}"]`),
    ).toHaveCount(1);

    // 料理写真：同じ店舗に登録がなければ別店舗を開き直して確認する
    if (dishPhoto!.store_id !== exteriorPhoto!.store_id) {
      await page.goto(`/store/${dishPhoto!.store_id}`);
    }
    await expect(page.locator(`img[alt="${dishPhoto!.alt_text}"]`)).toHaveCount(
      1,
    );
  });

  test('TC-NFR-03: 店舗写真のimgはloading="lazy"で遅延読込される', async ({
    page,
  }) => {
    // 実際にDOMを調査した結果、Next/Imageが出力する店舗写真のimgは
    // 例外なくloading="lazy"を持つことを確認済み（ヘッダーロゴのみalt=""かつ
    // loading属性なし＝priority表示のため、alt=""を除外して対象を絞り込む）。
    const photos = await fetchAllStorePhotos();
    expect(
      photos.length,
      "事前条件が失われました: 写真が登録されている公開店舗が見つかりません",
    ).toBeGreaterThan(0);

    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const storePhotoImgs = page.locator('img:not([alt=""])');
    const count = await storePhotoImgs.count();
    expect(
      count,
      "事前条件が失われました: 検索結果に写真付きのimgが見つかりません",
    ).toBeGreaterThan(0);

    const loadingValues = await storePhotoImgs.evaluateAll((els) =>
      els.map((el) => el.getAttribute("loading")),
    );
    for (const loading of loadingValues) {
      expect(loading).toBe("lazy");
    }
  });
});
