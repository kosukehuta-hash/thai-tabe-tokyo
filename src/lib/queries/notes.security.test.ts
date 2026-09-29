import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";
// "server-only" はvitest.config.tsのresolve.aliasでスタブに差し替えているため、
// このファイルをVitestから直接importできる。
import { fetchOwnNotesWithStores } from "./notes";

/**
 * U06「メモ一覧」の非公開店舗表示と get_own_note_store_names のセキュリティ検証。
 * 対応TC: TC-U06-03（データ取得部分のみ）, TC-SEC-10〜14, TC-DB-04（回帰確認）
 *
 * TC-U06-03は本来「画面表示」のTCであり、店舗名・「非公開」表示・メモ本文・更新日時・
 * 店舗詳細リンクなし・戻るボタン表示は、実ブラウザでの手動確認（2026/09/29
 * 伊波ゆかり）で別途確認済み。ここでは、その画面表示の元になる
 * fetchOwnNotesWithStores()のデータ取得結果（店舗名・isPublished・メモ本文・
 * 更新日時）だけを自動確認する。
 *
 * ローカルSupabase（`supabase start`で起動したこのプロジェクト専用インスタンス）に
 * 対してのみ実行する。本番Supabaseの接続情報（.env.local / NEXT_PUBLIC_SUPABASE_URL等）は
 * 一切参照しない。ローカルSupabase・Dockerが利用できない環境（CI等）では自動的にスキップする。
 *
 * is_publishedの変更にはauthenticated/anonロールへの権限がないため、
 * ローカルDBコンテナへdocker exec psqlで直接接続する（Secret/Service Role keyは使用しない）。
 * テストで作成・変更したユーザー・メモ・is_publishedは、afterAllで必ず元に戻す。
 */

const LOCAL_SUPABASE_URL =
  process.env.TEST_LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  process.env.TEST_LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_DB_CONTAINER =
  process.env.TEST_LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_thai-tabe-tokyo";

function newAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY);
}

function runPsql(sql: string): void {
  execFileSync(
    "docker",
    [
      "exec",
      LOCAL_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-c",
      sql,
    ],
    { stdio: "ignore", timeout: 10_000 },
  );
}

async function isLocalSupabaseAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      return false;
    }
    runPsql("select 1;");
    return true;
  } catch {
    return false;
  }
}

const localAvailable = await isLocalSupabaseAvailable();

