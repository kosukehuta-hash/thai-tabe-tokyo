import { test, expect, type Browser, type Page } from "@playwright/test";
import {
  LOCAL_SUPABASE_ANON_KEY,
  LOCAL_SUPABASE_URL,
  TEST_PASSWORD,
  deleteTestUsersByEmailLike,
  isLocalSupabaseAvailable,
  queryPsql,
  runPsql,
} from "../src/lib/test/local-supabase";

/**
 * アカウント削除（U08）の実動作を、ブラウザ操作で確認するテスト。
 * 対応TC: TC-U08-03〜05, 08〜12, 15, 18 ほか
 *
 * 【安全のため】ローカルSupabase専用。アカウントを実際に削除するため、
 *   - ローカルSupabase（`supabase start`）が起動していて、
 *   - 開発サーバーがローカルSupabase・ローカルの管理者用キーで起動していて、
 *   - 実行するシェルに環境変数 TEST_LOCAL_ADMIN_KEY が設定されている
 * 場合だけ実行する。それ以外（CIのホスト済みDBなど）では自動的にスキップする。
 * 作成するユーザーは、このテスト専用の新規ユーザー（メールが e2e-acc-del-… で始まる）だけで、
 * 終了時にローカルDBから削除する。本番Supabaseのユーザーは操作しない。
 */

const RUN_ID = Date.now();
const EMAIL_LIKE = `e2e-acc-del-${RUN_ID}-%@example.com`;
let userCounter = 0;
let enabled = false;

function newEmail(label: string): string {
  userCounter += 1;
  return `e2e-acc-del-${RUN_ID}-${label}-${userCounter}@example.com`;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  enabled =
    Boolean(process.env.TEST_LOCAL_ADMIN_KEY) &&
    (await isLocalSupabaseAvailable());
});

test.beforeEach(() => {
  test.skip(
    !enabled,
    "ローカルSupabaseと TEST_LOCAL_ADMIN_KEY がある場合だけ実行する（アカウントを実際に削除するため）",
  );
});

test.afterAll(() => {
  if (enabled) {
    deleteTestUsersByEmailLike(EMAIL_LIKE);
  }
});

// ローカルSupabaseにテスト用ユーザーを新規登録する（Confirm Email無効のため、すぐログインできる）
async function createUser(email: string): Promise<string> {
  const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const body = (await res.json()) as { user?: { id: string }; id?: string };
  const id = body.user?.id ?? body.id;
  if (!res.ok || !id) {
    throw new Error(`テストユーザーの作成に失敗（${email}）: ${res.status}`);
  }
  return id;
}

function firstStoreIds(): number[] {
  return queryPsql(
    "select store_id from public.stores order by store_id limit 2;",
  )
    .split("\n")
    .map(Number);
}

// 他のテストが公開状態を一時的に変更しても影響しないよう、このセッションだけトリガーを無効にして登録する
function seedNoteAndFavorite(userId: string): void {
  const [noteStore, favoriteStore] = firstStoreIds();
  runPsql(
    `set session_replication_role = replica; ` +
      `insert into public.store_visit_notes (user_id, store_id, note_text) values ('${userId}', ${noteStore}, 'e2e account delete note'); ` +
      `insert into public.store_favorites (user_id, store_id) values ('${userId}', ${favoriteStore});`,
  );
}

function count(table: string, userId: string): number {
  return Number(
    queryPsql(
      `select count(*) from public.${table} where user_id = '${userId}';`,
    ),
  );
}

function userExists(userId: string): boolean {
  return (
    Number(
      queryPsql(`select count(*) from auth.users where id = '${userId}';`),
    ) === 1
  );
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
}

async function openDeletePage(page: Page): Promise<void> {
  await page.goto("/account/delete");
  await expect(
    page.getByRole("heading", { name: "アカウント削除", exact: true }),
  ).toBeVisible();
}

const deleteButton = (page: Page) =>
  page.getByRole("button", { name: "アカウントを削除する" });
const confirmBox = (page: Page) => page.getByRole("checkbox");

