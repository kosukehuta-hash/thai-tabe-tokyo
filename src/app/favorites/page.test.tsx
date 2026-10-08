import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  fetchOwnFavorites: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
// ListPageLayout → AuthStatus が読み込むブラウザ用クライアント・ログアウトのServer Actionは
// 読み込み時に環境変数を要求する。ここでは要素の木を検査するだけで描画しないため、モックに差し替える
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/app/logout/actions", () => ({ logout: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));
vi.mock("@/lib/queries/favorites", () => ({
  fetchOwnFavorites: mocks.fetchOwnFavorites,
}));
vi.mock("./actions", () => ({ removeFavorite: vi.fn() }));

import FavoritesPage from "./page";
import { FavoriteItem } from "./FavoriteItem";
import { ListPageLayout } from "@/components/ListPageLayout";
import { ListFetchError } from "@/components/ListFetchError";

type Element = {
  type: unknown;
  props: { children?: ReactNode; [key: string]: unknown };
};

// FavoritesPage は非同期のServer Componentで、子コンポーネントは実行せずに
// 要素の木（React要素）を返す。その木の中から要素やテキストを探す。
function findElements(node: ReactNode, type: unknown): Element[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findElements(child, type));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return [];
  }
  const self = node.type === type ? [node as unknown as Element] : [];
  return [...self, ...findElements(node.props.children, type)];
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

function hasElementWith(node: ReactNode, predicate: (e: Element) => boolean) {
  const all: Element[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) {
      n.forEach(walk);
    } else if (isValidElement<{ children?: ReactNode }>(n)) {
      all.push(n as unknown as Element);
      walk(n.props.children);
    }
  };
  walk(node);
  return all.some(predicate);
}

const supabaseClient = { auth: {} };

// ページに渡される props（URLのクエリは searchParams で受け取る）
function props(
  searchParams: Record<string, string | string[] | undefined> = {},
): Parameters<typeof FavoritesPage>[0] {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as unknown as Parameters<typeof FavoritesPage>[0];
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue(supabaseClient);
  mocks.getAuthenticatedUserId.mockResolvedValue("user-1");
  // Next.js の redirect() と同じく、呼び出したらそれ以降の処理を続けない（例外で中断する）
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  mocks.fetchOwnFavorites.mockResolvedValue({
    status: "success",
    favorites: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("U07 お気に入り画面（/favorites）", () => {
  it("未ログイン → /login?next=/favorites へ移動し、お気に入りは取得しない", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    await expect(FavoritesPage(props())).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/favorites",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=/favorites");
    expect(mocks.fetchOwnFavorites).not.toHaveBeenCalled();
  });

  it("未ログイン＋戻り先あり → ログイン後にこの一覧へ戻れるよう、戻り先も引き継いで移動する", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const expected = `/login?next=${encodeURIComponent(
      "/favorites?returnTo=%2Fstore%2F1%3Farea_id%3D1",
    )}`;
    await expect(
      FavoritesPage(props({ returnTo: "/store/1?area_id=1" })),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
    expect(mocks.fetchOwnFavorites).not.toHaveBeenCalled();
  });

  it("ログイン済み → fetchOwnFavorites を1回だけ呼び、見出しは『お気に入り』の共通レイアウトで表示する", async () => {
    const tree = await FavoritesPage(props());
    expect(mocks.fetchOwnFavorites).toHaveBeenCalledTimes(1);
    expect(mocks.fetchOwnFavorites).toHaveBeenCalledWith(supabaseClient);
    const layouts = findElements(tree, ListPageLayout);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].props.title).toBe("お気に入り");
  });

  it("ボタンの文言は『お気に入りを閉じる』（『← 戻る』ではない）", async () => {
    const tree = await FavoritesPage(props());
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.closeLabel).toBe("お気に入りを閉じる");
  });

  it.each([
    ["returnTo がない", {}, "/"],
    [
      "U02（検索条件付き）",
      { returnTo: "/search?area_id=1&time=lunch" },
      "/search?area_id=1&time=lunch",
    ],
    [
      "U03（クエリ付き）",
      { returnTo: "/store/123?area_id=1&time=lunch" },
      "/store/123?area_id=1&time=lunch",
    ],
    ["U01", { returnTo: "/" }, "/"],
    ["外部URL", { returnTo: "https://example.com" }, "/"],
    ["プロトコル相対URL", { returnTo: "//example.com" }, "/"],
    ["メモ一覧自身", { returnTo: "/notes" }, "/"],
    ["不正な店舗ID", { returnTo: "/store/abc" }, "/"],
    ["複数指定は先頭を使う", { returnTo: ["/search", "/store/1"] }, "/search"],
  ])("閉じる先（%s）→ %s", async (_label, query, expected) => {
    const tree = await FavoritesPage(props(query));
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.returnTo).toBe(expected);
  });

  it("取得失敗 → 既存（U06）と同じ取得失敗の表示（ListFetchError）を出し、文言を role=alert で表示し、一覧は出さない", async () => {
    mocks.fetchOwnFavorites.mockResolvedValue({ status: "error" });
    const tree = await FavoritesPage(props());
    const errors = findElements(tree, ListFetchError);
    expect(errors).toHaveLength(1);
    // 文言と role=alert は、共通部品が描画する（実際に描画して確認する）
    const html = renderToStaticMarkup(errors[0] as unknown as ReactElement);
    expect(html).toMatch(
      /<p[^>]*role="alert"[^>]*>情報を取得できませんでした。もう一度お試しください<\/p>/,
    );
    expect(findElements(tree, FavoriteItem)).toHaveLength(0);
    expect(hasElementWith(tree, (e) => e.type === "ul")).toBe(false);
  });

  it("0件 → 『まだお気に入りの店舗がありません』を表示する", async () => {
    const tree = await FavoritesPage(props());
    expect(textOf(tree as ReactNode)).toContain(
      "まだお気に入りの店舗がありません",
    );
    expect(findElements(tree, FavoriteItem)).toHaveLength(0);
    expect(hasElementWith(tree, (e) => e.type === "ul")).toBe(false);
  });

  it("一覧 → DBの返却順のまま（再ソートしない）、公開・非公開の両方を表示する", async () => {
    // わざと store_id・created_at が昇順でない並びで返し、そのままの順で表示されることを確認する
    mocks.fetchOwnFavorites.mockResolvedValue({
      status: "success",
      favorites: [
        {
          store_id: 9,
          store_name: "新しい店",
          is_published: true,
          created_at: "2026-09-30T10:00:00Z",
        },
        {
          store_id: 2,
          store_name: "閉じた店",
          is_published: false,
          created_at: "2026-09-29T10:00:00Z",
        },
        {
          store_id: 7,
          store_name: "古い店",
          is_published: true,
          created_at: "2026-09-01T10:00:00Z",
        },
      ],
    });
    const tree = await FavoritesPage(props());
    const items = findElements(tree, FavoriteItem);
    expect(items.map((i) => i.props.storeId)).toEqual([9, 2, 7]);
    expect(items.map((i) => i.props.isPublished)).toEqual([true, false, true]);
    expect(items.map((i) => i.props.storeName)).toEqual([
      "新しい店",
      "閉じた店",
      "古い店",
    ]);
  });

  it("各カードに渡すのは店舗ID・店舗名・公開状態だけ（登録日時や画像などは渡さない）", async () => {
    mocks.fetchOwnFavorites.mockResolvedValue({
      status: "success",
      favorites: [
        {
          store_id: 9,
          store_name: "店",
          is_published: true,
          created_at: "2026-09-30T10:00:00Z",
        },
      ],
    });
    const tree = await FavoritesPage(props());
    const [item] = findElements(tree, FavoriteItem);
    expect(Object.keys(item.props).sort()).toEqual([
      "isPublished",
      "storeId",
      "storeName",
    ]);
  });
});

