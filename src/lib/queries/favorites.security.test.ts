import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";
import {
  deleteTestUsersByEmailLike,
  isLocalSupabaseAvailable,
  newAnonClient,
  queryPsql,
  runPsql,
  signUpTestUser,
} from "@/lib/test/local-supabase";

/**
 * お気に入り機能のDB基盤（store_favorites・RLS・get_own_favorites()・登録制限トリガー）の検証。
 * 対応TC: TC-FAV-04/05/08, TC-SEC-15〜23, TC-DB-05（回帰確認）
 * 対応仕様: 要件仕様書 Ver2 09_DB設計 8〜10、18_環境変数・セキュリティ ES38〜ES47
 *
 * ローカルSupabase（`supabase start`で起動したこのプロジェクト専用インスタンス）に
 * 対してのみ実行する。本番Supabaseの接続情報は一切参照せず、service_role / Secret key も使用しない。
 * ローカルSupabase・Dockerが利用できない環境（CI等）では自動的にスキップする。
 *
 * 【他のテストファイルとの独立性】
 * Vitestは複数のテストファイルを並列に実行する。notes.security.test.ts は store_id 昇順の
 * 先頭3件の公開店舗の is_published を一時的に変更するため、このファイルは store_id 降順の
 * 先頭2件（シードの5店舗のうち残り2件）だけを使い、店舗の取り合いを避ける。
 *
 * 【テストの順序について】
 * 「公開状態」→「非公開化後」の順に状態を進めるため、it は上から順に実行される前提で書いている。
 *
 * 型定義（database.types.ts）にはまだ store_favorites / get_own_favorites が無いため
 * （`npm run db:types` による再生成は別工程）、このファイルでは型なしのクライアントを使う。
 * 再生成後は asLoose() を外して型付きのクライアントに戻せる。
 */

const asLoose = (client: SupabaseClient<Database>) =>
  client as unknown as SupabaseClient;

type FavoriteStoreRow = {
  store_id: number;
  store_name: string;
  is_published: boolean;
  created_at: string;
};

const TF001_MESSAGE = "store is not available for favorites";
const NON_EXISTENT_STORE_ID = 999_999_999;

const localAvailable = await isLocalSupabaseAvailable();

function countFavorites(userId: string, storeId?: number): number {
  const storeCondition =
    storeId === undefined ? "" : ` and store_id = ${storeId}`;
  return Number(
    queryPsql(
      `select count(*) from public.store_favorites where user_id = '${userId}'${storeCondition};`,
    ),
  );
}