test.describe("U08 アカウント削除（ローカルSupabase・実削除）", () => {
  test("TC-U08-03〜04・08〜12: 画面の操作で本人のアカウントを削除でき、データも消え、別ユーザーは残り、再ログイン不可・同じメールで再登録できる", async ({
    page,
  }) => {
    const email = newEmail("flow");
    const userId = await createUser(email);
    const bystanderId = await createUser(newEmail("bystander"));
    seedNoteAndFavorite(userId);
    seedNoteAndFavorite(bystanderId);
    expect(count("store_visit_notes", userId)).toBe(1);
    expect(count("store_favorites", userId)).toBe(1);

    await login(page, email);
    await openDeletePage(page);

    // TC-U08-03: 初期表示
    await expect(
      page.getByText(
        "メモとお気に入りを含むアカウント情報が削除され、元に戻せません。",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("上記を理解したうえで、アカウントを削除します"),
    ).toBeVisible();
    await expect(confirmBox(page)).not.toBeChecked();
    await expect(deleteButton(page)).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "アカウント削除を閉じる" }),
    ).toBeVisible();

    // TC-U08-04: チェックボックスと削除ボタンの連動
    await confirmBox(page).check();
    await expect(deleteButton(page)).toBeEnabled();
    await confirmBox(page).uncheck();
    await expect(deleteButton(page)).toBeDisabled();
    await confirmBox(page).check();

    // TC-U08-08: 削除成功 → U01（/?withdrawn=1）で『退会しました』・未ログイン表示
    await deleteButton(page).click();
    await page.waitForURL(
      (url) => url.pathname === "/" && url.search === "?withdrawn=1",
    );
    await expect(page.getByText("退会しました", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ログイン", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "新規登録", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "ログアウト" })).toHaveCount(
      0,
    );

    // TC-U08-08（DB側）・TC-U08-10: アカウントとメモ・お気に入りが削除されている
    expect(userExists(userId)).toBe(false);
    expect(count("store_visit_notes", userId)).toBe(0);
    expect(count("store_favorites", userId)).toBe(0);

    // TC-U08-11: 別ユーザーは影響を受けない
    expect(userExists(bystanderId)).toBe(true);
    expect(count("store_visit_notes", bystanderId)).toBe(1);
    expect(count("store_favorites", bystanderId)).toBe(1);

    // TC-U08-09: 削除後は同じメールアドレス・パスワードでログインできない
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(
      page.getByText("メールアドレスまたはパスワードが正しくありません。"),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");

    // TC-U08-12: 同じメールアドレスで新規登録でき、ログインできる
    await page.goto("/signup");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => url.pathname === "/login");
    await login(page, email);
    const newId = queryPsql(
      `select id from auth.users where email = '${email}';`,
    );
    expect(newId).not.toBe(userId);
    expect(count("store_visit_notes", newId)).toBe(0);
    expect(count("store_favorites", newId)).toBe(0);
  });

  test("TC-U08-08（スマホ幅 375px）: スマホ幅でも、画面の操作で削除でき、U01で『退会しました』が表示される", async ({
    page,
  }) => {
    const email = newEmail("mobile");
    const userId = await createUser(email);
    await page.setViewportSize({ width: 375, height: 800 });

    await login(page, email);
    await openDeletePage(page);
    await expect(deleteButton(page)).toBeDisabled();
    await confirmBox(page).check();
    await expect(deleteButton(page)).toBeEnabled();
    // 横スクロールがない
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await deleteButton(page).click();
    await page.waitForURL(
      (url) => url.pathname === "/" && url.search === "?withdrawn=1",
    );
    await expect(page.getByText("退会しました", { exact: true })).toBeVisible();
    expect(userExists(userId)).toBe(false);
  });

  test("TC-U08-05: 処理中は、チェックボックスと削除ボタンが無効になり、二重に送信できない", async ({
    page,
  }) => {
    const email = newEmail("double");
    const userId = await createUser(email);
    await login(page, email);
    await openDeletePage(page);

    // 削除のServer Action（POST）の応答を2秒遅らせ、処理中の状態を作る
    let postCount = 0;
    await page.route("**/account/delete", async (route) => {
      if (route.request().method() === "POST") {
        postCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await route.continue();
    });

    await confirmBox(page).check();
    await deleteButton(page).click();

    // 処理中: どちらも無効
    await expect(deleteButton(page)).toBeDisabled();
    await expect(confirmBox(page)).toBeDisabled();
    // 無効のボタンを（強制的に）もう一度押そうとしても、送信されない
    await deleteButton(page)
      .click({ force: true, timeout: 500 })
      .catch(() => {});
    await deleteButton(page)
      .dispatchEvent("click")
      .catch(() => {});

    await page.waitForURL(
      (url) => url.pathname === "/" && url.search === "?withdrawn=1",
    );
    expect(postCount).toBe(1);
    expect(userExists(userId)).toBe(false);
  });

  test("TC-U08-15: ログイン中に /?withdrawn=1 を開いても『退会しました』は表示されない（ログアウト状態では表示される）", async ({
    page,
    browser,
  }) => {
    const email = newEmail("withdrawn");
    await createUser(email);

    await login(page, email);
    await page.goto("/?withdrawn=1");
    await expect(
      page.getByRole("button", { name: "ログアウト" }),
    ).toBeVisible();
    await expect(page.getByText("退会しました", { exact: true })).toHaveCount(
      0,
    );

    // 未ログイン（別のブラウザ状態）では表示される
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto("/?withdrawn=1");
    await expect(
      guestPage.getByText("退会しました", { exact: true }),
    ).toBeVisible();
    // 目印がなければ、未ログインでも表示されない
    await guestPage.goto("/");
    await expect(
      guestPage.getByText("退会しました", { exact: true }),
    ).toHaveCount(0);
    await guestPage.goto("/?withdrawn=0");
    await expect(
      guestPage.getByText("退会しました", { exact: true }),
    ).toHaveCount(0);
    await guest.close();
  });
});

