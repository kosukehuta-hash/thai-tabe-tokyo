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
});
