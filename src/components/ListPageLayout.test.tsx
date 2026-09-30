import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ヘッダーの認証表示・ロゴはブラウザ用の処理を含むため、ここでは印だけ出すスタブに差し替える。
// 検査するのは「閉じる」リンクの文言と遷移先だけ。
vi.mock("@/components/AuthStatus", () => ({
  AuthStatus: () => <span data-testid="auth-status" />,
}));
vi.mock("@/components/HeaderHomeLink", () => ({
  HeaderHomeLink: () => <span data-testid="home-link" />,
}));

import { ListPageLayout } from "./ListPageLayout";

function links(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[1].replace(/&amp;/g, "&"), m[2]],
  );
}

describe("ListPageLayout（U06・U07共通）の「閉じる」リンク", () => {
  it("『← 戻る』ではなく、渡された文言のリンクを表示する（ボタンではなくリンク）", () => {
    const html = renderToStaticMarkup(
      <ListPageLayout
        title="メモ一覧"
        closeLabel="メモ一覧を閉じる"
        returnTo="/"
      >
        <p>本文</p>
      </ListPageLayout>,
    );
    expect(html).not.toContain("← 戻る");
    expect(html).not.toContain("<button");
    expect(links(html)).toEqual([["/", "メモ一覧を閉じる"]]);
    expect(html).toContain("<h1");
    expect(html).toContain("本文");
  });

  it("リンク先は渡された戻り先（検索条件付きU02・U03）のまま", () => {
    const u02 = renderToStaticMarkup(
      <ListPageLayout
        title="お気に入り"
        closeLabel="お気に入りを閉じる"
        returnTo="/search?area_id=1&time=lunch"
      >
        {null}
      </ListPageLayout>,
    );
    expect(links(u02)).toEqual([
      ["/search?area_id=1&time=lunch", "お気に入りを閉じる"],
    ]);

    const u03 = renderToStaticMarkup(
      <ListPageLayout
        title="お気に入り"
        closeLabel="お気に入りを閉じる"
        returnTo="/store/123?area_id=1&time=lunch"
      >
        {null}
      </ListPageLayout>,
    );
    expect(links(u03)).toEqual([
      ["/store/123?area_id=1&time=lunch", "お気に入りを閉じる"],
    ]);
  });
});
