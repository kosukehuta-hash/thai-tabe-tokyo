import { describe, expect, it } from "vitest";
import {
  buildListHref,
  buildLoginHrefForList,
  resolveHeaderReturnTo,
  sanitizeReturnTo,
} from "./return-to";

describe("sanitizeReturnTo（許可する戻り先：/・/search・/store/{数字}）", () => {
  it.each([
    ["/", "/"],
    ["/search", "/search"],
    ["/search?area_id=1&time=lunch", "/search?area_id=1&time=lunch"],
    ["/store/1", "/store/1"],
    ["/store/123?area_id=1&time=lunch", "/store/123?area_id=1&time=lunch"],
  ])("%s は許可し、そのまま返す", (input, expected) => {
    expect(sanitizeReturnTo(input)).toBe(expected);
  });

  it("URLエンコード済みの検索条件（日本語・記号）も壊さず保持する", () => {
    expect(sanitizeReturnTo("/search?area_id=1&scene=solo&dish_id=2")).toBe(
      "/search?area_id=1&scene=solo&dish_id=2",
    );
    expect(sanitizeReturnTo("/search?q=%E3%82%AC%E3%83%91%E3%82%AA")).toBe(
      "/search?q=%E3%82%AC%E3%83%91%E3%82%AA",
    );
  });

  it.each([
    ["外部URL", "https://example.com/"],
    ["外部URL（http）", "http://example.com/store/1"],
    ["プロトコル相対URL", "//example.com"],
    ["プロトコル相対URL（許可パス風）", "//example.com/store/1"],
    ["バックスラッシュ始まり", "/\\example.com"],
    ["ドットセグメントで外部へ", "/..//example.com"],
    ["javascript:", "javascript:alert(1)"],
    ["スラッシュ始まりでない相対パス", "store/1"],
    ["制御文字を含む", "/store/1\n"],
  ])("%s は / に置き換える", (_label, input) => {
    expect(sanitizeReturnTo(input)).toBe("/");
  });

  it.each([
    ["メモ一覧（/notes）", "/notes"],
    ["お気に入り（/favorites）", "/favorites"],
    ["ログイン", "/login"],
    ["新規登録", "/signup"],
    ["許可外のパス", "/api/anything"],
    ["店舗IDが数字でない", "/store/abc"],
    ["店舗IDが空", "/store/"],
    ["店舗IDに記号が混じる", "/store/1abc"],
    ["店舗IDが負数", "/store/-1"],
    ["店舗の下の階層", "/store/1/edit"],
    ["末尾スラッシュ付きの検索", "/search/"],
  ])("%s は許可せず / に置き換える", (_label, input) => {
    expect(sanitizeReturnTo(input)).toBe("/");
  });

  it.each([[null], [undefined], [""]])(
    "値がない（%s）場合は / を返す",
    (input) => {
      expect(sanitizeReturnTo(input)).toBe("/");
    },
  );

  it("ハッシュ（#以降）は戻り先に含めない", () => {
    expect(sanitizeReturnTo("/store/1?area_id=1#memo")).toBe(
      "/store/1?area_id=1",
    );
  });
});

describe("buildListHref（メモ一覧・お気に入りへのリンク先）", () => {
  it("戻り先がU01（/）の場合は returnTo を付けない", () => {
    expect(buildListHref("/notes", "/")).toBe("/notes");
    expect(buildListHref("/favorites", "/")).toBe("/favorites");
  });

  it("戻り先をエンコードして returnTo に付ける（検索条件付きU02もそのまま保持）", () => {
    expect(buildListHref("/notes", "/search?area_id=1&time=lunch")).toBe(
      "/notes?returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch",
    );
    expect(buildListHref("/favorites", "/store/1?area_id=1")).toBe(
      "/favorites?returnTo=%2Fstore%2F1%3Farea_id%3D1",
    );
  });

  it("不正な戻り先は付けずに、一覧だけのリンクにする", () => {
    expect(buildListHref("/notes", "https://example.com")).toBe("/notes");
    expect(buildListHref("/favorites", "/notes")).toBe("/favorites");
  });
});

describe("buildLoginHrefForList（未ログイン時のログイン画面へのリンク先）", () => {
  it("戻り先がない場合は従来どおり /login?next=/notes・/login?next=/favorites", () => {
    expect(buildLoginHrefForList("/notes", "/")).toBe("/login?next=/notes");
    expect(buildLoginHrefForList("/favorites", "/")).toBe(
      "/login?next=/favorites",
    );
  });

  it("戻り先がある場合は、一覧のURLごとエンコードして引き継ぐ", () => {
    expect(buildLoginHrefForList("/notes", "/store/1?area_id=1")).toBe(
      `/login?next=${encodeURIComponent("/notes?returnTo=%2Fstore%2F1%3Farea_id%3D1")}`,
    );
  });
});

