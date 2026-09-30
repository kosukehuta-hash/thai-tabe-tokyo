import { isValidElement, type ReactNode } from "react";
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

async function renderStorePage() {
  return StorePage({
    params: Promise.resolve({ storeId: "1" }),
    searchParams: Promise.resolve({}),
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
