import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// StoreVisitNote が読み込む Server Action（実体はサーバー用Supabaseクライアントを使う）は、モックに差し替える
vi.mock("@/app/store/[storeId]/actions", () => ({
  saveNote: vi.fn(),
  deleteNote: vi.fn(),
}));

import { StoreVisitNote } from "./StoreVisitNote";
import { NOTE_MAX_LENGTH } from "@/lib/note-limits";

function render(initialNoteText: string | null = null): string {
  return renderToStaticMarkup(
    <StoreVisitNote storeId={7} initialNoteText={initialNoteText} />,
  );
}

describe("StoreVisitNote の入力欄の最大文字数", () => {
  it("textarea の maxLength は、共通の NOTE_MAX_LENGTH と同じ値（500）", () => {
    const html = render();
    const match = html.match(/<textarea[^>]*\smaxLength="(\d+)"/);
    expect(match, "textarea に maxLength が設定されていません").not.toBeNull();
    expect(Number((match as RegExpMatchArray)[1])).toBe(NOTE_MAX_LENGTH);
    expect(Number((match as RegExpMatchArray)[1])).toBe(500);
  });

  it("メモ登録済みの場合も、同じ maxLength", () => {
    const html = render("登録済みのメモ");
    expect(html).toContain(`maxLength="${NOTE_MAX_LENGTH}"`);
  });
});
