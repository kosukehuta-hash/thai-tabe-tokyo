import { test, expect } from "@playwright/test";
import { fetchPublishedStores } from "./supabase-data";

/**
 * 未ログイン状態を確認するテスト群。
 * Playwrightはテストごとに新しいブラウザコンテキスト（cookie・localStorageが空）を
 * 生成するため、認証用テストアカウントを作成・ログインする操作は一切行わず、
 * デフォルトの状態がそのまま「未ログイン」であることを利用する。
 */
test.describe("未ログイン状態の共通表示", () => {
  test("TC-COM-05: 未ログイン時はヘッダーにログイン・新規登録の導線が表示され、ログイン中表示は出ない", async ({
    page,
  }) => {
    await page.goto("/");

    const loginLink = page.getByRole("link", { name: "ログイン", exact: true });
    const signupLink = page.getByRole("link", {
      name: "新規登録",
      exact: true,
    });

    await expect(loginLink).toBeVisible();
    await expect(signupLink).toBeVisible();

    // 内部パス（/login・/signup）へのリンクであることを確認する
    await expect(loginLink).toHaveAttribute("href", /^\/login\?next=/);
    await expect(signupLink).toHaveAttribute("href", "/signup");

    // ログイン中の表示（ログアウトボタン等）は存在しない
    await expect(page.getByText("ログイン中", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /ログアウト/ })).toHaveCount(
      0,
    );
  });

  test("TC-MEMO-01: 未ログイン時はU03に『行ったお店のメモ』欄が表示されない", async ({
    page,
  }) => {
    const stores = await fetchPublishedStores();
    const targetStoreId = stores[0]?.store_id;

    expect(
      targetStoreId,
      "事前条件が失われました: 公開店舗が1件も見つかりません",
    ).toBeDefined();

    await page.goto(`/store/${targetStoreId}`);

    // 見出し自体が存在しない
    await expect(
      page.getByText("行ったお店のメモ", { exact: true }),
    ).toHaveCount(0);

    // 入力欄・登録ボタン等の操作部品も存在しない
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /メモ.*(登録|更新|削除)/ }),
    ).toHaveCount(0);
  });

  test("TC-FAV-01: 未ログイン時はU03に『お気に入り』ボタン（♡ / ♥）が表示されない", async ({
    page,
  }) => {
    const stores = await fetchPublishedStores();
    const targetStoreId = stores[0]?.store_id;

    expect(
      targetStoreId,
      "事前条件が失われました: 公開店舗が1件も見つかりません",
    ).toBeDefined();

    await page.goto(`/store/${targetStoreId}`);
    // 認証状態の判定が終わり、未ログインの導線が表示されてから確認する
    await expect(
      page.getByRole("link", { name: "ログイン", exact: true }),
    ).toBeVisible();

    // 登録前（♡）・登録済み（♥）のどちらの表示も存在せず、ボタン・リンクも存在しない
    await expect(page.getByText("♡ お気に入り", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByText("♥ お気に入り済み", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /お気に入り/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: /お気に入り/ })).toHaveCount(0);
  });

  test("TC-U07-08: 未ログインで /favorites を開くと /login?next=/favorites へ移動する", async ({
    page,
  }) => {
    await page.goto("/favorites");
    await page.waitForURL("**/login**");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("/favorites");

    // ログイン画面が表示されている（お気に入り一覧の内容は表示されない）
    await expect(page.locator("#email")).toBeVisible();
    await expect(
      page.getByText("まだお気に入りの店舗がありません"),
    ).toHaveCount(0);
  });
});

/**
 * TC-COM-10（未ログイン側）: 共通ヘッダー（AuthStatus）に、ログイン時だけ表示される
 * 『メモ一覧』『お気に入り』のリンクが未ログイン時には表示されないこと、および
 * 各画面幅で、認証表示がロゴと重ならず、横スクロールも発生しないことを確認する。
 *
 * ログイン時の表示（『メモ一覧』→『お気に入り』の順、リンク先が /favorites）は、
 * この e2e 構成ではログイン済み状態を安全に用意できない（テストアカウントの作成が
 * 本番Supabaseへの書き込みになる）ため、単体テスト（AuthStatus.test.tsx）と
 * 手動確認で担保する。
 */
type Box = { x: number; y: number; width: number; height: number };

function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width - 0.5 &&
    a.x + a.width > b.x + 0.5 &&
    a.y < b.y + b.height - 0.5 &&
    a.y + a.height > b.y + 0.5
  );
}

test.describe("TC-COM-10（未ログイン側） 共通ヘッダーの表示", () => {
  // 375px / 768px / 900px前後 / 1200px以上
  for (const width of [375, 768, 900, 1200]) {
    test(`${width}px: U01・U02・U03で『メモ一覧』『お気に入り』が表示されず、認証表示がロゴと重ならず、横スクロールもない`, async ({
      page,
    }) => {
      const stores = await fetchPublishedStores();
      const targetStoreId = stores[0]?.store_id;
      expect(
        targetStoreId,
        "事前条件が失われました: 公開店舗が1件も見つかりません",
      ).toBeDefined();

      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/", "/search", `/store/${targetStoreId}`]) {
        await page.goto(path);
        const login = page.getByRole("link", { name: "ログイン", exact: true });
        const signup = page.getByRole("link", {
          name: "新規登録",
          exact: true,
        });
        await expect(login).toBeVisible();
        await expect(signup).toBeVisible();

        // ログイン時のみ表示されるリンクは存在しない
        await expect(
          page.getByRole("link", { name: "メモ一覧", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "お気に入り", exact: true }),
        ).toHaveCount(0);

        // 認証表示（ログイン・新規登録）がロゴと重ならない
        const logo = page.getByText("THAI TABE TOKYO", { exact: true }).first();
        const logoBox = await logo.boundingBox();
        expect(logoBox, `${path}: ロゴの位置を取得できません`).not.toBeNull();
        for (const link of [login, signup]) {
          const box = await link.boundingBox();
          expect(
            box,
            `${path}: 認証リンクの位置を取得できません`,
          ).not.toBeNull();
          expect(
            boxesOverlap(box as Box, logoBox as Box),
            `${path}（${width}px）: 認証表示がロゴと重なっています`,
          ).toBe(false);
        }

        // 横スクロールが発生しない
        const noHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(
          noHorizontalScroll,
          `${path}（${width}px）: 横スクロールが発生しています`,
        ).toBe(true);
      }
    });
  }
});
