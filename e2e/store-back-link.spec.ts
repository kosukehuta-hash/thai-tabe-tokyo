import { test, expect, type Page } from "@playwright/test";
import { fetchPublishedStores } from "./supabase-data";

/**
 * 店舗詳細（U03）の戻りリンクの出し分けの確認。
 * - メモ一覧から来た（?from=notes）→「← メモ一覧に戻る」（/notes）
 * - お気に入りから来た（?from=favorites）→「← お気に入りに戻る」（/favorites）
 * - それ以外（検索結果から来た・直接アクセス・無効な from）→ 従来どおり「← 検索結果に戻る」
 *
 * ログインが必要な画面（メモ一覧・お気に入り）の中身は開かず、未ログインのまま、戻りリンクの
 * 文言・リンク先・押したときの移動先だけを確認する（未ログインで /notes・/favorites を開くと、
 * ログイン画面へ移動する）。外部URLなどの無効な from で、一覧や外部サイトへ移動しないことも確認する。
 */

async function getPublishedStoreId(): Promise<number> {
  const stores = await fetchPublishedStores();
  const storeId = stores[0]?.store_id;
  expect(
    storeId,
    "事前条件が失われました: 公開店舗が1件も見つかりません",
  ).toBeDefined();
  return storeId as number;
}

/** ヘッダーと本文の2か所にある戻りリンク（表示されていないものも含む）のうち、指定の文言のもの */
function backLinks(page: Page, label: string) {
  return page.locator("a, button").filter({ hasText: `← ${label}に戻る` });
}

test.describe("U03 戻りリンクの出し分け", () => {
  test("メモ一覧から来た場合（from=notes）: 『← メモ一覧に戻る』を表示し、リンク先は /notes。押すと /notes へ移動する（未ログインなのでログイン画面へ）", async ({
    page,
  }) => {
    const storeId = await getPublishedStoreId();
    await page.goto(`/store/${storeId}?from=notes`);

    const links = backLinks(page, "メモ一覧");
    await expect(links).toHaveCount(2); // ヘッダーと本文
    for (let i = 0; i < 2; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", "/notes");
    }
    // 検索結果へ戻るリンクは出さない
    await expect(backLinks(page, "検索結果")).toHaveCount(0);

    await page.getByRole("link", { name: "← メモ一覧に戻る" }).click();
    await page.waitForURL((url) => url.pathname === "/login");
    // 未ログインの /notes は、ログイン後に /notes へ戻れるよう next 付きでログイン画面へ移動する
    expect(new URL(page.url()).searchParams.get("next")).toBe("/notes");
  });

  test("お気に入りから来た場合（from=favorites）: 『← お気に入りに戻る』を表示し、リンク先は /favorites。押すと /favorites へ移動する（未ログインなのでログイン画面へ）", async ({
    page,
  }) => {
    const storeId = await getPublishedStoreId();
    await page.goto(`/store/${storeId}?from=favorites`);

    const links = backLinks(page, "お気に入り");
    await expect(links).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(links.nth(i)).toHaveAttribute("href", "/favorites");
    }
    await expect(backLinks(page, "検索結果")).toHaveCount(0);

    await page.getByRole("link", { name: "← お気に入りに戻る" }).click();
    await page.waitForURL((url) => url.pathname === "/login");
    expect(new URL(page.url()).searchParams.get("next")).toBe("/favorites");
  });

  test("検索結果から来た場合・直接アクセス（from なし）: 従来どおり『← 検索結果に戻る』。検索条件があれば保持した /search へのリンク", async ({
    page,
  }) => {
    const storeId = await getPublishedStoreId();

    await page.goto(`/store/${storeId}`);
    const direct = backLinks(page, "検索結果");
    await expect(direct).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(direct.nth(i)).toHaveAttribute("href", "/search");
    }
    await expect(backLinks(page, "メモ一覧")).toHaveCount(0);
    await expect(backLinks(page, "お気に入り")).toHaveCount(0);

    await page.goto(`/store/${storeId}?area_id=1&time=lunch`);
    const withConditions = backLinks(page, "検索結果");
    await expect(withConditions).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(withConditions.nth(i)).toHaveAttribute(
        "href",
        "/search?area_id=1&time=lunch",
      );
    }
  });

  for (const invalid of [
    "https://evil.example",
    "//evil.example",
    "/\\evil",
    "/notes",
    "/favorites",
    "Notes",
    "unknown",
  ]) {
    test(`無効な from（${invalid}）: 一覧にも外部サイトにも移動せず、従来の『← 検索結果に戻る』にフォールバックする`, async ({
      page,
    }) => {
      const storeId = await getPublishedStoreId();
      await page.goto(
        `/store/${storeId}?from=${encodeURIComponent(invalid)}&area_id=1`,
      );

      const links = backLinks(page, "検索結果");
      await expect(links).toHaveCount(2);
      for (let i = 0; i < 2; i++) {
        await expect(links.nth(i)).toHaveAttribute("href", "/search?area_id=1");
      }
      await expect(backLinks(page, "メモ一覧")).toHaveCount(0);
      await expect(backLinks(page, "お気に入り")).toHaveCount(0);

      // 押しても、外部サイトへは移動しない（同じアプリ内の /search に移動する）
      const appOrigin = new URL(page.url()).origin;
      await page.getByRole("link", { name: "← 検索結果に戻る" }).click();
      await page.waitForURL((url) => url.pathname === "/search");
      expect(new URL(page.url()).origin).toBe(appOrigin);
    });
  }
});