describe("resolveHeaderReturnTo（ヘッダーのリンクに付ける戻り先）", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("U01では / になる", () => {
    expect(resolveHeaderReturnTo("/", params(""))).toBe("/");
  });

  it("U02では検索条件付きのURLがそのまま戻り先になる", () => {
    expect(
      resolveHeaderReturnTo(
        "/search",
        params("area_id=1&time=lunch&scene=solo"),
      ),
    ).toBe("/search?area_id=1&time=lunch&scene=solo");
  });

  it("U03では店舗詳細のURL（クエリ付き）が戻り先になる", () => {
    expect(resolveHeaderReturnTo("/store/1", params(""))).toBe("/store/1");
    expect(
      resolveHeaderReturnTo("/store/123", params("area_id=1&time=lunch")),
    ).toBe("/store/123?area_id=1&time=lunch");
  });

  it("U06・U07では、自分自身ではなく受け取った戻り先を引き継ぐ", () => {
    expect(
      resolveHeaderReturnTo("/notes", params("returnTo=%2Fstore%2F1")),
    ).toBe("/store/1");
    expect(
      resolveHeaderReturnTo(
        "/favorites",
        params("returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch"),
      ),
    ).toBe("/search?area_id=1&time=lunch");
  });

  it("U06・U07で戻り先がない・不正な場合は / になる", () => {
    expect(resolveHeaderReturnTo("/notes", params(""))).toBe("/");
    expect(
      resolveHeaderReturnTo(
        "/favorites",
        params("returnTo=https%3A%2F%2Fevil.example"),
      ),
    ).toBe("/");
    expect(resolveHeaderReturnTo("/notes", params("returnTo=%2Fnotes"))).toBe(
      "/",
    );
  });

  it("U03 → お気に入り → メモ一覧 → お気に入り と移動しても、最初のU03が戻り先のまま", () => {
    // U03（検索結果から来た、検索条件付き）
    const u03 = resolveHeaderReturnTo(
      "/store/5",
      params("area_id=1&time=lunch"),
    );
    // U03 → お気に入り
    const favoritesHref = buildListHref("/favorites", u03);
    const favoritesQuery = new URL(favoritesHref, "http://x").searchParams;
    // お気に入り → メモ一覧
    const notesHref = buildListHref(
      "/notes",
      resolveHeaderReturnTo("/favorites", favoritesQuery),
    );
    const notesQuery = new URL(notesHref, "http://x").searchParams;
    // メモ一覧 → お気に入り
    const favoritesAgainHref = buildListHref(
      "/favorites",
      resolveHeaderReturnTo("/notes", notesQuery),
    );

    expect(favoritesAgainHref).toBe(favoritesHref);
    expect(
      resolveHeaderReturnTo(
        "/favorites",
        new URL(favoritesAgainHref, "http://x").searchParams,
      ),
    ).toBe("/store/5?area_id=1&time=lunch");
  });
});

describe("アカウント削除画面（U08）の戻り先", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("buildListHref：戻り先がU01なら付けず、U02・U03なら returnTo として付ける", () => {
    expect(buildListHref("/account/delete", "/")).toBe("/account/delete");
    expect(buildListHref("/account/delete", "/search?area_id=1")).toBe(
      "/account/delete?returnTo=%2Fsearch%3Farea_id%3D1",
    );
    expect(buildListHref("/account/delete", "/store/1?area_id=1")).toBe(
      "/account/delete?returnTo=%2Fstore%2F1%3Farea_id%3D1",
    );
  });

  it("buildListHref：不正な戻り先（外部URL・アカウント削除画面自身）は付けない", () => {
    expect(buildListHref("/account/delete", "https://example.com")).toBe(
      "/account/delete",
    );
    expect(buildListHref("/account/delete", "/account/delete")).toBe(
      "/account/delete",
    );
  });

  it("buildLoginHrefForList：戻り先がなければ /login?next=/account/delete、あれば戻り先ごと引き継ぐ", () => {
    expect(buildLoginHrefForList("/account/delete", "/")).toBe(
      "/login?next=/account/delete",
    );
    expect(buildLoginHrefForList("/account/delete", "/store/1?area_id=1")).toBe(
      `/login?next=${encodeURIComponent("/account/delete?returnTo=%2Fstore%2F1%3Farea_id%3D1")}`,
    );
  });

  it("resolveHeaderReturnTo：U08では自分自身ではなく、受け取った戻り先を引き継ぐ", () => {
    expect(
      resolveHeaderReturnTo(
        "/account/delete",
        params("returnTo=%2Fsearch%3Farea_id%3D1"),
      ),
    ).toBe("/search?area_id=1");
    expect(resolveHeaderReturnTo("/account/delete", params(""))).toBe("/");
    expect(
      resolveHeaderReturnTo(
        "/account/delete",
        params("returnTo=https%3A%2F%2Fexample.com"),
      ),
    ).toBe("/");
  });

  it("sanitizeReturnTo：アカウント削除画面そのものは戻り先として許可しない", () => {
    expect(sanitizeReturnTo("/account/delete")).toBe("/");
    expect(sanitizeReturnTo("/account/delete?returnTo=%2F")).toBe("/");
  });
});
