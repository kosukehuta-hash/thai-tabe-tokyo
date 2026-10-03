import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

import { WithdrawnNotice } from "./WithdrawnNotice";

async function render(
  withdrawn: string | string[] | undefined,
): Promise<string> {
  const element = await WithdrawnNotice({ withdrawn });
  return element === null ? "" : renderToStaticMarkup(element);
}

beforeEach(() => {
  mocks.createClient.mockResolvedValue({ auth: {} });
  mocks.getAuthenticatedUserId.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("U01 『退会しました』（/?withdrawn=1）", () => {
  it("withdrawn=1 かつ ログアウト状態 → 『退会しました』を表示する", async () => {
    const html = await render("1");
    expect(html).toContain("退会しました");
    expect(html).toContain('role="status"');
  });

  it("withdrawn=1 でも、ログイン中は表示しない（URLの手入力で退会完了と誤認しないため）", async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue("user-1");
    expect(await render("1")).toBe("");
  });

  it.each([
    ["withdrawn がない", undefined],
    ["withdrawn=0", "0"],
    ["withdrawn=true", "true"],
    ["withdrawn が空", ""],
  ])("%s → ログアウト状態でも表示しない", async (_label, value) => {
    expect(await render(value)).toBe("");
  });

  it("目印がない場合は、ログイン状態の確認（認証への問い合わせ）もしない", async () => {
    await render(undefined);
    await render("0");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getAuthenticatedUserId).not.toHaveBeenCalled();
  });

  it("withdrawn が複数ある場合は、先頭の値で判定する", async () => {
    expect(await render(["1", "0"])).toContain("退会しました");
    expect(await render(["0", "1"])).toBe("");
  });

  it("ログイン状態は、ヘッダーと同じ getAuthenticatedUserId（JWTを検証する getClaims）で判定する", async () => {
    await render("1");
    expect(mocks.getAuthenticatedUserId).toHaveBeenCalledTimes(1);
    expect(mocks.getAuthenticatedUserId.mock.calls[0][1]).toMatchObject({
      route: "/",
      operation: "WithdrawnNotice.getClaims",
    });
  });
});
