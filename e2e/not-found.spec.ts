import { test, expect, type Page } from "@playwright/test";

/**
 * 存在しないURLの404画面（src/app/not-found.tsx）の確認。
 * Next.js標準の英語の404画面ではなく、アプリのヘッダー・日本語の案内・「トップへ戻る」リンクが
 * 表示されることを確認する。Supabaseへ問い合わせるURL（/ や /search など）は使わない。
 */

// どのルートにも一致しないURL
const MISSING_PAGES = [
  { label: "存在しないURL", path: "/this-page-does-not-exist" },
  { label: "存在しないURL（階層あり）", path: "/no/such/path" },
];

const TITLE = "ページが見つかりませんでした";
const DESCRIPTION =
  "お探しのページは存在しないか、移動した可能性があります。URLをご確認のうえ、トップページからもう一度お探しください。";

/** ページ全体に意図しない横スクロールが発生していないことを確認する。 */
async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe("404画面（存在しないURL）", () => {
  for (const { label, path } of MISSING_PAGES) {
    test(`${label}（${path}）は、HTTP 404で、日本語の404画面を表示する（Next.js標準の英語画面ではない）`, async ({
      page,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);

      await expect(page).toHaveTitle(
        "ページが見つかりません | THAI TABE TOKYO",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
      await expect(page.getByText("404", { exact: true })).toBeVisible();
      await expect(page.getByText(DESCRIPTION)).toBeVisible();

      // Next.js標準の英語の404画面の文言が出ない
      await expect(page.getByText("This page could not be found")).toHaveCount(
        0,
      );

      // アプリのヘッダー（ロゴ付きのトップへのリンク）が表示される
      const logoLink = page.getByRole("link", { name: "THAI TABE TOKYO" });
      await expect(logoLink).toBeVisible();
      await expect(logoLink).toHaveAttribute("href", "/");
    });
  }

  test("『トップへ戻る』はリンクで、リンク先は / であり、押すとトップへ移動する", async ({
    page,
  }) => {
    await page.goto("/this-page-does-not-exist");

    const homeLink = page.getByRole("link", {
      name: "トップへ戻る",
      exact: true,
    });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", "/");
    // 画面内にボタンはない（開発サーバーのNext.js開発用ボタンは対象外のため、main内だけを見る）
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);

    // 移動先の「/」はSupabaseへ問い合わせる画面のため、通信を空のページに差し替え、
    // 「トップ（/）へ移動すること」だけを確認する（Supabaseには接続しない）
    await page.route(
      (url) => url.pathname === "/",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>top</title>",
        }),
    );

    await homeLink.click();
    await page.waitForURL((url) => url.pathname === "/");
  });

  for (const viewport of [
    { name: "PC幅 1280px", width: 1280, height: 800 },
    { name: "スマホ幅 375px", width: 375, height: 667 },
  ]) {
    test(`${viewport.name}: 横スクロールがなく、見出し・案内・『トップへ戻る』が画面内に収まり、リンクの高さは44px以上である`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/this-page-does-not-exist");

      await expectNoHorizontalScroll(page);

      const homeLink = page.getByRole("link", {
        name: "トップへ戻る",
        exact: true,
      });
      for (const locator of [
        page.getByRole("heading", { level: 1 }),
        page.getByText(DESCRIPTION),
        homeLink,
      ]) {
        await expect(locator).toBeVisible();
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        const { x, width } = box as NonNullable<typeof box>;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(viewport.width);
      }

      const linkBox = await homeLink.boundingBox();
      expect(linkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    });
  }

  test("店舗詳細（/store/abc：店舗IDが不正）は、従来どおり店舗詳細専用の案内（検索結果に戻る）を表示し、この404画面にはならない", async ({
    page,
  }) => {
    // 店舗IDの形式が不正なため、Supabaseへの問い合わせは行われない
    const response = await page.goto("/store/abc");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByText("お探しの店舗情報を表示できませんでした。"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "検索結果に戻る" }),
    ).toBeVisible();
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });

  test("既存の正常なページ（/signup）では、404画面は表示されない", async ({
    page,
  }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(TITLE)).toHaveCount(0);
    await expect(page.getByText("404", { exact: true })).toHaveCount(0);
  });
});
