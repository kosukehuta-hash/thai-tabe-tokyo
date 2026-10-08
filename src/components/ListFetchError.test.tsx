import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListFetchError } from "./ListFetchError";

const MESSAGE = "情報を取得できませんでした。もう一度お試しください";

function links(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[1].replace(/&amp;/g, "&"), m[2]],
  );
}

describe("ListFetchError（U06・U07共通の取得失敗表示）", () => {
  it("取得失敗の文言を role=alert で表示し、内部エラーの内容は含まない", () => {
    const html = renderToStaticMarkup(<ListFetchError retryHref="/notes" />);
    expect(html).toContain('role="alert"');
    const alert = html.match(/<p[^>]*role="alert"[^>]*>([^<]*)<\/p>/);
    expect(alert).not.toBeNull();
    expect((alert as RegExpMatchArray)[1]).toBe(MESSAGE);
    // 表示する文字は、文言と「再試行」だけ
    expect(html.replace(/<[^>]*>/g, "")).toBe(`${MESSAGE}再試行`);
  });

  it("『再試行』はボタンではなくリンク（a）で、渡された移動先へ移動する（クエリ付きでも変えない）", () => {
    const href = "/favorites?returnTo=%2Fsearch%3Farea_id%3D1%26time%3Dlunch";
    const html = renderToStaticMarkup(<ListFetchError retryHref={href} />);
    expect(links(html)).toEqual([[href, "再試行"]]);
    expect(html).not.toContain("<button");
  });

  it("リンクは『再試行』の1つだけで、『条件選択へ戻る』などは表示しない", () => {
    const html = renderToStaticMarkup(<ListFetchError retryHref="/notes" />);
    expect(links(html)).toHaveLength(1);
    expect(html).not.toContain("条件選択へ戻る");
  });
});
