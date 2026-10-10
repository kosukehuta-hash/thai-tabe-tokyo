import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
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
import { ListFetchError } from "@/components/ListFetchError";

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

const NOTE = {
  noteId: 1,
  storeId: 10,
  noteText: "辛さは控えめにしてもらった",
  updatedAt: "2026-09-30T10:00:00Z",
  storeName: "テスト食堂",
  isPublished: true,
};

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

describe("U06 メモ一覧（/notes）の取得失敗と再試行", () => {
  beforeEach(() => {
    mocks.fetchOwnNotesWithStores.mockResolvedValue({ status: "error" });
  });

  it("取得失敗 → 取得失敗の文言と『再試行』リンクを表示し、一覧・0件の表示は出さない", async () => {
    const tree = await NotesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(1);
    const html = markupOf(tree);
    expect(html).toContain('role="alert"');
    expect(html).toContain(
      "情報を取得できませんでした。もう一度お試しください",
    );
    expect(links(html)).toEqual([["/notes", "再試行"]]);
    expect(findElements(tree, "ul")).toHaveLength(0);
    expect(JSON.stringify(tree)).not.toContain("まだメモがありません");
  });

  it.each([
    ["returnTo がない", {}, "/notes"],
    [
      "U02（検索条件付き）",
      { returnTo: "/search?area_id=1&time=lunch" },
      "/notes?returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch",
    ],
    [
      "U03（クエリ付き）",
      { returnTo: "/store/123?area_id=1&time=lunch" },
      "/notes?returnTo=%2Fstore%2F123%3Farea_id%3D1%26time%3Dlunch",
    ],
    ["外部URL（不正）", { returnTo: "https://example.com" }, "/notes"],
    ["プロトコル相対URL（不正）", { returnTo: "//example.com" }, "/notes"],
    ["一覧自身（不正）", { returnTo: "/favorites" }, "/notes"],
  ])("再試行先（%s）", async (_label, query, expected) => {
    const tree = await NotesPage(props(query));
    const [error] = findElements(tree, ListFetchError);
    expect(error.props.retryHref).toBe(expected);
    expect(links(markupOf(tree))[0]).toEqual([expected, "再試行"]);
  });

  it("取得失敗でも『閉じる』は従来どおり（文言・戻り先を変えない）", async () => {
    const tree = await NotesPage(props({ returnTo: "/search?area_id=1" }));
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.closeLabel).toBe("メモ一覧を閉じる");
    expect(layout.props.returnTo).toBe("/search?area_id=1");
  });

  it("メモあり（正常な一覧） → 一覧を表示し、『再試行』は出さない", async () => {
    mocks.fetchOwnNotesWithStores.mockResolvedValue({
      status: "success",
      notes: [NOTE],
    });
    const tree = await NotesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(0);
    expect(findElements(tree, "ul")).toHaveLength(1);
    expect(findElements(tree, "li")).toHaveLength(1);
  });

  it("メモ0件 → 『まだメモがありません』を表示し、『再試行』は出さない", async () => {
    mocks.fetchOwnNotesWithStores.mockResolvedValue({
      status: "success",
      notes: [],
    });
    const tree = await NotesPage(props());
    expect(findElements(tree, ListFetchError)).toHaveLength(0);
    expect(JSON.stringify(tree)).toContain("まだメモがありません");
  });
});

describe("U06 メモ一覧（/notes）から店舗詳細へのリンク", () => {
  beforeEach(() => {
    mocks.fetchOwnNotesWithStores.mockResolvedValue({
      status: "success",
      notes: [
        NOTE,
        { ...NOTE, noteId: 2, storeId: 20, storeName: "別の食堂" },
        {
          ...NOTE,
          noteId: 3,
          storeId: 30,
          storeName: "非公開の食堂",
          isPublished: false,
        },
      ],
    });
  });

  it("公開店舗のリンクには from=notes を付ける（店舗詳細で『メモ一覧に戻る』にするため）", async () => {
    const tree = await NotesPage(props());
    const hrefs = findElements(tree, Link).map((link) => link.props.href);
    expect(hrefs).toEqual(["/store/10?from=notes", "/store/20?from=notes"]);
  });

  it("非公開店舗には店舗詳細へのリンクを付けない（従来どおり）", async () => {
    const tree = await NotesPage(props());
    const hrefs = findElements(tree, Link).map((link) =>
      String(link.props.href),
    );
    expect(hrefs.some((href) => href.includes("/store/30"))).toBe(false);
    // 店舗名と『非公開』のバッジは表示する（リンクにはしない）
    const spanTexts = findElements(tree, "span").map(
      (span) => span.props.children,
    );
    expect(spanTexts).toContain("非公開の食堂");
    expect(spanTexts).toContain("非公開");
  });

  it("一覧自身の returnTo（閉じるの戻り先）は、店舗詳細のリンクに引き継がない", async () => {
    const tree = await NotesPage(
      props({ returnTo: "/search?area_id=1&time=lunch" }),
    );
    const hrefs = findElements(tree, Link).map((link) =>
      String(link.props.href),
    );
    expect(hrefs).toEqual(["/store/10?from=notes", "/store/20?from=notes"]);
    for (const href of hrefs) {
      expect(href).not.toContain("returnTo");
    }
    // 『閉じる』の戻り先は従来どおり
    const [layout] = findElements(tree, ListPageLayout);
    expect(layout.props.returnTo).toBe("/search?area_id=1&time=lunch");
  });
});