describe.skipIf(!localAvailable)(
  "お気に入り: store_favorites のDB基盤（ローカルSupabase専用）",
  () => {
    const RUN_ID = Date.now();
    const emailLike = `vitest-fav-sec-${RUN_ID}-%@example.com`;

    let userAId: string;
    let userBId: string;
    let clientA: SupabaseClient<Database>;
    let clientB: SupabaseClient<Database>;
    let storeX: number; // 常に公開のまま。A・B の両方がお気に入り登録する店舗
    let storeY: number; // 途中で非公開化する店舗。B がお気に入り登録する（A は登録しない）

    beforeAll(async () => {
      const total = Number(queryPsql("select count(*) from public.stores;"));
      const ids = queryPsql(
        "select store_id from public.stores order by store_id desc limit 2;",
      )
        .split("\n")
        .map(Number);
      if (total < 5 || ids.length < 2) {
        throw new Error(
          "テスト前提: 店舗が5件以上必要です。ローカルSupabaseのシードデータを確認してください。",
        );
      }
      [storeX, storeY] = ids;
      // 前回の異常終了で非公開のまま残っていても、公開状態から始める
      runPsql(
        `update public.stores set is_published = true where store_id in (${storeX}, ${storeY});`,
      );

      ({ client: clientA, userId: userAId } = await signUpTestUser(
        `vitest-fav-sec-${RUN_ID}-a@example.com`,
      ));
      ({ client: clientB, userId: userBId } = await signUpTestUser(
        `vitest-fav-sec-${RUN_ID}-b@example.com`,
      ));

      for (const [client, userId] of [
        [clientA, userAId],
        [clientB, userBId],
      ] as const) {
        const { error } = await asLoose(client)
          .from("store_favorites")
          .insert({ user_id: userId, store_id: storeX });
        if (error) {
          throw new Error(`お気に入りの初期登録に失敗: ${error.message}`);
        }
      }
    });

    afterAll(() => {
      // テストで一時変更したis_published・作成したユーザー（お気に入りはcascadeで削除）を必ず元に戻す
      if (storeX !== undefined && storeY !== undefined) {
        runPsql(
          `update public.stores set is_published = true where store_id in (${storeX}, ${storeY});`,
        );
      }
      deleteTestUsersByEmailLike(emailLike);
    });

    describe("公開状態（A={X}, B={X}、X・Yとも公開）", () => {
      it("TC-SEC-15: 本人のお気に入りだけを取得できる", async () => {
        const { data, error } = await asLoose(clientA)
          .from("store_favorites")
          .select("user_id, store_id");
        expect(error).toBeNull();
        expect(data).toEqual([{ user_id: userAId, store_id: storeX }]);
      });

      it("TC-SEC-16: 他人のお気に入りは（user_idを指定しても）取得できない", async () => {
        const { data, error } = await asLoose(clientA)
          .from("store_favorites")
          .select("user_id, store_id")
          .eq("user_id", userBId);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("TC-SEC-17: 他人のお気に入りは削除できず、行が残る", async () => {
        const { data, error } = await asLoose(clientA)
          .from("store_favorites")
          .delete()
          .eq("user_id", userBId)
          .select();
        expect(error).toBeNull();
        expect(data).toEqual([]);
        expect(countFavorites(userBId, storeX)).toBe(1);
      });

      it("TC-SEC-19: 他人のuser_idを指定して登録できない（RLS: 42501）", async () => {
        const { error } = await asLoose(clientA)
          .from("store_favorites")
          .insert({ user_id: userBId, store_id: storeY });
        expect(error?.code).toBe("42501");
        expect(countFavorites(userBId, storeY)).toBe(0);
      });

      it("TC-SEC-18: anon は SELECT / INSERT / DELETE のいずれもできない（42501）", async () => {
        const anon = asLoose(newAnonClient());
        const selectResult = await anon.from("store_favorites").select("*");
        expect(selectResult.error?.code).toBe("42501");
        const insertResult = await anon
          .from("store_favorites")
          .insert({ user_id: userAId, store_id: storeY });
        expect(insertResult.error?.code).toBe("42501");
        const deleteResult = await anon
          .from("store_favorites")
          .delete()
          .eq("user_id", userAId);
        expect(deleteResult.error?.code).toBe("42501");
        expect(countFavorites(userAId, storeX)).toBe(1);
      });

      it("TC-SEC-18（補足）: authenticated は UPDATE できない（42501）", async () => {
        const { error } = await asLoose(clientA)
          .from("store_favorites")
          .update({ store_id: storeY })
          .eq("user_id", userAId);
        expect(error?.code).toBe("42501");
        expect(countFavorites(userAId, storeX)).toBe(1);
      });

      it("TC-FAV-04: 同じ店舗の二重登録は一意制約で拒否される（23505）", async () => {
        const { error } = await asLoose(clientA)
          .from("store_favorites")
          .insert({ user_id: userAId, store_id: storeX });
        expect(error?.code).toBe("23505");
        expect(countFavorites(userAId, storeX)).toBe(1);
      });

      it("TC-SEC-20: get_own_favorites() は本人のお気に入りの店舗を、最小限の列だけで返す", async () => {
        const { data, error } = await asLoose(clientA).rpc("get_own_favorites");
        expect(error).toBeNull();
        const rows = data as FavoriteStoreRow[];
        expect(rows).toHaveLength(1);
        expect(Object.keys(rows[0]).sort()).toEqual([
          "created_at",
          "is_published",
          "store_id",
          "store_name",
        ]);
        expect(rows[0].store_id).toBe(storeX);
        expect(rows[0].is_published).toBe(true);
        expect(rows[0].store_name.length).toBeGreaterThan(0);
      });

      it("TC-SEC-23: anon は get_own_favorites() を実行できない（42501）", async () => {
        const { data, error } =
          await asLoose(newAnonClient()).rpc("get_own_favorites");
        expect(data).toBeNull();
        expect(error?.code).toBe("42501");
      });

      it("TC-FAV-02（DB側）: 公開店舗を本人が新規登録できる", async () => {
        // 後段の「非公開化後」の前提（B={X,Y}）を作る。Y は今は公開中
        const { error } = await asLoose(clientB)
          .from("store_favorites")
          .insert({ user_id: userBId, store_id: storeY });
        expect(error).toBeNull();
        expect(countFavorites(userBId)).toBe(2);
      });
    });

    describe("非公開化後（Y を非公開にする。A={X}, B={X,Y}）", () => {
      beforeAll(() => {
        runPsql(
          `update public.stores set is_published = false where store_id = ${storeY};`,
        );
      });

      it("TC-FAV-05: 非公開店舗の新規登録は TF001 で拒否される", async () => {
        const { error } = await asLoose(clientA)
          .from("store_favorites")
          .insert({ user_id: userAId, store_id: storeY });
        expect(error?.code).toBe("TF001");
        expect(error?.message).toBe(TF001_MESSAGE);
        expect(countFavorites(userAId, storeY)).toBe(0);
      });

      it("TC-FAV-05: 存在しない店舗の新規登録も TF001 で拒否される（非公開と区別しない）", async () => {
        const { error } = await asLoose(clientA)
          .from("store_favorites")
          .insert({ user_id: userAId, store_id: NON_EXISTENT_STORE_ID });
        expect(error?.code).toBe("TF001");
        expect(error?.message).toBe(TF001_MESSAGE);
      });

      it("TC-FAV-08: 登録後に店舗が非公開になっても、お気に入り行は残る", async () => {
        expect(countFavorites(userBId, storeY)).toBe(1);
        const { data, error } = await asLoose(clientB)
          .from("store_favorites")
          .select("store_id")
          .eq("store_id", storeY);
        expect(error).toBeNull();
        expect(data).toEqual([{ store_id: storeY }]);
      });

      it("TC-SEC-21: get_own_favorites() は公開・非公開の両方を返す（新しい順）", async () => {
        const { data, error } = await asLoose(clientB).rpc("get_own_favorites");
        expect(error).toBeNull();
        const rows = data as FavoriteStoreRow[];
        expect(rows.map((r) => [r.store_id, r.is_published])).toEqual([
          [storeY, false], // 後から登録したY（非公開）が先
          [storeX, true],
        ]);
        expect(rows[0].store_name.length).toBeGreaterThan(0);
      });

      it("TC-SEC-22: 他人のお気に入りの非公開店舗名は取得できない", async () => {
        const { data, error } = await asLoose(clientA).rpc("get_own_favorites");
        expect(error).toBeNull();
        const rows = data as FavoriteStoreRow[];
        expect(rows.map((r) => r.store_id)).toEqual([storeX]);
      });

      it("TC-DB-05（回帰）: anon は非公開店舗を直接取得できない", async () => {
        const { data, error } = await newAnonClient()
          .from("stores")
          .select("store_id")
          .in("store_id", [storeX, storeY]);
        expect(error).toBeNull();
        expect(data).toEqual([{ store_id: storeX }]);
      });

      it("TC-SEC-17（補足）: 非公開になった自分のお気に入りは解除できる", async () => {
        const { data, error } = await asLoose(clientB)
          .from("store_favorites")
          .delete()
          .eq("user_id", userBId)
          .eq("store_id", storeY)
          .select("store_id");
        expect(error).toBeNull();
        expect(data).toEqual([{ store_id: storeY }]);
        expect(countFavorites(userBId, storeY)).toBe(0);

        const { data: rpcData } =
          await asLoose(clientB).rpc("get_own_favorites");
        expect((rpcData as FavoriteStoreRow[]).map((r) => r.store_id)).toEqual([
          storeX,
        ]);
      });
    });

    describe("TC-DB-05（回帰確認）: 既存の stores / store_visit_notes のRLS・GRANTに影響がない", () => {
      const grantsOf = (table: string) =>
        queryPsql(
          `select grantee || ':' || string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = '${table}' and grantee in ('anon', 'authenticated') group by grantee order by grantee;`,
        );
      const policiesOf = (table: string) =>
        queryPsql(
          `select policyname || ':' || cmd || ':' || roles::text from pg_policies where schemaname = 'public' and tablename = '${table}' order by policyname;`,
        );

      it("stores: anon の SELECT のみ、公開店舗だけを返すポリシー1つ、RLS有効", () => {
        expect(grantsOf("stores")).toBe("anon:SELECT");
        expect(policiesOf("stores")).toBe(
          "stores_select_published:SELECT:{anon}",
        );
        expect(
          queryPsql(
            "select relrowsecurity from pg_class where oid = 'public.stores'::regclass;",
          ),
        ).toBe("t");
      });

      it("store_visit_notes: authenticated の SELECT/INSERT/UPDATE/DELETE のみ、本人用ポリシー4つ、RLS有効", () => {
        expect(grantsOf("store_visit_notes")).toBe(
          "authenticated:DELETE,INSERT,SELECT,UPDATE",
        );
        expect(policiesOf("store_visit_notes")).toBe(
          [
            "store_visit_notes_delete_own:DELETE:{authenticated}",
            "store_visit_notes_insert_own:INSERT:{authenticated}",
            "store_visit_notes_select_own:SELECT:{authenticated}",
            "store_visit_notes_update_own:UPDATE:{authenticated}",
          ].join("\n"),
        );
        expect(
          queryPsql(
            "select relrowsecurity from pg_class where oid = 'public.store_visit_notes'::regclass;",
          ),
        ).toBe("t");
      });

      it("get_own_note_store_names の EXECUTE は authenticated のみ", () => {
        expect(
          queryPsql(
            "select has_function_privilege('authenticated', 'public.get_own_note_store_names(bigint[])', 'EXECUTE'), has_function_privilege('anon', 'public.get_own_note_store_names(bigint[])', 'EXECUTE');",
          ),
        ).toBe("t|f");
      });

      it("store_favorites: authenticated は SELECT/INSERT/DELETE のみ（UPDATE なし）、anon は権限なし、ポリシーは3つ", () => {
        expect(grantsOf("store_favorites")).toBe(
          "authenticated:DELETE,INSERT,SELECT",
        );
        expect(policiesOf("store_favorites")).toBe(
          [
            "store_favorites_delete_own:DELETE:{authenticated}",
            "store_favorites_insert_own:INSERT:{authenticated}",
            "store_favorites_select_own:SELECT:{authenticated}",
          ].join("\n"),
        );
      });

      it("TC-SEC-23（補足）: get_own_favorites() と登録制限トリガー関数の EXECUTE 権限", () => {
        expect(
          queryPsql(
            "select has_function_privilege('authenticated', 'public.get_own_favorites()', 'EXECUTE'), has_function_privilege('anon', 'public.get_own_favorites()', 'EXECUTE');",
          ),
        ).toBe("t|f");
        expect(
          queryPsql(
            "select has_function_privilege('authenticated', 'public.check_store_favorites_store_published()', 'EXECUTE'), has_function_privilege('anon', 'public.check_store_favorites_store_published()', 'EXECUTE');",
          ),
        ).toBe("f|f");
      });
    });
  },
);
