import { afterEach, describe, expect, it, vi } from "vitest";
import * as protectedUsers from "./protected-users";
import { isProtectedUserId } from "./protected-users";

// 実在しないダミーのUUID形式の値（実際のデモユーザーのIDではない）
const PROTECTED_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROTECTED_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isProtectedUserId（保護対象ユーザーの判定）", () => {
  it("環境変数が未設定 → 保護対象なし", () => {
    vi.stubEnv("PROTECTED_USER_IDS", undefined);
    expect(isProtectedUserId(PROTECTED_A)).toBe(false);
    expect(isProtectedUserId(OTHER)).toBe(false);
  });

  it("環境変数が空・空白だけ → 保護対象なし（空のIDも保護対象にならない）", () => {
    for (const value of ["", " ", "   ", ",", " , ,  "]) {
      vi.stubEnv("PROTECTED_USER_IDS", value);
      expect(isProtectedUserId(PROTECTED_A)).toBe(false);
      expect(isProtectedUserId("")).toBe(false);
    }
  });

  it("1件設定 → 完全一致するIDだけが保護対象。部分一致・大文字小文字だけが異なるID・別のIDは保護対象にならない（比較は、大文字小文字の正規化は行わず、trim後の文字列をuser IDと完全一致で行う）", () => {
    vi.stubEnv("PROTECTED_USER_IDS", PROTECTED_A);
    expect(isProtectedUserId(PROTECTED_A)).toBe(true);
    // 部分一致（前方・後方・一部）は保護対象にならない
    expect(isProtectedUserId(PROTECTED_A.slice(0, -1))).toBe(false);
    expect(isProtectedUserId(PROTECTED_A.slice(1))).toBe(false);
    expect(isProtectedUserId(`${PROTECTED_A}x`)).toBe(false);
    expect(isProtectedUserId("aaaaaaaa")).toBe(false);
    // 大文字小文字は正規化しない（大文字小文字だけが異なるIDは別のID）
    expect(isProtectedUserId(PROTECTED_A.toUpperCase())).toBe(false);
    // 渡されたユーザーIDは trim しない（前後に空白が付いたIDは別のID）
    expect(isProtectedUserId(` ${PROTECTED_A}`)).toBe(false);
    expect(isProtectedUserId(OTHER)).toBe(false);

    // 設定値が大文字の場合も同じ（設定値と認証済みuser IDをそのまま比較する）
    vi.stubEnv("PROTECTED_USER_IDS", PROTECTED_A.toUpperCase());
    expect(isProtectedUserId(PROTECTED_A.toUpperCase())).toBe(true);
    expect(isProtectedUserId(PROTECTED_A)).toBe(false);
  });

  it("カンマ区切りの複数件 → いずれのIDも保護対象になる。前後の空白と空の要素は無視する（比較は、大文字小文字の正規化は行わず、trim後の文字列をuser IDと完全一致で行う）", () => {
    vi.stubEnv("PROTECTED_USER_IDS", `  ${PROTECTED_A} ,, ${PROTECTED_B}  ,`);
    expect(isProtectedUserId(PROTECTED_A)).toBe(true);
    expect(isProtectedUserId(PROTECTED_B)).toBe(true);
    expect(isProtectedUserId(OTHER)).toBe(false);
    // 空の要素があっても、空のIDは保護対象にならない
    expect(isProtectedUserId("")).toBe(false);
  });

  it("保護対象かどうかの判定結果（真偽値）だけを返し、設定されたIDの一覧を返さない", () => {
    vi.stubEnv("PROTECTED_USER_IDS", `${PROTECTED_A},${PROTECTED_B}`);
    expect(typeof isProtectedUserId(PROTECTED_A)).toBe("boolean");
    expect(typeof isProtectedUserId(OTHER)).toBe("boolean");
    // 公開しているのは判定関数だけ（IDの一覧を返す関数・値を公開しない）
    expect(Object.keys(protectedUsers)).toEqual(["isProtectedUserId"]);

    // 呼び出しのたびに環境変数を読み込む（IDの一覧をモジュール内に保持しない）
    vi.stubEnv("PROTECTED_USER_IDS", PROTECTED_B);
    expect(isProtectedUserId(PROTECTED_A)).toBe(false);
    expect(isProtectedUserId(PROTECTED_B)).toBe(true);
  });
});