function links(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[1].replace(/&amp;/g, "&"), m[2]],
  );
}

// 取得失敗の表示（ListFetchError）を実際に描画したHTML
function markupOf(tree: ReactNode): string {
  const [error] = findElements(tree, ListFetchError);
  return renderToStaticMarkup(error as unknown as ReactElement);
}

describe("U07 お気に入り画面（/favorites）の取得失敗と再試行", () => {
  beforeEach(() => {
    mocks.fetchOwnFavorites.mockResolvedValue({ status: "error" });
  });

  it("取得失敗 → 取得失敗の文言と『再試行』リンクを表示し、一覧・0件の表示は出さない", async () => {
    const tree = await FavoritesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(1);
    expect(findElements(tree, FavoriteItem)).toHaveLength(0);
    const html = markupOf(tree);
    expect(html).toContain('role="alert"');
    expect(html).toContain(
      "情報を取得できませんでした。もう一度お試しください",
    );
    expect(links(html)).toEqual([["/favorites", "再試行"]]);
    expect(findElements(tree, "ul")).toHaveLength(0);
    expect(JSON.stringify(tree)).not.toContain(
      "まだお気に入りの店舗がありません",
    );
  });

  it.each([
    ["returnTo がない", {}, "/favorites"],
    [
      "U02（検索条件付き）",
      { returnTo: "/search?area_id=1&time=lunch" },
      "/favorites?returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch",
    ],
    [
      "U03（クエリ付き）",
      { returnTo: "/store/123?area_id=1&time=lunch" },
      "/favorites?returnTo=%2Fstore%2F123%3Farea_id%3D1%26time%3Dlunch",
    ],
    ["外部URL（不正）", { returnTo: "https://example.com" }, "/favorites"],
    ["プロトコル相対URL（不正）", { returnTo: "//example.com" }, "/favorites"],
    ["一覧自身（不正）", { returnTo: "/notes" }, "/favorites"],
  ])("再試行先（%s）", async (_label, query, expected) => {
    const tree = await FavoritesPage(props(query));
    const [error] = findElements(tree, ListFetchError);
    expect(error.props.retryHref).toBe(expected);
    expect(links(markupOf(tree))[0]).toEqual([expected, "再試行"]);
  });

  it("取得失敗でも『閉じる』は従来どおり（文言・戻り先を変えない）", async () => {
    const tree = await FavoritesPage(props({ returnTo: "/search?area_id=1" }));
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.closeLabel).toBe("お気に入りを閉じる");
    expect(layout.props.returnTo).toBe("/search?area_id=1");
  });

  it("お気に入りあり（正常な一覧） → 一覧を表示し、『再試行』は出さない", async () => {
    mocks.fetchOwnFavorites.mockResolvedValue({
      status: "success",
      favorites: [
        {
          store_id: 9,
          store_name: "テスト食堂",
          is_published: true,
          created_at: "2026-09-30T10:00:00Z",
        },
      ],
    });
    const tree = await FavoritesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(0);
    expect(findElements(tree, FavoriteItem)).toHaveLength(1);
  });

  it("お気に入り0件 → 『まだお気に入りの店舗がありません』を表示し、『再試行』は出さない", async () => {
    mocks.fetchOwnFavorites.mockResolvedValue({
      status: "success",
      favorites: [],
    });
    const tree = await FavoritesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(0);
    expect(JSON.stringify(tree)).toContain("まだお気に入りの店舗がありません");
  });
});
