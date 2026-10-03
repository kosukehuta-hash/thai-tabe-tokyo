import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// next/image は描画に Next.js の設定を必要とするため、通常の img に差し替える（表示内容の検査には影響しない）
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
// 詳細リンクはブラウザ側の機能を使うため、検査に不要なので差し替える
vi.mock("./StoreDetailLink", () => ({ default: () => null }));

import StoreCard from "./StoreCard";
import type { StoreDisplayInfo } from "./page";

const searchConditions = {
  areaId: null,
  time: null,
  scene: null,
  dishId: null,
};

function render(options: {
  hasDishes: boolean;
  hasPhoto: boolean;
  isDishSelected?: boolean;
}): string {
  const store = {
    store_id: 1,
    store_name: "テスト店",
    nearest_station_name: "新宿駅",
    walk_minutes: 5,
    photo: options.hasPhoto
      ? { photoUrl: "http://example.com/a.png", altText: "外観のAI生成画像" }
      : null,
    hasDishes: options.hasDishes,
    otherDishText: null,
    mainDishText: null,
    lunchInfo: null,
    dinnerInfo: null,
    sceneText: null,
  } as unknown as StoreDisplayInfo;

  return renderToStaticMarkup(
    <StoreCard
      store={store}
      isDishSelected={options.isDishSelected ?? false}
      searchConditions={searchConditions}
    />,
  );
}

describe("U02 店舗カードの写真エリア（StoreCard）", () => {
  it("提供中の料理がない店舗は、外観写真があっても『料理写真準備中』を表示し、写真は表示しない", () => {
    const html = render({ hasDishes: false, hasPhoto: true });
    expect(html).toContain("料理写真準備中");
    expect(html).not.toContain("店舗写真準備中");
    expect(html).not.toContain("<img");
  });

  it("提供中の料理がなく、写真もない店舗も『料理写真準備中』を表示する", () => {
    const html = render({ hasDishes: false, hasPhoto: false });
    expect(html).toContain("料理写真準備中");
    expect(html).not.toContain("店舗写真準備中");
  });

  it("提供中の料理があり、外観写真がある店舗は、従来どおり写真を表示する", () => {
    const html = render({ hasDishes: true, hasPhoto: true });
    expect(html).toContain("<img");
    expect(html).not.toContain("料理写真準備中");
    expect(html).not.toContain("店舗写真準備中");
  });

  it("提供中の料理があり、料理未選択で外観写真がない店舗は、従来どおり『店舗写真準備中』を表示する", () => {
    const html = render({ hasDishes: true, hasPhoto: false });
    expect(html).toContain("店舗写真準備中");
    expect(html).not.toContain("料理写真準備中");
  });

  it("料理を選択して検索し、その料理の写真がない店舗は、従来どおり『料理写真準備中』を表示する", () => {
    const html = render({
      hasDishes: true,
      hasPhoto: false,
      isDishSelected: true,
    });
    expect(html).toContain("料理写真準備中");
    expect(html).not.toContain("店舗写真準備中");
  });
});
