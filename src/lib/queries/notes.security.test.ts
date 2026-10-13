import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database.types";
import {
  deleteTestUsersByEmailLike,
  isLocalSupabaseAvailable,
  newAnonClient,
  runPsql,
  signUpTestUser,
} from "@/lib/test/local-supabase";
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

const localAvailable = await isLocalSupabaseAvailable();

describe.skipIf(!localAvailable)(
  "U06: get_own_note_store_names のセキュリティ確認（ローカルSupabase専用）",
  () => {
    const RUN_ID = Date.now();
    const userAEmail = `vitest-notes-sec-${RUN_ID}-a@example.com`;
    const userBEmail = `vitest-notes-sec-${RUN_ID}-b@example.com`;
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

      ({ client: clientA, userId: userAId } = await signUpTestUser(userAEmail));
      ({ client: clientB, userId: userBId } = await signUpTestUser(userBEmail));

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
      deleteTestUsersByEmailLike(`vitest-notes-sec-${RUN_ID}-%@example.com`);
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

describe.skipIf(!localAvailable)(
  "U06: get_own_notes のセキュリティ確認（ローカルSupabase専用）",
  () => {
    const RUN_ID = Date.now();
    const userCEmail = `vitest-own-notes-${RUN_ID}-c@example.com`;
    const userDEmail = `vitest-own-notes-${RUN_ID}-d@example.com`;
    const noteTextC1 = `vitest-own-notes-${RUN_ID} userCメモ1`;
    const noteTextC2 = `vitest-own-notes-${RUN_ID} userCメモ2`;
    const noteTextD = `vitest-own-notes-${RUN_ID} userDメモ`;

    let storeId1: number;
    let storeId2: number;
    let clientC: SupabaseClient<Database>;
    let clientD: SupabaseClient<Database>;

    beforeAll(async () => {
      const anon = newAnonClient();
      const { data: stores, error } = await anon
        .from("stores")
        .select("store_id")
        .eq("is_published", true)
        .order("store_id", { ascending: true })
        .limit(2);
      if (error || !stores || stores.length < 2) {
        throw new Error(
          "テスト前提: 公開店舗が2件以上必要です。ローカルSupabaseのシードデータを確認してください。",
        );
      }
      [storeId1, storeId2] = stores.map((s) => s.store_id);

      let userCId: string;
      let userDId: string;
      ({ client: clientC, userId: userCId } = await signUpTestUser(userCEmail));
      ({ client: clientD, userId: userDId } = await signUpTestUser(userDEmail));

      // Cは店舗1→店舗2の順に登録し、その後に店舗1のメモを更新する
      // （更新日時の新しい順は 店舗1 → 店舗2 になる）
      for (const [storeId, noteText] of [
        [storeId1, noteTextC1],
        [storeId2, noteTextC2],
      ] as const) {
        const { error: insertError } = await clientC
          .from("store_visit_notes")
          .insert({ store_id: storeId, note_text: noteText, user_id: userCId });
        if (insertError) {
          throw new Error(`メモC登録に失敗: ${insertError.message}`);
        }
      }
      const { error: insertDError } = await clientD
        .from("store_visit_notes")
        .insert({ store_id: storeId1, note_text: noteTextD, user_id: userDId });
      if (insertDError) {
        throw new Error(`メモD登録に失敗: ${insertDError.message}`);
      }
      const { error: updateError } = await clientC
        .from("store_visit_notes")
        .update({ note_text: noteTextC1 })
        .eq("store_id", storeId1);
      if (updateError) {
        throw new Error(`メモC更新に失敗: ${updateError.message}`);
      }
    });

    afterAll(() => {
      runPsql(
        `update public.stores set is_published = true where store_id in (${storeId1}, ${storeId2});`,
      );
      runPsql(
        `delete from public.store_visit_notes where note_text like 'vitest-own-notes-${RUN_ID}%';`,
      );
      deleteTestUsersByEmailLike(`vitest-own-notes-${RUN_ID}-%@example.com`);
    });

    it("get_own_notes: 本人のメモだけを、更新日時の新しい順に、店舗名・公開状態つきで返す", async () => {
      const { data, error } = await clientC.rpc("get_own_notes");
      expect(error).toBeNull();
      expect(data?.map((n) => n.note_text)).toEqual([noteTextC1, noteTextC2]);
      expect(data?.map((n) => n.store_id)).toEqual([storeId1, storeId2]);
      for (const note of data ?? []) {
        expect(note.store_name.length).toBeGreaterThan(0);
        expect(note.is_published).toBe(true);
      }
    });

    it("get_own_notes: 返す列は最小限の6列だけ（他人のuser_idなどを含まない）", async () => {
      const { data, error } = await clientC.rpc("get_own_notes");
      expect(error).toBeNull();
      expect(Object.keys(data?.[0] ?? {}).sort()).toEqual([
        "is_published",
        "note_id",
        "note_text",
        "store_id",
        "store_name",
        "updated_at",
      ]);
    });

    it("get_own_notes: 他ユーザーのメモは含まれない", async () => {
      const { data, error } = await clientD.rpc("get_own_notes");
      expect(error).toBeNull();
      expect(data?.map((n) => n.note_text)).toEqual([noteTextD]);
    });

    it("get_own_notes: 店舗が非公開になっても、本人のメモは店舗名とis_published=falseで返す", async () => {
      runPsql(
        `update public.stores set is_published = false where store_id = ${storeId2};`,
      );
      const { data, error } = await clientC.rpc("get_own_notes");
      expect(error).toBeNull();
      const note = data?.find((n) => n.store_id === storeId2);
      expect(note?.is_published).toBe(false);
      expect(note?.store_name.length).toBeGreaterThan(0);
    });

    it("get_own_notes: anonロールからは実行できない（42501）", async () => {
      const anon = newAnonClient();
      const { data, error } = await anon.rpc("get_own_notes");
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("fetchOwnNotesWithStores: get_own_notes 経由でも、本人のメモだけを新しい順に返す", async () => {
      const result = await fetchOwnNotesWithStores(clientC);
      expect(result.status).toBe("success");
      if (result.status !== "success") {
        return;
      }
      expect(result.notes.map((n) => n.noteText)).toEqual([
        noteTextC1,
        noteTextC2,
      ]);
    });
  },
);
