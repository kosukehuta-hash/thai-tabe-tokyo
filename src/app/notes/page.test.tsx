import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  getClaims: vi.fn(),
  fetchOwnNotesWithStores: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
// ListPageLayout → AuthStatus が読み込むブラウザ用クライアント・ログアウトのServer Actionは
// 読み込み時に環境変数を要求する。ここでは要素の木を検査するだけで描画しないため、モックに差し替える
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/app/logout/actions", () => ({ logout: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/queries/notes", () => ({
  fetchOwnNotesWithStores: mocks.fetchOwnNotesWithStores,
}));

import NotesPage from "./page";
import { ListPageLayout } from "@/components/ListPageLayout";

type Element = {
  type: unknown;
  props: { children?: ReactNode; [key: string]: unknown };
};

// NotesPage は非同期のServer Componentで、子コンポーネントは実行せずに
// 要素の木（React要素）を返す。その木の中から要素を探す。
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

// ページに渡される props（URLのクエリは searchParams で受け取る）
function props(
  searchParams: Record<string, string | string[] | undefined> = {},
): Parameters<typeof NotesPage>[0] {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as unknown as Parameters<typeof NotesPage>[0];
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
  });
  mocks.getClaims.mockResolvedValue({
    data: { claims: { sub: "user-1" } },
    error: null,
  });
  // Next.js の redirect() と同じく、呼び出したらそれ以降の処理を続けない（例外で中断する）
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  mocks.fetchOwnNotesWithStores.mockResolvedValue({
    status: "success",
    notes: [],
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("U06 メモ一覧（/notes）の『閉じる』", () => {
  it("ボタンの文言は『メモ一覧を閉じる』（『← 戻る』ではない）", async () => {
    const tree = await NotesPage(props());
    const layouts = findElements(tree, ListPageLayout);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].props.title).toBe("メモ一覧");
    expect(layouts[0].props.closeLabel).toBe("メモ一覧を閉じる");
  });

  it.each([
    ["returnTo がない", {}, "/"],
    ["U01", { returnTo: "/" }, "/"],
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
    ["外部URL", { returnTo: "https://example.com" }, "/"],
    ["プロトコル相対URL", { returnTo: "//example.com" }, "/"],
    ["お気に入り自身", { returnTo: "/favorites" }, "/"],
    ["不正な店舗ID", { returnTo: "/store/abc" }, "/"],
    ["複数指定は先頭を使う", { returnTo: ["/search", "/store/1"] }, "/search"],
  ])("閉じる先（%s）→ %s", async (_label, query, expected) => {
    const tree = await NotesPage(props(query));
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.returnTo).toBe(expected);
  });

  it("未ログイン → 従来どおり /login?next=/notes へ移動し、メモは取得しない", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    await expect(NotesPage(props())).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/notes",
    );
    expect(mocks.fetchOwnNotesWithStores).not.toHaveBeenCalled();
  });

  it("未ログイン＋戻り先あり → ログイン後にこの一覧へ戻れるよう、戻り先も引き継いで移動する", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const expected = `/login?next=${encodeURIComponent(
      "/notes?returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch",
    )}`;
    await expect(
      NotesPage(props({ returnTo: "/search?area_id=1&time=lunch" })),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
    expect(mocks.fetchOwnNotesWithStores).not.toHaveBeenCalled();
  });
});
