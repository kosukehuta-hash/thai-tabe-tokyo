import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { deleteUserAsAdmin } from "@/lib/supabase/admin";
import {
  LOCAL_SUPABASE_URL,
  TEST_PASSWORD,
  deleteTestUsersByEmailLike,
  getLocalAdminKey,
  isLocalSupabaseAvailable,
  newAnonClient,
  queryPsql,
  runPsql,
  signUpTestUser,
} from "@/lib/test/local-supabase";

/**
 * アカウント削除（auth.admin.deleteUser）の実動作の検証。
 * 対応TC: TC-U08-09〜12, TC-U08-17, TC-DB-06（実動作の側）, TC-SEC-28
 * 対応仕様: 要件仕様書 Ver2 09_DB設計 11、18_環境変数・セキュリティ ES48〜ES55
 *
 * 【安全のため】ローカルSupabase（`supabase start`で起動したこのプロジェクト専用インスタンス）に
 * 対してのみ実行する。接続先は固定でローカルのURLに差し替えるため、本番Supabaseのユーザーは
 * 削除できない。ローカルの管理者用キーは、実行するシェルの環境変数 TEST_LOCAL_ADMIN_KEY
 * （`supabase status` で表示されるローカルのSecret key）で渡す。未設定の場合、
 * およびローカルSupabase・Dockerが利用できない環境（CI等）では自動的にスキップする。
 * テストで作るユーザーは、このテスト専用の新規ユーザーだけ（既存のユーザーは削除しない）。
 *
 * 【テストの順序について】
 * 「削除前」→「削除」→「削除後」の順に状態を進めるため、it は上から順に実行される前提で書いている。
 */

const localAvailable = await isLocalSupabaseAvailable();
// REQUIRE_LOCAL_SUPABASE=1（CI）のときは、未設定ならskipせずエラーになる
const adminKey = getLocalAdminKey();

function count(table: string, userId: string): number {
  return Number(
    queryPsql(
      `select count(*) from public.${table} where user_id = '${userId}';`,
    ),
  );
}

function authUserExists(userId: string): boolean {
  return (
    Number(
      queryPsql(`select count(*) from auth.users where id = '${userId}';`),
    ) === 1
  );
}

// 他のテスト（公開状態を一時的に変更するもの）と干渉しないよう、このセッションだけトリガーを無効にして登録する
function seedNoteAndFavorite(
  userId: string,
  noteStoreId: number,
  favoriteStoreId: number,
): void {
  runPsql(
    `set session_replication_role = replica; ` +
      `insert into public.store_visit_notes (user_id, store_id, note_text) values ('${userId}', ${noteStoreId}, 'vitest-account-delete note'); ` +
      `insert into public.store_favorites (user_id, store_id) values ('${userId}', ${favoriteStoreId});`,
  );
}

async function signIn(
  email: string,
): Promise<{ client: SupabaseClient<Database>; userId: string }> {
  const client = newAnonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(`ログインに失敗: ${error?.message}`);
  }
  return { client, userId: data.user.id };
}

