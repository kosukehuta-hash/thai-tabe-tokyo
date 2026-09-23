import { test, expect, type Page, type Locator } from "@playwright/test";
import {
  fetchPublishedStores,
  fetchActiveAreas,
  fetchAvailableStoreIdsForDish,
  fetchAvailableStoreDishes,
  fetchDishes,
  filterAndSortStores,
  findZeroResultAreaScene,
  computeExpectedOtherDishName,
  computeExpectedMainDishText,
  type PublishedStore,
  type MasterArea,
} from "./supabase-data";

const GAPAO_DISH_ID = 1;
const GAPAO_DISH_NAME = "ガパオ";

/** 検索結果カードの「詳しく見る」リンクhrefから、表示順のstore_id配列を取得する。 */
async function getRenderedStoreIds(page: Page): Promise<number[]> {
  const hrefs = await page
    .getByRole("link", { name: "詳しく見る", exact: true })
    .evaluateAll((links) => links.map((el) => el.getAttribute("href") ?? ""));
  return hrefs
    .map((href) => href.match(/\/store\/(\d+)/)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number);
}

/** 「詳しく見る」リンクのhrefからstore_idを取得する。 */
function extractStoreId(href: string | null): number | null {
  const match = href?.match(/\/store\/(\d+)/);
  return match ? Number(match[1]) : null;
}

/**
 * 「詳しく見る」リンクから、そのカードの本文（cardBody）を特定する。
 * StoreCard.tsxではLinkがcardBody div直下の子であるため、
 * リンクの最も近いdiv祖先がcardBodyになる（CSS Modulesのクラス名には依存しない）。
 */
function getCardBodyForLink(link: Locator): Locator {
  return link.locator("xpath=ancestor::div[1]");
}

/** 「選択中の条件」見出しの兄弟要素として描画されるタグ一覧のコンテナ。条件が0件のときは存在しない。 */
function getConditionTagsContainer(page: Page): Locator {
  return page
    .getByText("選択中の条件", { exact: true })
    .locator("xpath=following-sibling::div[1]");
}

/** タグ1件（アイコン + テキスト + 緑チェック）を、表示テキストで特定する。 */
function getConditionTag(page: Page, text: string): Locator {
  return getConditionTagsContainer(page).getByText(text, { exact: true });
}

/** タグにカテゴリ別固定アイコンと緑色チェックの計2個のsvgが含まれることを確認する。 */
async function expectTagHasIconAndCheck(tag: Locator) {
  await expect(tag.locator("svg")).toHaveCount(2);
}

