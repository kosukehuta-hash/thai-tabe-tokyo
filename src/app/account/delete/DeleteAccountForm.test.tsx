import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// フォームが読み込むServer Action（サーバー用クライアントを読み込む）はモックに差し替える。
// ここでは表示（チェックボックス・ボタンの無効／有効、エラー表示）だけを検査する。
vi.mock("./actions", () => ({ deleteAccount: vi.fn() }));

import {
  CONFIRM_LABEL,
  DELETE_BUTTON_LABEL,
  DeleteAccountForm,
  DeleteAccountFormView,
} from "./DeleteAccountForm";

function render(
  options: {
    confirmed?: boolean;
    pending?: boolean;
    error?: string | null;
    isProtected?: boolean;
  } = {},
): string {
  return renderToStaticMarkup(
    <DeleteAccountFormView
      confirmed={options.confirmed ?? false}
      onConfirmedChange={() => {}}
      formAction={() => {}}
      pending={options.pending ?? false}
      error={options.error ?? null}
      isProtected={options.isProtected}
    />,
  );
}

function buttonTag(html: string): string {
  const match = html.match(/<button[^>]*>/);
  expect(match).not.toBeNull();
  return (match as RegExpMatchArray)[0];
}

function checkboxTag(html: string): string {
  const match = html.match(/<input[^>]*type="checkbox"[^>]*>/);
  expect(match).not.toBeNull();
  return (match as RegExpMatchArray)[0];
}

describe("U08 確認フォーム（DeleteAccountFormView）", () => {
  it("文言は仕様どおり（確認チェックボックス・削除ボタン）", () => {
    const html = render();
    expect(CONFIRM_LABEL).toBe("上記を理解したうえで、アカウントを削除します");
    expect(DELETE_BUTTON_LABEL).toBe("アカウントを削除する");
    expect(html).toContain(CONFIRM_LABEL);
    expect(html).toContain(DELETE_BUTTON_LABEL);
  });

  it("チェック前は、チェックボックスが未チェックで、削除ボタンが無効になる", () => {
    const html = render({ confirmed: false });
    expect(checkboxTag(html)).not.toContain("checked");
    expect(buttonTag(html)).toContain("disabled");
  });

  it("チェック後は、チェックボックスがチェック済みで、削除ボタンが有効になる", () => {
    const html = render({ confirmed: true });
    expect(checkboxTag(html)).toContain("checked");
    expect(buttonTag(html)).not.toContain("disabled");
  });

  it("処理中は、チェック済みでもチェックボックスと削除ボタンが無効になる（二重送信防止）", () => {
    const html = render({ confirmed: true, pending: true });
    expect(checkboxTag(html)).toMatch(/\sdisabled/);
    expect(buttonTag(html)).toMatch(/\sdisabled/);
  });

  it("処理中でなければ、チェックボックスは無効にならない", () => {
    const html = render({ confirmed: true, pending: false });
    expect(checkboxTag(html)).not.toMatch(/\sdisabled/);
  });

  it("エラーがなければエラー表示を出さない", () => {
    expect(render()).not.toContain('role="alert"');
  });

  it("エラーがあれば、同じ画面に role=alert で表示する", () => {
    const message =
      "アカウントを削除できませんでした。時間をおいてもう一度お試しください。";
    const html = render({ confirmed: true, error: message });
    expect(html).toContain('role="alert"');
    expect(html).toContain(message);
    // エラー後も再度操作できる（チェック済みなら削除ボタンは有効）
    expect(buttonTag(html)).not.toContain("disabled");
  });

  it("フォームの送信先はServer Action（<form action>）で、ユーザーIDなどの入力欄を持たない", () => {
    const html = render({ confirmed: true });
    expect(html).not.toMatch(/name="(user_?id|userId|id)"/i);
    expect(html.match(/<input[^>]*>/g)).toHaveLength(1);
  });
});

describe("U08 確認フォーム（DeleteAccountForm）の初期状態", () => {
  it("初期表示は未チェックで、削除ボタンは無効である", () => {
    // useActionState を使う部分は、サーバー描画では初期状態（エラーなし・処理中でない）になる
    const html = renderToStaticMarkup(<DeleteAccountForm />);
    expect(checkboxTag(html)).not.toContain("checked");
    expect(buttonTag(html)).toContain("disabled");
    expect(html).not.toContain('role="alert"');
  });
});

describe("U08 確認フォーム（デモアカウント保護）", () => {
  const PROTECTED_MESSAGE = "デモアカウントは削除できません";

  it("保護対象 → 確認チェックの有無にかかわらず、削除ボタンが無効である（チェックボックス自体は操作できる）", () => {
    const unchecked = render({ confirmed: false, isProtected: true });
    expect(buttonTag(unchecked)).toMatch(/\sdisabled/);
    expect(checkboxTag(unchecked)).not.toMatch(/\sdisabled/);

    const checked = render({ confirmed: true, isProtected: true });
    expect(checkboxTag(checked)).toContain("checked");
    expect(checkboxTag(checked)).not.toMatch(/\sdisabled/);
    expect(buttonTag(checked)).toMatch(/\sdisabled/);
  });

  it("保護対象 → 『デモアカウントは削除できません』を表示する", () => {
    const html = render({ confirmed: false, isProtected: true });
    expect(html).toContain(PROTECTED_MESSAGE);
  });

  it("保護対象ではない → 従来どおり、チェックすると削除ボタンが有効になる（保護の表示も出さない）", () => {
    const unchecked = render({ confirmed: false, isProtected: false });
    expect(unchecked).not.toContain(PROTECTED_MESSAGE);
    expect(buttonTag(unchecked)).toContain("disabled");

    const checked = render({ confirmed: true, isProtected: false });
    expect(checked).not.toContain(PROTECTED_MESSAGE);
    expect(buttonTag(checked)).not.toContain("disabled");

    // isProtected を渡さない場合も同じ（既定は保護対象ではない）
    expect(buttonTag(render({ confirmed: true }))).not.toContain("disabled");
  });
});
