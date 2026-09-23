import { test, expect, type Page } from "@playwright/test";

/**
 * TC-COM-01〜03（U02のレスポンシブ列数・スマホ横型カード）を、
 * CSSのgrid-template-columnsの値ではなく、実際にレンダリングされた
 * 店舗カードのboundingBox()座標を使って検証する。
 *
 * 文字切れ・重なり・余白の見た目としての崩れは対象外とし、手動確認に残す
 * （3TCとも「一部自動化」として扱う）。
 */

type Point = { x: number; y: number };

/** サブピクセル差を吸収しつつ、Y座標が近い店舗カードタイトルを同じ「段」にまとめる。 */
function groupByRow(points: Point[], tolerance = 4): Point[][] {
  const rows: Point[][] = [];
  for (const point of points) {
    const row = rows.find((r) => Math.abs(r[0].y - point.y) <= tolerance);
    if (row) {
      row.push(point);
    } else {
      rows.push([point]);
    }
  }
  return rows;
}

/** 検索結果カードの店舗名（h3）の座標を、表示順に指定件数だけ取得する。 */
async function getCardTitlePositions(
  page: Page,
  count: number,
): Promise<Point[]> {
  return page.locator("h3").evaluateAll(
    (elements, n) =>
      elements.slice(0, n).map((el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      }),
    count,
  );
}

/** ページ全体に意図しない横スクロールが発生していないことを確認する。 */
async function expectNoHorizontalScroll(page: Page) {
  const noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalScroll).toBe(true);
}

test.describe("TC-COM-01〜03 U02のレスポンシブ表示", () => {
  test("TC-COM-01: 1200px以上ではU02の店舗カードが3列で表示される", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const positions = await getCardTitlePositions(page, 6);
    expect(
      positions.length,
      "事前条件が失われました: 検索結果の店舗カードが6件未満です",
    ).toBeGreaterThanOrEqual(6);

    const rows = groupByRow(positions);
    expect(
      rows.length,
      `1段目・2段目の判定に失敗しました（検出された段数: ${rows.length}）`,
    ).toBeGreaterThanOrEqual(2);
    expect(rows[0].length, "1段目のカード数が3件ではありません").toBe(3);
    expect(rows[1].length, "2段目のカード数が3件ではありません").toBe(3);

    await expectNoHorizontalScroll(page);
  });

  test("TC-COM-02: 375〜767pxではU02の店舗カードが1列になり、カード内は写真が上・店舗情報が下の縦積みになる", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const positions = await getCardTitlePositions(page, 3);
    expect(
      positions.length,
      "事前条件が失われました: 検索結果の店舗カードが3件未満です",
    ).toBeGreaterThanOrEqual(3);

    // 1列表示：同じ行に複数カードが並ばず、Y座標が順に下がっていく
    const rows = groupByRow(positions);
    expect(
      rows.length,
      "同じ行に複数カードが並んでいる可能性があります（1列になっていません）",
    ).toBe(positions.length);
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i].y).toBeGreaterThan(positions[i - 1].y);
    }

    // カード内：写真（1つ目の子div）が上、情報（2つ目の子div）が下の縦積み
    const firstLink = page
      .getByRole("link", { name: "詳しく見る", exact: true })
      .first();
    const card = firstLink.locator("xpath=ancestor::div[2]");
    const photoBox = await card.locator("> div").nth(0).boundingBox();
    const infoBox = await card.locator("> div").nth(1).boundingBox();
    expect(
      photoBox,
      "事前条件が失われました: 写真エリアのboundingBoxが取得できません",
    ).not.toBeNull();
    expect(
      infoBox,
      "事前条件が失われました: 情報エリアのboundingBoxが取得できません",
    ).not.toBeNull();
    expect(photoBox!.y).toBeLessThan(infoBox!.y);

    // 写真は横長16:9で、カード幅いっぱいに表示される
    expect(photoBox!.width / photoBox!.height).toBeCloseTo(16 / 9, 1);

    await expectNoHorizontalScroll(page);
  });

  test("TC-COM-03: 768〜1199pxではU02の店舗カードが2列で表示される", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    const positions = await getCardTitlePositions(page, 4);
    expect(
      positions.length,
      "事前条件が失われました: 検索結果の店舗カードが4件未満です",
    ).toBeGreaterThanOrEqual(4);

    const rows = groupByRow(positions);
    expect(
      rows.length,
      `1段目・2段目の判定に失敗しました（検出された段数: ${rows.length}）`,
    ).toBeGreaterThanOrEqual(2);
    expect(rows[0].length, "1段目のカード数が2件ではありません").toBe(2);
    expect(rows[1].length, "2段目のカード数が2件ではありません").toBe(2);

    await expectNoHorizontalScroll(page);
  });
});
