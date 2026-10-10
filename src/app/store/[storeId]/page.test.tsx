import { isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getClaims: vi.fn(),
  notFound: vi.fn(),
  fetchStore: vi.fn(),
  fetchExteriorPhoto: vi.fn(),
  fetchInteriorPhotos: vi.fn(),
  fetchMainDishes: vi.fn(),
  fetchMainDishPhotos: vi.fn(),
  fetchOwnNote: vi.fn(),
  fetchIsFavorite: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
// AuthStatus（ヘッダー）が読み込むブラウザ用クライアントは、読み込み時に環境変数を要求する。
// ここでは要素の木を検査するだけで描画しないため、モックに差し替える
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims: mocks.getClaims } })),
}));
vi.mock("@/lib/queries/store", () => ({
  fetchStore: mocks.fetchStore,
  fetchExteriorPhoto: mocks.fetchExteriorPhoto,
  fetchInteriorPhotos: mocks.fetchInteriorPhotos,
  fetchMainDishes: mocks.fetchMainDishes,
  fetchMainDishPhotos: mocks.fetchMainDishPhotos,
  fetchOwnNote: mocks.fetchOwnNote,
}));
vi.mock("@/lib/queries/favorites", () => ({
  fetchIsFavorite: mocks.fetchIsFavorite,
}));

import StorePage from "./page";
import BackToSearchLink from "./BackToSearchLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { StoreVisitNote } from "@/components/StoreVisitNote";
import { StoreErrorMessage } from "./StoreStatusMessages";

// StorePage は非同期のServer Componentで、子コンポーネントは実行せずに
// 要素の木（React要素）を返す。その木の中から、特定のコンポーネントを探す。
function findElements(node: ReactNode, type: unknown): unknown[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => findElements(child, type));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return [];
  }
  const self = node.type === type ? [node] : [];
  return [...self, ...findElements(node.props.children, type)];
}

const store = {
  store_id: 1,
  store_name: "テスト食堂",
  catch_copy: "キャッチ",
  scene_solo: true,
  scene_date: false,
  scene_friends: false,
  scene_family: false,
  spice_support_text: null,
  reservation_text: null,
  seat_type_text: null,
  atmosphere_text: "雰囲気",
  address: "住所",
  nearest_station_name: "駅",
  walk_minutes: 3,
  has_lunch: true,
  lunch_hours: "11:00-15:00",
  lunch_price_from: 1000,
  has_dinner: false,
  dinner_hours: null,
  dinner_price_from: null,
  regular_holiday: null,
  phone_number: null,
  map_url: "https://example.com/map",
  official_site_url: null,
  last_verified_on: "2026-09-01",
  is_published: true,
};

async function renderStorePage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return StorePage({
    params: Promise.resolve({ storeId: "1" }),
    searchParams: Promise.resolve(searchParams),
  } as unknown as Parameters<typeof StorePage>[0]);
}

