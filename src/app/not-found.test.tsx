import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ロゴ付きのトップへのリンクはブラウザ用の処理（next/image・sessionStorage）を含むため、
// ここでは印だけ出すスタブに差し替える。404画面の本文（案内・「トップへ戻る」）だけを検査する。
vi.mock("@/components/HeaderHomeLink", () => ({
  HeaderHomeLink: () => <span data-testid="home-link" />,
}));
// 404画面は認証表示（Supabaseへの問い合わせを伴う）を使わない。使っていないことを確認するための印。
vi.mock("@/components/AuthStatus", () => ({
  AuthStatus: () => <span data-testid="auth-status" />,
}));

import NotFound, { metadata } from "./not-found";

function links(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[1], m[2]],
  );
}

function render(): string {
  return renderToStaticMarkup(<NotFound />);
}

describe("404画面（存在しないURL）", () => {
  it("『404』と、ページが見つからないことを日本語で表示する（見出しはh1が1つ）", () => {
    const html = render();
    expect(html).toContain("404");
    expect(html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe(
      "ページが見つかりませんでした",
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(
      "お探しのページは存在しないか、移動した可能性があります",
    );
  });

  it("Next.js標準の英語の404画面の文言は表示しない", () => {
    const html = render();
    expect(html).not.toContain("This page could not be found");
    expect(html).not.toContain("Not Found");
  });

  it("『トップへ戻る』はボタンではなくリンク（a）で、移動先は / である", () => {
    const html = render();
    expect(links(html)).toEqual([["/", "トップへ戻る"]]);
    expect(html).not.toContain("<button");
  });

  it("共通のロゴ付きトップへのリンクを表示し、認証表示（Supabaseへの問い合わせ）は使わない", () => {
    const html = render();
    expect(html).toContain('data-testid="home-link"');
    expect(html).not.toContain('data-testid="auth-status"');
    expect(html).toContain("<header");
    expect(html).toContain("<main");
  });

  it("ページタイトルは『ページが見つかりません | THAI TABE TOKYO』（他の画面と同じ形式）", () => {
    expect(metadata.title).toBe("ページが見つかりません | THAI TABE TOKYO");
  });
});