describe.skipIf(!localAvailable)(
  "U06: get_own_note_store_names のセキュリティ確認（ローカルSupabase専用）",
  () => {
    const RUN_ID = Date.now();
    const userAEmail = `vitest-notes-sec-${RUN_ID}-a@example.com`;
    const userBEmail = `vitest-notes-sec-${RUN_ID}-b@example.com`;
    const password = "TestPassword123!";
    const noteTextA = `vitest-notes-sec-${RUN_ID} userAメモ`;
    const noteTextB = `vitest-notes-sec-${RUN_ID} userBメモ`;

    let userAId: string;
    let userBId: string;
    let storeIdA: number; // userAがメモを持ち、後段で非公開化する店舗
    let storeIdB: number; // userBがメモを持ち、後段で非公開化する店舗（他人の非公開店舗として使う）
    let storeIdNoNote: number; // 誰もメモを持たず、後段で非公開化する店舗
    let clientA: SupabaseClient<Database>;
    let clientB: SupabaseClient<Database>;

    beforeAll(async () => {
      const anon = newAnonClient();
      const { data: stores, error } = await anon
        .from("stores")
        .select("store_id")
        .eq("is_published", true)
        .order("store_id", { ascending: true })
        .limit(3);
      if (error || !stores || stores.length < 3) {
        throw new Error(
          "テスト前提: 公開店舗が3件以上必要です。ローカルSupabaseのシードデータを確認してください。",
        );
      }
      [storeIdA, storeIdB, storeIdNoNote] = stores.map((s) => s.store_id);

      clientA = newAnonClient();
      clientB = newAnonClient();

      const { data: signUpA, error: signUpAError } = await clientA.auth.signUp({
        email: userAEmail,
        password,
      });
      if (signUpAError || !signUpA.user) {
        throw new Error(`userA作成に失敗: ${signUpAError?.message}`);
      }
      userAId = signUpA.user.id;

      const { data: signUpB, error: signUpBError } = await clientB.auth.signUp({
        email: userBEmail,
        password,
      });
      if (signUpBError || !signUpB.user) {
        throw new Error(`userB作成に失敗: ${signUpBError?.message}`);
      }
      userBId = signUpB.user.id;

      const { error: insertAError } = await clientA
        .from("store_visit_notes")
        .insert({ store_id: storeIdA, note_text: noteTextA, user_id: userAId });
      if (insertAError) {
        throw new Error(`メモA登録に失敗: ${insertAError.message}`);
      }

      const { error: insertBError } = await clientB
        .from("store_visit_notes")
        .insert({ store_id: storeIdB, note_text: noteTextB, user_id: userBId });
      if (insertBError) {
        throw new Error(`メモB登録に失敗: ${insertBError.message}`);
      }
    });

    afterAll(() => {
      // テストで一時変更したis_published・作成したユーザー/メモを必ず元に戻す
      runPsql(
        `update public.stores set is_published = true where store_id in (${storeIdA}, ${storeIdB}, ${storeIdNoNote});`,
      );
      runPsql(
        `delete from public.store_visit_notes where note_text like 'vitest-notes-sec-${RUN_ID}%';`,
      );
      runPsql(
        `delete from auth.users where email like 'vitest-notes-sec-${RUN_ID}-%@example.com';`,
      );
    });

    it("TC-SEC-10: 本人＋公開店舗のメモは店舗名を取得できる", async () => {
      const { data, error } = await clientA.rpc("get_own_note_store_names", {
        p_store_ids: [storeIdA],
      });
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0].store_id).toBe(storeIdA);
      expect(data?.[0].is_published).toBe(true);
      expect(data?.[0].store_name.length).toBeGreaterThan(0);
    });

    describe("非公開化後", () => {
      beforeAll(() => {
        runPsql(
          `update public.stores set is_published = false where store_id in (${storeIdA}, ${storeIdB}, ${storeIdNoNote});`,
        );
      });

      it("TC-SEC-11: 本人＋非公開店舗のメモは店舗名を取得でき、is_published=falseになる", async () => {
        const { data, error } = await clientA.rpc("get_own_note_store_names", {
          p_store_ids: [storeIdA],
        });
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data?.[0].store_id).toBe(storeIdA);
        expect(data?.[0].is_published).toBe(false);
        expect(data?.[0].store_name.length).toBeGreaterThan(0);
      });

      it("TC-U06-03（データ取得部分）: fetchOwnNotesWithStoresが非公開店舗でも店舗名・isPublished・メモ本文・更新日時を返す", async () => {
        const result = await fetchOwnNotesWithStores(clientA);
        expect(result.status).toBe("success");
        if (result.status !== "success") {
          return;
        }
        const note = result.notes.find((n) => n.storeId === storeIdA);
        expect(note).toBeDefined();
        expect(note?.storeName.length).toBeGreaterThan(0);
        expect(note?.isPublished).toBe(false);
        expect(note?.noteText).toBe(noteTextA);
        expect(note?.updatedAt).toBeTruthy();
      });

      it("TC-SEC-12: 他ユーザーの非公開店舗IDを指定しても店舗名を取得できない", async () => {
        const { data, error } = await clientA.rpc("get_own_note_store_names", {
          p_store_ids: [storeIdB],
        });
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("TC-SEC-13: 本人がメモを持たない非公開店舗IDを指定しても店舗名を取得できない", async () => {
        const { data, error } = await clientA.rpc("get_own_note_store_names", {
          p_store_ids: [storeIdNoNote],
        });
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("TC-SEC-14: anonロールからget_own_note_store_namesを実行できない", async () => {
        const anon = newAnonClient();
        const { data, error } = await anon.rpc("get_own_note_store_names", {
          p_store_ids: [storeIdA],
        });
        expect(data).toBeNull();
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
      });

      it("TC-DB-04（回帰確認）: anon（U01/U02/U03相当）は非公開店舗を直接取得できない", async () => {
        const anon = newAnonClient();
        const { data, error } = await anon
          .from("stores")
          .select("store_id")
          .in("store_id", [storeIdA, storeIdB, storeIdNoNote]);
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });
    });
  },
);