// 認証Cookie（sb-…-auth-token）の値からセッション情報を取り出す・書き換える補助
type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  [key: string]: unknown;
};

async function readSessionCookies(page: Page) {
  const cookies = (await page.context().cookies()).filter((c) =>
    /^sb-.*-auth-token(\.\d+)?$/.test(c.name),
  );
  const base = cookies[0]?.name.replace(/\.\d+$/, "") ?? "";
  const joined = cookies
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  return { cookies, base, joined };
}

function decodeSession(raw: string): StoredSession {
  const json = raw.startsWith("base64-")
    ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
    : decodeURIComponent(raw);
  return JSON.parse(json) as StoredSession;
}

async function openSecondBrowser(
  browser: Browser,
  email: string,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, email);
  return page;
}

test.describe("TC-U08-18: 他タブ・他端末に残る既存セッション（ローカルSupabase・実測）", () => {
  test("削除直後も、別のブラウザには一時的にログイン表示が残り得るが、更新・再ログイン・データ作成はできず、期限切れの更新が失敗するとログアウト状態になる", async ({
    page,
    browser,
  }) => {
    const email = newEmail("othertab");
    const userId = await createUser(email);
    seedNoteAndFavorite(userId);

    // 別ブラウザ（別端末に見立てる）でも同じアカウントでログインしておく
    const other = await openSecondBrowser(browser, email);
    await other.goto("/store/" + firstStoreIds()[1]);
    await expect(
      other.getByRole("button", { name: "ログアウト" }),
    ).toBeVisible();
    const before = await readSessionCookies(other);
    const stored = decodeSession(before.joined);

    // 一方のブラウザで、アカウントを削除する
    await login(page, email);
    await openDeletePage(page);
    await confirmBox(page).check();
    await deleteButton(page).click();
    await page.waitForURL(
      (url) => url.pathname === "/" && url.search === "?withdrawn=1",
    );
    expect(userExists(userId)).toBe(false);

    // 別ブラウザ: ページを再読み込みしたとき、ログイン状態の判定（ヘッダーの仮表示のあと）がどうなるかを実測する。
    // 既存トークンの有効期限内は、ログイン中の表示が一時的に残る場合がある（これは不具合としない）
    await other.reload();
    const logoutButton = other.getByRole("button", { name: "ログアウト" });
    const loginLink = other.getByRole("link", {
      name: "ログイン",
      exact: true,
    });
    await expect(logoutButton.or(loginLink)).toBeVisible({ timeout: 15000 });
    const stillLoggedInAfterReload = await logoutButton.isVisible();
    console.info(
      `[TC-U08-18 実測] 削除直後に別ブラウザを再読み込み → ログイン中の表示が残る: ${stillLoggedInAfterReload}`,
    );

    // 古いリフレッシュトークンでは、セッション更新できない
    const refresh = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: LOCAL_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: stored.refresh_token }),
      },
    );
    expect(refresh.ok).toBe(false);

    // 同じメールアドレス・パスワードでは、再ログインできない
    const relogin = await fetch(
      `${LOCAL_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: LOCAL_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password: TEST_PASSWORD }),
      },
    );
    expect(relogin.ok).toBe(false);

    // 別ブラウザの画面で、お気に入りの登録操作をしても、データは作成されない
    await other.goto("/store/" + firstStoreIds()[1]);
    const favoriteButton = other.getByRole("button", { name: /お気に入り/ });
    if (await favoriteButton.isVisible().catch(() => false)) {
      await favoriteButton.click();
      await other.waitForTimeout(1500);
    }
    expect(count("store_favorites", userId)).toBe(0);
    expect(count("store_visit_notes", userId)).toBe(0);

    // 有効期限切れの状態（保存されたセッションの expires_at が過去）にして再読み込みすると、
    // ブラウザがセッション更新を試みて失敗し、ログアウト状態になる
    const expired: StoredSession = { ...stored, expires_at: 1 };
    const encoded =
      "base64-" +
      Buffer.from(JSON.stringify(expired), "utf8").toString("base64url");
    const cookieTemplate = before.cookies[0];
    await other.context().clearCookies();
    await other.context().addCookies([
      {
        name: before.base,
        value: encoded,
        domain: cookieTemplate.domain,
        path: cookieTemplate.path,
        httpOnly: cookieTemplate.httpOnly,
        secure: cookieTemplate.secure,
        sameSite: cookieTemplate.sameSite,
        expires: cookieTemplate.expires,
      },
    ]);
    await other.goto("/");
    await expect(
      other.getByRole("link", { name: "ログイン", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(other.getByRole("button", { name: "ログアウト" })).toHaveCount(
      0,
    );
  });
});
