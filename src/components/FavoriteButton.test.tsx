import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addFavorite, removeFavorite } = vi.hoisted(() => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

vi.mock("@/app/favorites/actions", () => ({ addFavorite, removeFavorite }));

import { FavoriteButtonView, toggleFavorite } from "./FavoriteButton";

const NOT_AVAILABLE_MESSAGE = "この店舗は現在お気に入りに登録できません。";
const REMOVE_ERROR_MESSAGE =
  "お気に入りを解除できませんでした。時間をおいてもう一度お試しください。";

function render(
  props: Partial<Parameters<typeof FavoriteButtonView>[0]> = {},
): string {
  return renderToStaticMarkup(
    <FavoriteButtonView
      storeId={7}
      isFavorite={false}
      isPending={false}
      error={null}
      formAction={() => {}}
      {...props}
    />,
  );
}

describe("FavoriteButtonView（表示）", () => {
  it("未登録 → 『♡ お気に入り』、押されていない状態", () => {
    const html = render({ isFavorite: false });
    expect(html).toContain("♡ お気に入り");
    expect(html).not.toContain("♥");
    expect(html).toContain('aria-pressed="false"');
  });

  it("登録済み → 『♥ お気に入り済み』、押されている状態", () => {
    const html = render({ isFavorite: true });
    expect(html).toContain("♥ お気に入り済み");
    expect(html).not.toContain("♡");
    expect(html).toContain('aria-pressed="true"');
  });

  it("フォームにstoreIdを持たせ、送信ボタンである", () => {
    const html = render({ storeId: 42 });
    expect(html).toContain('name="storeId"');
    expect(html).toContain('value="42"');
    expect(html).toContain('type="submit"');
  });

  it("処理中はボタンが disabled になる（二重送信の防止）", () => {
    expect(render({ isPending: true })).toMatch(/<button[^>]*\sdisabled/);
    expect(render({ isPending: false })).not.toMatch(/<button[^>]*\sdisabled/);
  });

  it("エラーがあれば role=alert で表示し、ボタン表示は変えない（未登録のまま）", () => {
    const html = render({ isFavorite: false, error: NOT_AVAILABLE_MESSAGE });
    expect(html).toContain('role="alert"');
    expect(html).toContain(NOT_AVAILABLE_MESSAGE);
    expect(html).toContain("♡ お気に入り");
  });

  it("エラーがあれば role=alert で表示し、ボタン表示は変えない（登録済みのまま）", () => {
    const html = render({ isFavorite: true, error: REMOVE_ERROR_MESSAGE });
    expect(html).toContain('role="alert"');
    expect(html).toContain(REMOVE_ERROR_MESSAGE);
    expect(html).toContain("♥ お気に入り済み");
  });

  it("エラーがなければ alert は表示しない", () => {
    expect(render({ error: null })).not.toContain('role="alert"');
  });
});

describe("toggleFavorite（登録・解除の切り替え）", () => {
  const formData = new FormData();

  beforeEach(() => {
    formData.set("storeId", "7");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("未登録のときは addFavorite を呼び、その結果（登録成功）をそのまま返す", async () => {
    const prev = { isFavorite: false, error: null };
    addFavorite.mockResolvedValue({ isFavorite: true, error: null });
    await expect(toggleFavorite(prev, formData)).resolves.toEqual({
      isFavorite: true,
      error: null,
    });
    expect(addFavorite).toHaveBeenCalledWith(prev, formData);
    expect(removeFavorite).not.toHaveBeenCalled();
  });

  it("登録済みのときは removeFavorite を呼び、その結果（解除成功）をそのまま返す", async () => {
    const prev = { isFavorite: true, error: null };
    removeFavorite.mockResolvedValue({ isFavorite: false, error: null });
    await expect(toggleFavorite(prev, formData)).resolves.toEqual({
      isFavorite: false,
      error: null,
    });
    expect(removeFavorite).toHaveBeenCalledWith(prev, formData);
    expect(addFavorite).not.toHaveBeenCalled();
  });

  it("登録失敗（TF001）→ 返却文言をそのまま返し、未登録状態を維持する", async () => {
    addFavorite.mockResolvedValue({
      isFavorite: false,
      error: NOT_AVAILABLE_MESSAGE,
    });
    await expect(
      toggleFavorite({ isFavorite: false, error: null }, formData),
    ).resolves.toEqual({ isFavorite: false, error: NOT_AVAILABLE_MESSAGE });
  });

  it("解除失敗 → 返却文言をそのまま返し、登録済み状態を維持する", async () => {
    removeFavorite.mockResolvedValue({
      isFavorite: true,
      error: REMOVE_ERROR_MESSAGE,
    });
    await expect(
      toggleFavorite({ isFavorite: true, error: null }, formData),
    ).resolves.toEqual({ isFavorite: true, error: REMOVE_ERROR_MESSAGE });
  });
});
