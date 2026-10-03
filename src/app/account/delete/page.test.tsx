import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  createClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
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
// DeleteAccountForm が読み込むServer Action（サーバー用クライアントを読み込む）はモックに差し替える
vi.mock("./actions", () => ({ deleteAccount: vi.fn() }));

import AccountDeletePage from "./page";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { ListPageLayout } from "@/components/ListPageLayout";

type Element = {
  type: unknown;
  props: { children?: ReactNode; [key: string]: unknown };
};

// AccountDeletePage は非同期のServer Componentで、子コンポーネントは実行せずに
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

const supabaseClient = { auth: {} };

// ページに渡される props（URLのクエリは searchParams で受け取る）
function props(
  searchParams: Record<string, string | string[] | undefined> = {},
): Parameters<typeof AccountDeletePage>[0] {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as unknown as Parameters<typeof AccountDeletePage>[0];
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue(supabaseClient);
  mocks.getAuthenticatedUserId.mockResolvedValue("user-1");
  // Next.js の redirect() と同じく、呼び出したらそれ以降の処理を続けない（例外で中断する）
  mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("U08 アカウント削除画面（/account/delete）", () => {
  it("未ログイン → /login?next=/account/delete へ移動する", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    await expect(AccountDeletePage(props())).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=/account/delete",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=/account/delete");
  });

  it("未ログイン＋戻り先あり → ログイン後にこの画面へ戻れるよう、戻り先も引き継いで移動する", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const expected = `/login?next=${encodeURIComponent(
      "/account/delete?returnTo=%2Fstore%2F1%3Farea_id%3D1",
    )}`;
    await expect(
      AccountDeletePage(props({ returnTo: "/store/1?area_id=1" })),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
    expect(mocks.redirect).toHaveBeenCalledWith(expected);
  });

  it("未ログイン＋不正な戻り先 → 戻り先は引き継がず /login?next=/account/delete へ移動する", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    await expect(
      AccountDeletePage(props({ returnTo: "https://example.com" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login?next=/account/delete");
  });

  it("ログイン中 → 移動せず、見出し・閉じるボタン・注意文・確認フォームを表示する", async () => {
    const tree = await AccountDeletePage(props());
    expect(mocks.redirect).not.toHaveBeenCalled();

    const layouts = findElements(tree, ListPageLayout);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].props.title).toBe("アカウント削除");
    expect(layouts[0].props.closeLabel).toBe("アカウント削除を閉じる");

    expect(textOf(tree)).toContain(
      "メモとお気に入りを含むアカウント情報が削除され、元に戻せません。",
    );
    expect(findElements(tree, DeleteAccountForm)).toHaveLength(1);
  });

  it("ボタンの文言は『アカウント削除を閉じる』（『← 戻る』ではない）", async () => {
    const tree = await AccountDeletePage(props());
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.closeLabel).not.toContain("戻る");
  });

  describe.each([
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
    ["メモ一覧", { returnTo: "/notes" }, "/"],
    ["お気に入り", { returnTo: "/favorites" }, "/"],
    ["アカウント削除画面自身", { returnTo: "/account/delete" }, "/"],
    ["不正な店舗ID", { returnTo: "/store/abc" }, "/"],
    ["複数指定は先頭を使う", { returnTo: ["/search", "/store/1"] }, "/search"],
  ])("閉じる先：%s", (_label, searchParams, expected) => {
    it(`→ ${expected}`, async () => {
      const tree = await AccountDeletePage(props(searchParams));
      const [layout] = findElements(tree, ListPageLayout);
      expect(layout.props.returnTo).toBe(expected);
    });
  });
});