test.describe("U02 検索結果ページ", () => {
  let stores: PublishedStore[];
  let areas: MasterArea[];
  let gapaoStoreIds: number[];
  let storeDishes: Awaited<ReturnType<typeof fetchAvailableStoreDishes>>;
  let dishNameById: Map<number, string>;

  test.beforeAll(async () => {
    const [
      storesResult,
      areasResult,
      gapaoStoreIdsResult,
      storeDishesResult,
      dishesResult,
    ] = await Promise.all([
      fetchPublishedStores(),
      fetchActiveAreas(),
      fetchAvailableStoreIdsForDish(GAPAO_DISH_ID),
      fetchAvailableStoreDishes(),
      fetchDishes(),
    ]);
    stores = storesResult;
    areas = areasResult;
    gapaoStoreIds = gapaoStoreIdsResult;
    storeDishes = storeDishesResult;
    dishNameById = new Map(dishesResult.map((d) => [d.dish_id, d.dish_name]));
  });

  test("TC-U02-01: AND検索で4条件すべてに一致する店舗だけが表示される", async ({
    page,
  }) => {
    // エリアは複数店舗・複数シーンが混在する場所を選ぶ（solo=trueとfalseが両方存在する必要がある）。
    const targetArea = areas.find((area) => {
      const inArea = stores.filter((s) => s.area_id === area.area_id);
      return (
        inArea.some((s) => s.scene_solo) && inArea.some((s) => !s.scene_solo)
      );
    });
    test.skip(
      !targetArea,
      "AND検索の部分一致を確認できるエリア（同一エリア内にscene_solo=true/falseが混在）が現在のデータに存在しません",
    );

    const expected = filterAndSortStores(stores, {
      areaId: targetArea!.area_id,
      time: "lunch",
      scene: "solo",
      availableStoreIds: gapaoStoreIds,
    });
    const partialOnly = filterAndSortStores(stores, {
      areaId: targetArea!.area_id,
    }).filter((s) => !expected.some((e) => e.store_id === s.store_id));
    test.skip(
      expected.length === 0 || partialOnly.length === 0,
      "4条件すべて一致する店舗と、一部だけ一致する店舗の両方が存在する組み合わせが見つかりませんでした",
    );

    await page.goto(
      `/search?area_id=${targetArea!.area_id}&time=lunch&scene=solo&dish_id=${GAPAO_DISH_ID}`,
    );

    const renderedIds = await getRenderedStoreIds(page);
    expect(new Set(renderedIds)).toEqual(
      new Set(expected.map((s) => s.store_id)),
    );

    // 4つの選択条件タグそれぞれに、固定アイコン＋緑色チェックが表示される
    // （色そのものの目視確認は別途手動確認とする）。
    await expectTagHasIconAndCheck(
      getConditionTag(page, targetArea!.area_name),
    );
    await expectTagHasIconAndCheck(getConditionTag(page, "ランチ"));
    await expectTagHasIconAndCheck(getConditionTag(page, "ひとり"));
    await expectTagHasIconAndCheck(getConditionTag(page, GAPAO_DISH_NAME));
  });

  test("TC-U02-02: 時間帯『すべて』のときは時間帯タグが表示されず、他条件は絞り込まれる", async ({
    page,
  }) => {
    const targetArea = areas.find((area) =>
      stores.some((s) => s.area_id === area.area_id && s.scene_solo),
    );
    test.skip(
      !targetArea,
      "scene_solo=trueの店舗が存在するエリアが見つかりませんでした",
    );

    await page.goto(
      `/search?area_id=${targetArea!.area_id}&scene=solo&dish_id=${GAPAO_DISH_ID}`,
    );

    // 時間帯（ランチ／ディナー）を選択していないため、時間帯タグは表示されない
    await expect(getConditionTag(page, "ランチ")).toHaveCount(0);
    await expect(getConditionTag(page, "ディナー")).toHaveCount(0);

    // 選択中のエリア・シーン・料理タグは表示され、固定アイコン＋緑色チェックが付く
    await expectTagHasIconAndCheck(
      getConditionTag(page, targetArea!.area_name),
    );
    await expectTagHasIconAndCheck(getConditionTag(page, "ひとり"));
    await expectTagHasIconAndCheck(getConditionTag(page, GAPAO_DISH_NAME));

    // 店舗カードに「利用シーン：」というラベル文言は表示されない
    // （人物アイコン＋値のみで表示される仕様）
    await expect(page.getByText("利用シーン：")).toHaveCount(0);

    // 時間帯で絞り込まれていないこと（area+scene+dishのみの期待件数と一致）を確認する
    const expected = filterAndSortStores(stores, {
      areaId: targetArea!.area_id,
      scene: "solo",
      availableStoreIds: gapaoStoreIds,
    });
    const renderedIds = await getRenderedStoreIds(page);
    expect(new Set(renderedIds)).toEqual(
      new Set(expected.map((s) => s.store_id)),
    );
  });

  test("TC-U02-03: 全条件未指定で公開店舗がすべて表示される", async ({
    page,
  }) => {
    await page.goto("/search");

    const renderedIds = await getRenderedStoreIds(page);
    expect(new Set(renderedIds)).toEqual(
      new Set(stores.map((s) => s.store_id)),
    );
    await expect(
      page.getByText("条件に合うお店が見つかりませんでした"),
    ).toHaveCount(0);
  });

  test("TC-U02-04: 該当しない条件では0件メッセージと『条件を変更する』導線が表示される", async ({
    page,
  }) => {
    const zeroCombo = findZeroResultAreaScene(stores, areas);
    test.skip(
      !zeroCombo,
      "0件になるエリア×利用シーンの組み合わせが現在のデータから見つかりませんでした",
    );

    await page.goto(
      `/search?area_id=${zeroCombo!.area.area_id}&scene=${zeroCombo!.scene}`,
    );

    await expect(
      page.getByText("条件に合うお店が見つかりませんでした"),
    ).toBeVisible();

    const renderedIds = await getRenderedStoreIds(page);
    expect(renderedIds).toHaveLength(0);

    // 『条件を変更する』リンクが表示され、条件は自動変更されず元の条件を保持したままU01へ戻る
    const changeLinks = page.getByRole("link", { name: "条件を変更する" });
    await expect(changeLinks.first()).toBeVisible();
    const href = await changeLinks.first().getAttribute("href");
    expect(href).toContain(`area_id=${zeroCombo!.area.area_id}`);
    expect(href).toContain(`scene=${zeroCombo!.scene}`);
  });

  test("TC-U02-05: 徒歩時間の短い店舗から順に表示される", async ({ page }) => {
    const areaWithMultipleWalkTimes = areas.find((area) => {
      const inArea = stores.filter((s) => s.area_id === area.area_id);
      const distinctWalkTimes = new Set(inArea.map((s) => s.walk_minutes));
      return inArea.length >= 2 && distinctWalkTimes.size >= 2;
    });
    test.skip(
      !areaWithMultipleWalkTimes,
      "徒歩時間が異なる店舗が複数存在するエリアが見つかりませんでした",
    );

    await page.goto(`/search?area_id=${areaWithMultipleWalkTimes!.area_id}`);

    const expected = filterAndSortStores(stores, {
      areaId: areaWithMultipleWalkTimes!.area_id,
    }).map((s) => s.store_id);
    const renderedIds = await getRenderedStoreIds(page);
    expect(renderedIds).toEqual(expected);
  });

  test("TC-U02-06: 徒歩時間が同じ店舗はstore_idの昇順（登録順）で表示される", async ({
    page,
  }) => {
    let tieArea: MasterArea | undefined;
    let tiedStoreIds: [number, number] | undefined;
    for (const area of areas) {
      const inArea = stores.filter((s) => s.area_id === area.area_id);
      const byWalk = new Map<number, number[]>();
      for (const s of inArea) {
        const list = byWalk.get(s.walk_minutes) ?? [];
        list.push(s.store_id);
        byWalk.set(s.walk_minutes, list);
      }
      const tied = Array.from(byWalk.values()).find((ids) => ids.length >= 2);
      if (tied) {
        tieArea = area;
        tiedStoreIds = [
          Math.min(...tied),
          tied.filter((id) => id !== Math.min(...tied))[0],
        ];
        break;
      }
    }
    test.skip(
      !tieArea || !tiedStoreIds,
      "徒歩時間が同じ店舗が複数存在するエリアが見つかりませんでした",
    );

    await page.goto(`/search?area_id=${tieArea!.area_id}`);

    const renderedIds = await getRenderedStoreIds(page);
    const [smallerId, largerId] = tiedStoreIds!;
    expect(renderedIds.indexOf(smallerId)).toBeGreaterThanOrEqual(0);
    expect(renderedIds.indexOf(largerId)).toBeGreaterThanOrEqual(0);
    expect(renderedIds.indexOf(smallerId)).toBeLessThan(
      renderedIds.indexOf(largerId),
    );
  });

  test("TC-U02-07: 料理選択時『ほかにも』には選択料理を除く提供中料理の表示順先頭1件だけが表示される", async ({
    page,
  }) => {
    const targetStoreId = gapaoStoreIds.find((id) =>
      stores.some((s) => s.store_id === id),
    );
    test.skip(!targetStoreId, "ガパオを提供する公開店舗が見つかりませんでした");

    await page.goto(`/search?dish_id=${GAPAO_DISH_ID}`);

    const links = page.getByRole("link", { name: "詳しく見る", exact: true });
    const linkCount = await links.count();
    test.skip(linkCount === 0, "検索結果の店舗カードが見つかりませんでした");

    let checkedAtLeastOne = false;

    for (let i = 0; i < linkCount; i += 1) {
      const link = links.nth(i);
      const storeId = extractStoreId(await link.getAttribute("href"));
      if (storeId === null) {
        continue;
      }

      // 選択料理（ガパオ）を除く提供中料理を表示順で並べ、先頭1件の料理名を期待値として計算する。
      const expectedOtherDishName = computeExpectedOtherDishName(
        storeDishes,
        dishNameById,
        storeId,
        GAPAO_DISH_ID,
      );

      const cardBody = getCardBodyForLink(link);
      const otherDishTexts = cardBody.getByText(/^ほかにも：/);
      const otherDishCount = await otherDishTexts.count();

      if (expectedOtherDishName === null) {
        // ガパオ以外の提供中料理がない店舗では「ほかにも：」自体が表示されない（TC-U02-08相当）。
        expect(otherDishCount).toBe(0);
        continue;
      }

      // 「1件だけ表示される」（「・」で複数連結されない）ことと、
      // その1件が「表示順の先頭」（display_order最小）と一致することの両方を確認する。
      expect(otherDishCount).toBe(1);
      await expect(otherDishTexts.first()).toHaveText(
        `ほかにも：${expectedOtherDishName}`,
      );
      checkedAtLeastOne = true;
    }

    expect(checkedAtLeastOne).toBe(true);
  });

  test("TC-U02-09: 主な料理は表示順で最大2件だけ表示される", async ({
    page,
  }) => {
    const dishCountByStore = new Map<number, number>();
    for (const row of storeDishes) {
      dishCountByStore.set(
        row.store_id,
        (dishCountByStore.get(row.store_id) ?? 0) + 1,
      );
    }

    // 3件以上の提供中料理を持つ公開店舗を動的に選ぶ
    // （「3件以上あるのに画面では最大2件」まで確認するための前提条件）。
    const targetStoreId = stores
      .map((s) => s.store_id)
      .find((id) => (dishCountByStore.get(id) ?? 0) >= 3);

    expect(
      targetStoreId,
      "事前条件が失われました: 3件以上の提供中料理を持つ公開店舗が見つかりません",
    ).toBeDefined();

    const expectedMainDishText = computeExpectedMainDishText(
      storeDishes,
      dishNameById,
      targetStoreId!,
      2,
    );
    expect(
      expectedMainDishText,
      "事前条件が失われました: 期待される主な料理テキストを計算できません",
    ).not.toBeNull();

    await page.goto("/search");

    const links = page.getByRole("link", { name: "詳しく見る", exact: true });
    const linkCount = await links.count();

    let matchedCardBody: Locator | null = null;
    for (let i = 0; i < linkCount; i += 1) {
      const link = links.nth(i);
      const storeId = extractStoreId(await link.getAttribute("href"));
      if (storeId === targetStoreId) {
        matchedCardBody = getCardBodyForLink(link);
        break;
      }
    }
    expect(
      matchedCardBody,
      `事前条件が失われました: store_id=${targetStoreId}の検索結果カードが見つかりません`,
    ).not.toBeNull();

    const mainDishTexts = matchedCardBody!.getByText(/^主な料理：/);
    await expect(mainDishTexts).toHaveText(`主な料理：${expectedMainDishText}`);

    const displayedText = await mainDishTexts.textContent();
    const dishNamesShown = displayedText!.replace("主な料理：", "").split("・");

    // 表示は最大2件までであることを明示的に確認する。
    expect(dishNamesShown.length).toBeLessThanOrEqual(2);
    // DB上は3件以上登録されているのに、画面では2件までしか表示されないことを確認する。
    expect(dishCountByStore.get(targetStoreId!)).toBeGreaterThanOrEqual(3);
  });
});
