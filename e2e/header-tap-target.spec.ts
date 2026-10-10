import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { fetchPublishedStores, readSupabaseEnv } from "./supabase-data";

/**
 * スマホ幅（767px以下）のヘッダーのリンクのタップ領域の確認（要件仕様書 17_非機能要件 NF13
 * 「操作部分の高さを原則44px以上とする」）。
 *
 * - ログイン済み: 「メモ一覧」「お気に入り」「アカウント削除」
 * - 未ログイン: 「ログイン」「新規登録」（同じ .authLink クラスを使うため、同じく44px以上になる）
 * - 768px以上（タブレット・PC）は、従来の表示を維持する
 *
 * ログイン済みの表示は、実際のログインではなく、ブラウザ側のログイン確認（/auth/v1/user）を
 * このテストの中で差し替えて再現する（ヘッダーの認証表示はブラウザ側で判定するため）。
 * Supabaseのアカウント・ユーザーデータには依存しない（店舗詳細の表示用に、公開店舗のIDだけを読み取る）。
 */

const MIN_TAP_HEIGHT = 44;
const MOBILE_WIDTHS = [320, 375, 767];
const WIDE_WIDTHS = [768, 1280];
const LOGGED_IN_LINKS = ["メモ一覧", "お気に入り", "アカウント削除"];
const LOGGED_OUT_LINKS = ["ログイン", "新規登録"];

// 今回の修正（767px以下の .authLink の3行）を打ち消して、変更前相当の表示を作る
const REVERT_CSS = `@media (max-width: 767px) {
  [class*="authLink"] {
    display: block !important;
    align-items: normal !important;
    min-height: auto !important;
  }
}`;

const MOCK_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "tap-target-test@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

function base64Url(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(text).toString("base64url");
}

/** ログイン済みのブラウザの状態を再現する（Cookie ＋ ログイン確認の差し替え） */
async function loginInBrowser(context: BrowserContext, baseURL: string) {
  const { url } = readSupabaseEnv();
  const storageKey = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const accessToken = [
    base64Url({ alg: "HS256", typ: "JWT" }),
    base64Url({
      sub: MOCK_USER.id,
      aud: "authenticated",
      role: "authenticated",
      exp: expiresAt,
    }),
    "test-signature",
  ].join(".");
  const session = {
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 24 * 60 * 60,
    expires_at: expiresAt,
    user: MOCK_USER,
  };
  await context.addCookies([
    { name: storageKey, value: `base64-${base64Url(session)}`, url: baseURL },
  ]);
  // ブラウザ側のログイン確認（getClaims → getUser）の応答を、このテストの中で差し替える
  await context.route("**/auth/v1/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(MOCK_USER),
    }),
  );
}

async function getPublishedStoreId(): Promise<number> {
  const stores = await fetchPublishedStores();
  const storeId = stores[0]?.store_id;
  expect(
    storeId,
    "事前条件が失われました: 公開店舗が1件も見つかりません",
  ).toBeDefined();
  return storeId as number;
}

type Measure = {
  links: Record<
    string,
    { height: number; textOffset: number; minHeight: string }
  >;
  headerHeight: number;
  rows: number;
  overflowX: boolean;
  overlaps: string[];
};

/** ヘッダーの認証表示（リンク）の実際の大きさ・位置を測る */
async function measure(page: Page, labels: string[]): Promise<Measure> {
  // 認証表示（ログイン済みは3リンク・未ログインは2リンク）が表示されるまで待つ
  await expect(
    page.getByRole("link", { name: labels[0], exact: true }),
  ).toBeVisible();
  return page.evaluate((names) => {
    const anchors = [...document.querySelectorAll("a")].filter((a) =>
      names.includes((a.textContent ?? "").trim()),
    );
    const wrapper = anchors[0].parentElement as HTMLElement;
    const header = (document.querySelector("header") ??
      wrapper.parentElement) as HTMLElement;

    const links: Measure["links"] = {};
    for (const a of anchors) {
      const rect = a.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(a);
      const text = range.getBoundingClientRect();
      links[(a.textContent ?? "").trim()] = {
        height: Math.round(rect.height * 10) / 10,
        // 文字が、リンクの箱の縦方向の中央にあるか（上の余白 − 下の余白）
        textOffset:
          Math.round((text.top - rect.top - (rect.bottom - text.bottom)) * 10) /
          10,
        minHeight: getComputedStyle(a).minHeight,
      };
    }

    // 認証表示の段数（縦位置が近いものを同じ段とみなす）
    const centers = [...wrapper.children]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0)
      .map((r) => r.top + r.height / 2)
      .sort((x, y) => x - y);
    let rows = 0;
    let last = -Infinity;
    for (const center of centers) {
      if (center - last > 12) {
        rows += 1;
      }
      last = center;
    }

    // 認証表示のリンク・ボタンが、ヘッダー内の他のリンク・ボタン（ロゴ等）と重なっていないか
    const kids = [...wrapper.children]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 0);
    const overlaps = [...header.querySelectorAll("a, button")]
      .filter((e) => !wrapper.contains(e))
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.width > 0 &&
          kids.some(
            (k) =>
              r.left < k.right &&
              r.right > k.left &&
              r.top < k.bottom &&
              r.bottom > k.top,
          )
        );
      })
      .map((e) => (e.textContent ?? "").trim().slice(0, 12));

    return {
      links,
      headerHeight: Math.round(header.getBoundingClientRect().height),
      rows,
      overflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      overlaps,
    };
  }, labels);
}

