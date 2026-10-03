import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next/image は描画に Next.js の設定を必要とするため、通常の img に差し替える（表示内容の検査には影響しない）
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import StoreInfoRows from "./StoreInfoRows";

function render(props: {
  spiceSupportText: string | null;
  reservationText?: string | null;
  seatTypeText?: string | null;
}) {
  return renderToStaticMarkup(
    <StoreInfoRows
      sceneLabels={["一人"]}
      spiceSupportText={props.spiceSupportText}
      reservationText={props.reservationText ?? null}
      seatTypeText={props.seatTypeText ?? null}
    />,
  );
}

describe("StoreInfoRows（U03 辛さ対応・予約・席のタイプ）", () => {
  it("辛さ対応が登録済みなら、ラベルと内容を表示する", () => {
    const html = render({ spiceSupportText: "辛さ調整可" });
    expect(html).toContain("辛さ対応");
    expect(html).toContain("辛さ調整可");
  });

  it("辛さ対応が未登録（null）なら、項目自体を表示せず「未確認」も出さない", () => {
    const html = render({ spiceSupportText: null });
    expect(html).not.toContain("辛さ対応");
    expect(html).not.toContain("未確認");
  });

  it("辛さ対応が空白だけでも、項目自体を表示しない", () => {
    const html = render({ spiceSupportText: "   " });
    expect(html).not.toContain("辛さ対応");
    expect(html).not.toContain("未確認");
  });

  it("予約・席のタイプは、従来どおり未登録なら非表示・登録済みなら表示する", () => {
    const none = render({ spiceSupportText: null });
    expect(none).not.toContain("予約");
    expect(none).not.toContain("席のタイプ");

    const some = render({
      spiceSupportText: null,
      reservationText: "予約可",
      seatTypeText: "テーブル席",
    });
    expect(some).toContain("予約可");
    expect(some).toContain("テーブル席");
  });
});
