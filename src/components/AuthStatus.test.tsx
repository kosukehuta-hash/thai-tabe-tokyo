import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// AuthStatus が読み込むブラウザ用クライアント・ログアウトのServer Actionは、
// 読み込み時に環境変数（サーバー用クライアント）を要求するため、モックに差し替える。
// ここでは表示部分（LoggedInStatus / LoggedOutStatus）だけを検査する。
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/app/logout/actions", () => ({ logout: vi.fn() }));

import { LoggedInStatus, LoggedOutStatus } from "./AuthStatus";

function links(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map(
    (m) => [m[1], m[2]],
  );
}

describe("LoggedOutStatus（未ログイン時）", () => {
  const html = renderToStaticMarkup(
    <LoggedOutStatus nextPath="/store/1" onNavigateAway={() => {}} />,
  );

  it("ログイン・新規登録の導線だけを表示し、お気に入り・メモ一覧のリンクは出さない", () => {
    expect(links(html)).toEqual([
      ["/login?next=%2Fstore%2F1", "ログイン"],
      ["/signup", "新規登録"],
    ]);
    expect(html).not.toContain("お気に入り");
    expect(html).not.toContain("/favorites");
    expect(html).not.toContain("メモ一覧");
  });
});

describe("LoggedInStatus（ログイン時）", () => {
  const html = renderToStaticMarkup(
    <LoggedInStatus
      logoutAction={() => {}}
      isLoggingOut={false}
      logoutError={null}
    />,
  );

  it("『メモ一覧』の右側に『お気に入り』のリンクを表示する（順序：メモ一覧 → お気に入り）", () => {
    expect(links(html)).toEqual([
      ["/notes", "メモ一覧"],
      ["/favorites", "お気に入り"],
    ]);
  });

  it("お気に入りの右側にログイン状態とログアウトボタンが続く", () => {
    const order = ["メモ一覧", "お気に入り", "ログイン中", "ログアウト"].map(
      (text) => html.indexOf(text),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("ログアウト中はボタンが無効になる", () => {
    const busy = renderToStaticMarkup(
      <LoggedInStatus
        logoutAction={() => {}}
        isLoggingOut={true}
        logoutError={null}
      />,
    );
    expect(busy).toContain("ログアウト中...");
    expect(busy).toMatch(/<button[^>]*\sdisabled/);
  });

  it("ログアウトのエラーは role=alert で表示する", () => {
    const failed = renderToStaticMarkup(
      <LoggedInStatus
        logoutAction={() => {}}
        isLoggingOut={false}
        logoutError="ログアウトできませんでした"
      />,
    );
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("ログアウトできませんでした");
  });
});

describe("LoggedInStatus の戻り先（returnTo）", () => {
  function render(returnTo?: string) {
    return renderToStaticMarkup(
      <LoggedInStatus
        returnTo={returnTo}
        logoutAction={() => {}}
        isLoggingOut={false}
        logoutError={null}
      />,
    );
  }

  it("U01から開く場合は returnTo を付けない（閉じるとU01へ戻る）", () => {
    expect(links(render("/"))).toEqual([
      ["/notes", "メモ一覧"],
      ["/favorites", "お気に入り"],
    ]);
  });

  it("U02から開く場合は、検索条件付きのURLを returnTo として両方のリンクに付ける", () => {
    const returnTo = encodeURIComponent("/search?area_id=1&time=lunch");
    expect(links(render("/search?area_id=1&time=lunch"))).toEqual([
      [`/notes?returnTo=${returnTo}`, "メモ一覧"],
      [`/favorites?returnTo=${returnTo}`, "お気に入り"],
    ]);
  });

  it("U03から開く場合は、その店舗詳細のURLを returnTo として両方のリンクに付ける", () => {
    const html = render("/store/123?area_id=1&time=lunch");
    expect(html).toContain(
      "/notes?returnTo=%2Fstore%2F123%3Farea_id%3D1%26time%3Dlunch",
    );
    expect(html).toContain(
      "/favorites?returnTo=%2Fstore%2F123%3Farea_id%3D1%26time%3Dlunch",
    );
  });

  it("不正な戻り先（外部URL・一覧画面自身）は付けない", () => {
    expect(links(render("https://example.com"))).toEqual([
      ["/notes", "メモ一覧"],
      ["/favorites", "お気に入り"],
    ]);
    expect(links(render("/notes"))).toEqual([
      ["/notes", "メモ一覧"],
      ["/favorites", "お気に入り"],
    ]);
  });
});