describe.skipIf(!localAvailable || !adminKey)(
  "アカウント削除: 実動作（ローカルSupabase専用）",
  () => {
    const RUN_ID = Date.now();
    const emailLike = `vitest-acc-del-${RUN_ID}-%@example.com`;
    const targetEmail = `vitest-acc-del-${RUN_ID}-target@example.com`;
    const bystanderEmail = `vitest-acc-del-${RUN_ID}-bystander@example.com`;

    let storeIds: number[] = [];
    let target: { client: SupabaseClient<Database>; userId: string };
    let targetSecondSession: {
      client: SupabaseClient<Database>;
      userId: string;
    };
    let bystander: { client: SupabaseClient<Database>; userId: string };
    // 削除前に控えておく、本人の古いトークン
    let staleRefreshTokens: string[] = [];
    let staleAccessTokens: string[] = [];
    let reRegisteredUserId = "";

    beforeAll(async () => {
      // 管理者用キーは、ローカルの値を、アプリのAdminモジュールが読む環境変数として一時的に設定する。
      // 接続先は必ずローカルのURLにする（本番へは接続しない）
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", LOCAL_SUPABASE_URL);
      vi.stubEnv("SUPABASE_SECRET_KEY", adminKey as string);

      storeIds = queryPsql(
        "select store_id from public.stores order by store_id limit 2;",
      )
        .split("\n")
        .map(Number);
      expect(storeIds).toHaveLength(2);

      target = await signUpTestUser(targetEmail);
      bystander = await signUpTestUser(bystanderEmail);
      // 同じアカウントで、別のブラウザ・別端末に見立てた2つ目のセッションを作る
      targetSecondSession = await signIn(targetEmail);

      seedNoteAndFavorite(target.userId, storeIds[0], storeIds[1]);
      seedNoteAndFavorite(bystander.userId, storeIds[0], storeIds[1]);

      const sessions = await Promise.all(
        [target.client, targetSecondSession.client].map((c) =>
          c.auth.getSession(),
        ),
      );
      staleRefreshTokens = sessions.map((s) => s.data.session!.refresh_token);
      staleAccessTokens = sessions.map((s) => s.data.session!.access_token);
    }, 60_000);

    afterAll(() => {
      vi.unstubAllEnvs();
      deleteTestUsersByEmailLike(emailLike);
    });

    it("削除前: 対象ユーザー・別ユーザーとも、アカウントとメモ・お気に入りが存在する", () => {
      expect(authUserExists(target.userId)).toBe(true);
      expect(authUserExists(bystander.userId)).toBe(true);
      expect(count("store_visit_notes", target.userId)).toBe(1);
      expect(count("store_favorites", target.userId)).toBe(1);
      expect(count("store_visit_notes", bystander.userId)).toBe(1);
      expect(count("store_favorites", bystander.userId)).toBe(1);
    });

    it("TC-U08-08（DB側）: 本人のアカウントが削除される（auth.users から消える）", async () => {
      const result = await deleteUserAsAdmin(target.userId);
      expect(result).toEqual({ error: null });
      expect(authUserExists(target.userId)).toBe(false);
    });

    it("TC-U08-10 / TC-DB-06: 本人のメモ・お気に入りが ON DELETE CASCADE で削除される", () => {
      expect(count("store_visit_notes", target.userId)).toBe(0);
      expect(count("store_favorites", target.userId)).toBe(0);
    });

    it("TC-U08-11: 別ユーザーのアカウント・メモ・お気に入りは、そのまま残る", async () => {
      expect(authUserExists(bystander.userId)).toBe(true);
      expect(count("store_visit_notes", bystander.userId)).toBe(1);
      expect(count("store_favorites", bystander.userId)).toBe(1);

      // 別ユーザーは引き続きログインでき、自分のお気に入りを取得できる
      const again = await signIn(bystanderEmail);
      expect(again.userId).toBe(bystander.userId);
      const favorites = await again.client.rpc("get_own_favorites");
      expect(favorites.error).toBeNull();
      expect(favorites.data).toHaveLength(1);
    });

    it("TC-U08-09: 削除後は、同じメールアドレス・パスワードでログインできない", async () => {
      const client = newAnonClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: targetEmail,
        password: TEST_PASSWORD,
      });
      expect(error).not.toBeNull();
      expect(data.session).toBeNull();
    });

    it("TC-U08-17: 削除済みユーザーの古いリフレッシュトークンで、セッション更新できない（2つのセッションとも）", async () => {
      for (const refreshToken of staleRefreshTokens) {
        const client = newAnonClient();
        const { data, error } = await client.auth.refreshSession({
          refresh_token: refreshToken,
        });
        expect(error).not.toBeNull();
        expect(data.session).toBeNull();
      }
    });

    it("TC-U08-17: 削除済みユーザーに対する削除の再実行は成功しない（他ユーザーにも影響しない）", async () => {
      const again = await deleteUserAsAdmin(target.userId);
      expect(again.error).not.toBeNull();
      expect(authUserExists(bystander.userId)).toBe(true);
    });

    it("TC-U08-17: 古いアクセストークンが残っていても、削除済みユーザーとしてメモ・お気に入りを作成できない", async () => {
      for (const session of [target, targetSecondSession]) {
        const note = await session.client.from("store_visit_notes").insert({
          user_id: target.userId,
          store_id: storeIds[0],
          note_text: "stale token note",
        });
        expect(note.error).not.toBeNull();

        const favorite = await session.client.from("store_favorites").insert({
          user_id: target.userId,
          store_id: storeIds[1],
        });
        expect(favorite.error).not.toBeNull();
      }
      expect(count("store_visit_notes", target.userId)).toBe(0);
      expect(count("store_favorites", target.userId)).toBe(0);
    });

    it("TC-U08-17: 古いアクセストークンによる getUser（サーバー確認）は、削除済みユーザーを認証しない", async () => {
      for (const accessToken of staleAccessTokens) {
        const client = newAnonClient();
        const { data, error } = await client.auth.getUser(accessToken);
        expect(data.user).toBeNull();
        expect(error).not.toBeNull();
      }
    });

    it("【記録】TC-U08-18: 他タブ相当（2つ目のセッション）で getClaims・getSession が返す内容を確認する（挙動の記録）", async () => {
      const claims = await targetSecondSession.client.auth.getClaims();
      const session = await targetSecondSession.client.auth.getSession();
      // ブラウザ側のヘッダー（AuthStatus）は getClaims() で判定する。
      // ローカルのJWT署名方式では、getClaims がサーバーへ確認して失敗する場合と、
      // 署名・有効期限の検証だけで成功する場合がある（実際の挙動を記録する）
      console.info(
        "[TC-U08-18 記録] getClaims:",
        JSON.stringify({
          hasClaims: Boolean(claims.data?.claims),
          errorName: claims.error?.name ?? null,
        }),
        " / getSession（端末に残る保存済みセッション）:",
        JSON.stringify({ hasSession: Boolean(session.data.session) }),
      );
      // どちらの結果でも、削除済みユーザーのデータは作成・復元されない（上のテストで確認済み）
      expect(authUserExists(target.userId)).toBe(false);
    });

    it("TC-U08-12: 削除後、同じメールアドレスで新規登録でき、ログインできる（削除前のデータは復元されない）", async () => {
      const client = newAnonClient();
      const { data, error } = await client.auth.signUp({
        email: targetEmail,
        password: TEST_PASSWORD,
      });
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      expect(data.session).not.toBeNull();
      reRegisteredUserId = data.user!.id;
      // 新しいアカウントとして作られる（削除前のIDとは別）
      expect(reRegisteredUserId).not.toBe(target.userId);

      const again = await signIn(targetEmail);
      expect(again.userId).toBe(reRegisteredUserId);

      // 削除前のメモ・お気に入りは復元されない
      expect(count("store_visit_notes", reRegisteredUserId)).toBe(0);
      expect(count("store_favorites", reRegisteredUserId)).toBe(0);
    });

    it("TC-SEC-28: ログイン中ユーザー（Publishable key）のクライアントから Admin API を実行しても、アカウントを削除できない", async () => {
      const { error } = await bystander.client.auth.admin.deleteUser(
        bystander.userId,
      );
      expect(error).not.toBeNull();
      const other =
        await bystander.client.auth.admin.deleteUser(reRegisteredUserId);
      expect(other.error).not.toBeNull();
      expect(authUserExists(bystander.userId)).toBe(true);
      expect(authUserExists(reRegisteredUserId)).toBe(true);
    });

    it("TC-SEC-28: 未ログイン（anon）のクライアントから Admin API を実行しても、アカウントを削除できない", async () => {
      const anon = newAnonClient();
      const { error } = await anon.auth.admin.deleteUser(bystander.userId);
      expect(error).not.toBeNull();
      expect(authUserExists(bystander.userId)).toBe(true);
    });

    it("存在しないユーザーIDを指定しても、例外を投げず、エラーを返す", async () => {
      const result = await deleteUserAsAdmin(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(result.error).not.toBeNull();
    });
  },
);
