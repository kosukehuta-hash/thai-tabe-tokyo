import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// FavoriteItem が読み込む Server Action（実体はサーバー用Supabaseクライアントを使う）はモックに差し替える。
vi.mock("./actions", () => ({ removeFavorite: vi.fn() }));

import { FavoriteItemView } from "./FavoriteItem";

const REMOVE_ERROR_MESSAGE =
  "お気に入りを解除できませんでした。時間をおいてもう一度お試しください。";

function render(
  props: Partial<Parameters<typeof FavoriteItemView>[0]> = {},
): string {
  return renderToStaticMarkup(
    <ul>
      <FavoriteItemView
        storeId={5}
        storeName="テスト食堂"
        isPublished={true}
        isPending={false}
        error={null}
        formAction={() => {}}
        {...props}
      />
    </ul>,
  );
}

describe("FavoriteItemView（公開店舗）", () => {
  const html = render({ isPublished: true });

  it("店舗名から店舗詳細（/store/{id}）へ移動できる。『非公開』は表示しない", () => {
    expect(html).toMatch(
      /<a [^>]*href="\/store\/5\?from=favorites"[^>]*>テスト食堂<\/a>/,
    );
    expect(html).not.toContain("非公開");
  });

  it("店舗詳細のリンクには from=favorites を付ける（店舗詳細で『お気に入りに戻る』にするため）。戻り先のURLは含めない", () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(hrefs).toEqual(["/store/5?from=favorites"]);
    expect(html).not.toContain("returnTo");
  });

  it("『解除』ボタンがあり、確認ダイアログ用の処理は持たない", () => {
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>解除<\/button>/);
    expect(html).not.toMatch(/confirm/i);
  });

  it("フォームにstoreIdを持たせる", () => {
    expect(html).toContain('name="storeId"');
    expect(html).toContain('value="5"');
  });
});

describe("FavoriteItemView（非公開店舗）", () => {
  const html = render({ isPublished: false });

  it("店舗名と『非公開』バッジを表示し、店舗詳細へのリンクは付けない", () => {
    expect(html).toContain("テスト食堂");
    expect(html).toContain("非公開");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("/store/5");
  });

  it("非公開でも『解除』ボタンは押せる（disabledではない）", () => {
    expect(html).toMatch(/<button[^>]*>解除<\/button>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled/);
  });
});

describe("FavoriteItemView（解除の処理中・失敗）", () => {
  it("処理中は『解除』ボタンが disabled になる（二重送信の防止）", () => {
    expect(render({ isPending: true })).toMatch(/<button[^>]*\sdisabled/);
    expect(render({ isPending: false })).not.toMatch(/<button[^>]*\sdisabled/);
  });

  it("解除に失敗した場合は role=alert で文言を表示し、カード（店舗名・解除ボタン）は残り、ボタンは再度押せる", () => {
    const html = render({ error: REMOVE_ERROR_MESSAGE, isPending: false });
    expect(html).toContain('role="alert"');
    expect(html).toContain(REMOVE_ERROR_MESSAGE);
    expect(html).toContain("テスト食堂");
    expect(html).toMatch(/<button[^>]*>解除<\/button>/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled/);
  });

  it("エラーがなければ alert は表示しない", () => {
    expect(render({ error: null })).not.toContain('role="alert"');
  });

  it("登録日時・画像・エリア・料理などは表示しない（店舗名・公開状態・解除ボタンだけ）", () => {
    const html = render({ isPublished: false });
    expect(html).not.toMatch(/<img/);
    expect(html).not.toMatch(/\d{4}年\d+月\d+日/);
    expect(html).not.toMatch(/エリア|料理|登録日/);
  });
});
