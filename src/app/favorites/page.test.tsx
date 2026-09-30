import { isValidElement, type ReactNode } from "react";
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
    await expect(FavoritesPage()).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/favorites",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=/favorites");
    expect(mocks.fetchOwnFavorites).not.toHaveBeenCalled();
  });

  it("ログイン済み → fetchOwnFavorites を1回だけ呼び、見出しは『お気に入り』の共通レイアウトで表示する", async () => {
    const tree = await FavoritesPage();
    expect(mocks.fetchOwnFavorites).toHaveBeenCalledTimes(1);
    expect(mocks.fetchOwnFavorites).toHaveBeenCalledWith(supabaseClient);
    const layouts = findElements(tree, ListPageLayout);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].props.title).toBe("お気に入り");
  });

  it("取得失敗 → 既存（U06）と同じ取得失敗の文言を role=alert で表示し、一覧は出さない", async () => {
    mocks.fetchOwnFavorites.mockResolvedValue({ status: "error" });
    const tree = await FavoritesPage();
    expect(
      hasElementWith(
        tree,
        (e) =>
          e.props.role === "alert" &&
          textOf(e.props.children) ===
            "情報を取得できませんでした。もう一度お試しください",
      ),
    ).toBe(true);
    expect(findElements(tree, FavoriteItem)).toHaveLength(0);
    expect(hasElementWith(tree, (e) => e.type === "ul")).toBe(false);
  });

  it("0件 → 『まだお気に入りの店舗がありません』を表示する", async () => {
    const tree = await FavoritesPage();
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
    const tree = await FavoritesPage();
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
    const tree = await FavoritesPage();
    const [item] = findElements(tree, FavoriteItem);
    expect(Object.keys(item.props).sort()).toEqual([
      "isPublished",
      "storeId",
      "storeName",
    ]);
  });
});