test.describe("ヘッダーのタップ領域（スマホ幅 767px以下）", () => {
  for (const width of MOBILE_WIDTHS) {
    test(`ログイン済み ${width}px: 『メモ一覧』『お気に入り』『アカウント削除』の高さが44px以上で、文字が縦中央・横スクロールなし・他と重ならない`, async ({
      page,
      context,
      baseURL,
    }) => {
      await loginInBrowser(context, baseURL as string);
      await page.setViewportSize({ width, height: 700 });
      const storeId = await getPublishedStoreId();
      await page.goto(`/store/${storeId}`);

      const result = await measure(page, LOGGED_IN_LINKS);

      for (const label of LOGGED_IN_LINKS) {
        const link = result.links[label];
        expect(link, `${label} のリンクが見つかりません`).toBeDefined();
        expect(link.height, `${label} の高さ`).toBeGreaterThanOrEqual(
          MIN_TAP_HEIGHT,
        );
        expect(link.minHeight).toBe("44px");
        // 文字が縦方向の中央にある（1pxの誤差は許容）
        expect(
          Math.abs(link.textOffset),
          `${label} の文字の縦位置`,
        ).toBeLessThanOrEqual(1);
      }
      expect(result.overflowX, "横スクロール").toBe(false);
      expect(result.overlaps, "他のリンク・ボタンとの重なり").toEqual([]);

      // 各リンクが、実際に押せる（他の要素に隠れていない・見えている・動かない）
      for (const label of LOGGED_IN_LINKS) {
        await page
          .getByRole("link", { name: label, exact: true })
          .click({ trial: true });
      }
    });
  }

  test("ログイン済み 375px: リンクの上端付近（文字の外側の余白）を押しても、移動できる", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginInBrowser(context, baseURL as string);
    await page.setViewportSize({ width: 375, height: 700 });
    const storeId = await getPublishedStoreId();

    // 移動先は、ログイン済みなら一覧、サーバー側でログインを確認できなければログイン画面になる
    const destinations = [
      { label: "メモ一覧", path: "/notes" },
      { label: "お気に入り", path: "/favorites" },
      { label: "アカウント削除", path: "/account/delete" },
    ];
    for (const { label, path } of destinations) {
      await page.goto(`/store/${storeId}`);
      const link = page.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      const { x, y, width } = box as NonNullable<typeof box>;
      await page.mouse.click(x + width / 2, y + 3);
      await page.waitForURL(
        (url) => url.pathname === path || url.pathname === "/login",
      );
    }
  });

  for (const width of MOBILE_WIDTHS) {
    test(`未ログイン ${width}px: 『ログイン』『新規登録』も同じクラスのため高さが44px以上で、文字が縦中央・横スクロールなし・他と重ならない`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 });
      const storeId = await getPublishedStoreId();
      await page.goto(`/store/${storeId}`);

      const result = await measure(page, LOGGED_OUT_LINKS);

      for (const label of LOGGED_OUT_LINKS) {
        const link = result.links[label];
        expect(link, `${label} のリンクが見つかりません`).toBeDefined();
        expect(link.height, `${label} の高さ`).toBeGreaterThanOrEqual(
          MIN_TAP_HEIGHT,
        );
        expect(
          Math.abs(link.textOffset),
          `${label} の文字の縦位置`,
        ).toBeLessThanOrEqual(1);
      }
      expect(result.overflowX, "横スクロール").toBe(false);
      expect(result.overlaps, "他のリンク・ボタンとの重なり").toEqual([]);
    });
  }

  test("今回の修正を打ち消すと 44px 未満に戻る（このテストが修正の有無を検出できる）: 375px", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginInBrowser(context, baseURL as string);
    await page.setViewportSize({ width: 375, height: 700 });
    const storeId = await getPublishedStoreId();
    await page.goto(`/store/${storeId}`);

    const withFix = await measure(page, LOGGED_IN_LINKS);
    await page.addStyleTag({ content: REVERT_CSS });
    const reverted = await measure(page, LOGGED_IN_LINKS);

    for (const label of LOGGED_IN_LINKS) {
      expect(withFix.links[label].height).toBeGreaterThanOrEqual(
        MIN_TAP_HEIGHT,
      );
      expect(reverted.links[label].height).toBeLessThan(MIN_TAP_HEIGHT);
    }
  });
});

test.describe("ヘッダーの従来表示の維持（768px以上）", () => {
  for (const width of WIDE_WIDTHS) {
    for (const state of ["ログイン済み", "未ログイン"] as const) {
      test(`${state} ${width}px: リンクの高さ・ヘッダーの高さ・折り返しは、今回の修正前と同じ（44pxに拡大されない）`, async ({
        page,
        context,
        baseURL,
      }) => {
        const loggedIn = state === "ログイン済み";
        const labels = loggedIn ? LOGGED_IN_LINKS : LOGGED_OUT_LINKS;
        if (loggedIn) {
          await loginInBrowser(context, baseURL as string);
        }
        await page.setViewportSize({ width, height: 800 });
        const storeId = await getPublishedStoreId();
        await page.goto(`/store/${storeId}`);

        const current = await measure(page, labels);
        // 今回の修正を打ち消した状態（変更前相当）と比較する
        await page.addStyleTag({ content: REVERT_CSS });
        const before = await measure(page, labels);

        for (const label of labels) {
          // 767px以下のための規則が、768px以上には効いていない
          expect(current.links[label].minHeight).toBe("auto");
          expect(current.links[label].height).toBeLessThan(MIN_TAP_HEIGHT);
          expect(current.links[label].height).toBe(before.links[label].height);
        }
        expect(current.headerHeight).toBe(before.headerHeight);
        expect(current.rows).toBe(before.rows);
        // 認証表示は1段のまま
        expect(current.rows).toBe(1);
        expect(current.overflowX).toBe(false);
      });
    }
  }
});