beforeEach(() => {
  mocks.fetchStore.mockResolvedValue({ status: "found", store });
  mocks.fetchExteriorPhoto.mockResolvedValue({ status: "empty" });
  mocks.fetchInteriorPhotos.mockResolvedValue({
    status: "success",
    photos: [],
  });
  mocks.fetchMainDishes.mockResolvedValue({ status: "success", dishes: [] });
  mocks.fetchOwnNote.mockResolvedValue({ status: "success", noteText: null });
  mocks.fetchIsFavorite.mockResolvedValue({
    status: "success",
    isFavorite: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function loggedIn() {
  mocks.getClaims.mockResolvedValue({
    data: { claims: { sub: "user-1" } },
    error: null,
  });
}

describe("U03 お気に入りボタンの組み込み", () => {
  it("未ログイン → お気に入り状態は取得せず、ボタンもメモ欄も表示しない", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const tree = await renderStorePage();
    expect(mocks.fetchIsFavorite).not.toHaveBeenCalled();
    expect(findElements(tree, FavoriteButton)).toHaveLength(0);
    expect(findElements(tree, StoreVisitNote)).toHaveLength(0);
  });

  it("ログイン中・未登録 → 未登録状態のボタンを表示する", async () => {
    loggedIn();
    const tree = await renderStorePage();
    const buttons = findElements(tree, FavoriteButton) as {
      props: { storeId: number; initialIsFavorite: boolean };
    }[];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props).toEqual({ storeId: 1, initialIsFavorite: false });
  });

  it("ログイン中・登録済み → 登録済み状態のボタンを表示する", async () => {
    loggedIn();
    mocks.fetchIsFavorite.mockResolvedValue({
      status: "success",
      isFavorite: true,
    });
    const tree = await renderStorePage();
    const buttons = findElements(tree, FavoriteButton) as {
      props: { initialIsFavorite: boolean };
    }[];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.initialIsFavorite).toBe(true);
  });

  it("お気に入り状態の取得に失敗 → ページ全体を既存の取得失敗表示にする（ボタンだけ隠して続行しない）", async () => {
    loggedIn();
    mocks.fetchIsFavorite.mockResolvedValue({ status: "error" });
    const tree = await renderStorePage();
    expect(findElements(tree, StoreErrorMessage)).toHaveLength(1);
    expect(findElements(tree, FavoriteButton)).toHaveLength(0);
    expect(findElements(tree, StoreVisitNote)).toHaveLength(0);
  });

  it("メモ取得の失敗は従来どおりページ全体の取得失敗表示（回帰）", async () => {
    loggedIn();
    mocks.fetchOwnNote.mockResolvedValue({ status: "error" });
    const tree = await renderStorePage();
    expect(findElements(tree, StoreErrorMessage)).toHaveLength(1);
  });

  it("お気に入り状態の取得は、メモ取得の完了を待たずに並列で始まる", async () => {
    loggedIn();
    let releaseNote: (value: unknown) => void = () => {};
    mocks.fetchOwnNote.mockReturnValue(
      new Promise((resolve) => {
        releaseNote = resolve;
      }),
    );
    const pending = renderStorePage();
    // メモ取得が未完了のまま、お気に入り状態の取得が呼ばれていること
    await vi.waitFor(() => expect(mocks.fetchOwnNote).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(mocks.fetchIsFavorite).toHaveBeenCalledTimes(1),
    );
    releaseNote({ status: "success", noteText: null });
    const tree = await pending;
    expect(findElements(tree, FavoriteButton)).toHaveLength(1);
  });

  it("お気に入り状態の取得には、サーバー用クライアントと店舗IDを渡す（user_idは渡さない）", async () => {
    loggedIn();
    await renderStorePage();
    expect(mocks.fetchIsFavorite).toHaveBeenCalledTimes(1);
    const [client, storeId] = mocks.fetchIsFavorite.mock.calls[0];
    expect(client).toHaveProperty("auth");
    expect(storeId).toBe(1);
    expect(mocks.fetchIsFavorite.mock.calls[0]).toHaveLength(2);
  });
});

type BackLinkProps = {
  href: string;
  className: string;
  children: string;
  storeId?: number;
};

// ヘッダーと本文の2か所にある戻りリンク。検索結果へ戻る既存の部品（BackToSearchLink）と、
// 一覧へ戻る通常のリンク（next/link）を、それぞれ探す
function backLinks(tree: ReactNode) {
  return {
    search: findElements(tree, BackToSearchLink) as { props: BackLinkProps }[],
    list: findElements(tree, Link) as { props: BackLinkProps }[],
  };
}

describe("U03 戻りリンクの出し分け（検索結果・メモ一覧・お気に入り）", () => {
  beforeEach(() => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
  });

  it("from なし（直接アクセス）→ 従来どおり『← 検索結果に戻る』（/search）。ヘッダーと本文の2か所", async () => {
    const { search, list } = backLinks(await renderStorePage());
    expect(list).toHaveLength(0);
    expect(search).toHaveLength(2);
    for (const link of search) {
      expect(link.props.href).toBe("/search");
      expect(link.props.children).toBe("← 検索結果に戻る");
      expect(link.props.storeId).toBe(1);
    }
  });

  it("検索条件つき（検索結果から来た場合）→ 従来どおり、検索条件を保持した /search へのリンク", async () => {
    const { search, list } = backLinks(
      await renderStorePage({
        area_id: "1",
        time: "lunch",
        scene: "solo",
        dish_id: "3",
      }),
    );
    expect(list).toHaveLength(0);
    expect(search).toHaveLength(2);
    for (const link of search) {
      expect(link.props.href).toBe(
        "/search?area_id=1&time=lunch&scene=solo&dish_id=3",
      );
      expect(link.props.children).toBe("← 検索結果に戻る");
    }
  });

  it("from=notes → 『← メモ一覧に戻る』（/notes への通常のリンク）。ヘッダーと本文の2か所で、検索結果へ戻る部品は使わない", async () => {
    const { search, list } = backLinks(
      await renderStorePage({ from: "notes" }),
    );
    expect(search).toHaveLength(0);
    expect(list).toHaveLength(2);
    for (const link of list) {
      expect(link.props.href).toBe("/notes");
      expect(link.props.children).toBe("← メモ一覧に戻る");
    }
  });

  it("from=favorites → 『← お気に入りに戻る』（/favorites への通常のリンク）", async () => {
    const { search, list } = backLinks(
      await renderStorePage({ from: "favorites" }),
    );
    expect(search).toHaveLength(0);
    expect(list).toHaveLength(2);
    for (const link of list) {
      expect(link.props.href).toBe("/favorites");
      expect(link.props.children).toBe("← お気に入りに戻る");
    }
  });

  it("ヘッダーと本文のリンクは、それぞれ元の見た目（クラス）を保つ", async () => {
    const fromList = backLinks(await renderStorePage({ from: "notes" })).list;
    const fromSearch = backLinks(await renderStorePage()).search;
    expect(fromList.map((l) => l.props.className)).toEqual(
      fromSearch.map((l) => l.props.className),
    );
    expect(new Set(fromList.map((l) => l.props.className)).size).toBe(2);
  });

  it("from=notes でも、検索条件は戻り先に使わない（戻り先は固定の /notes）", async () => {
    const { list } = backLinks(
      await renderStorePage({ from: "notes", area_id: "1", time: "lunch" }),
    );
    expect(list.map((l) => l.props.href)).toEqual(["/notes", "/notes"]);
  });

  it.each([
    ["外部URL", "https://evil.example"],
    ["プロトコル相対URL", "//evil.example"],
    ["バックスラッシュ始まり", "/\\evil"],
    ["制御文字を含む", "notes\n"],
    ["パス形式（/notes）", "/notes"],
    ["パス形式（/favorites）", "/favorites"],
    ["大文字小文字が違う", "Notes"],
    ["別の文字列", "search"],
    ["空文字", ""],
  ])(
    "不正な from（%s）→ 一覧へは戻らず、従来の『← 検索結果に戻る』にフォールバックする",
    async (_label, value) => {
      const { search, list } = backLinks(
        await renderStorePage({ from: value, area_id: "2" }),
      );
      expect(list).toHaveLength(0);
      expect(search).toHaveLength(2);
      for (const link of search) {
        expect(link.props.href).toBe("/search?area_id=2");
        expect(link.props.children).toBe("← 検索結果に戻る");
      }
    },
  );

  it("from が複数指定された場合は先頭の値だけを検証して使う（先頭が有効なら一覧、先頭が不正なら検索結果）", async () => {
    const first = backLinks(
      await renderStorePage({ from: ["favorites", "https://evil.example"] }),
    );
    expect(first.list.map((l) => l.props.href)).toEqual([
      "/favorites",
      "/favorites",
    ]);

    const second = backLinks(
      await renderStorePage({ from: ["https://evil.example", "notes"] }),
    );
    expect(second.list).toHaveLength(0);
    expect(second.search.map((l) => l.props.href)).toEqual([
      "/search",
      "/search",
    ]);
  });

  it("取得失敗の表示では、再試行先が from を含むURLのまま（同じ画面を開き直せる）", async () => {
    mocks.fetchStore.mockResolvedValue({ status: "error" });
    const tree = await renderStorePage({ from: "favorites" });
    const [error] = findElements(tree, StoreErrorMessage) as {
      props: { retryHref: string };
    }[];
    expect(error.props.retryHref).toBe("/store/1?from=favorites");
  });

  it("店舗が見つからない場合は、従来どおり notFound()（from は影響しない）", async () => {
    mocks.fetchStore.mockResolvedValue({ status: "not_found" });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    await expect(renderStorePage({ from: "notes" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });
});
