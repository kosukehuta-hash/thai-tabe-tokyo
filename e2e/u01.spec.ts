import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * カテゴリ見出し（例:「場所から選ぶ」）のテキストを起点に、
 * その見出しと兄弟関係にある選択肢コンテナを特定する。
 * CSS Modulesのハッシュ化クラス名やDOM順（.last()等）には依存しない。
 */
function getCategoryOptionsContainer(page: Page, headingText: string): Locator {
  const heading = page.getByText(headingText, { exact: true });
  return heading.locator("xpath=../following-sibling::div[1]");
}

/** カテゴリコンテナ内の「すべて」ボタンを取得する。 */
function getAllButton(container: Locator): Locator {
  return container
    .getByText("すべて", { exact: true })
    .locator("xpath=ancestor-or-self::button[1]");
}

/** カテゴリコンテナ内の、指定テキストを持つ選択肢ボタンを取得する。 */
function getOptionButton(container: Locator, optionText: string): Locator {
  return container
    .getByText(optionText, { exact: true })
    .locator("xpath=ancestor-or-self::button[1]");
}

/**
 * クリック直後はReactのハイドレーションが完了しておらず
 * onClickが効かないことがあるため、aria-pressedが反映されるまでクリックを再試行する。
 */
async function clickUntilPressed(button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true", {
      timeout: 1000,
    });
  }).toPass({ timeout: 15000 });
}

const CATEGORY_HEADINGS = [
  "場所から選ぶ",
  "時間帯から選ぶ",
  "利用シーンから選ぶ",
  "食べたい料理から選ぶ",
];

test.describe("U01 トップページ 検索条件選択", () => {
  test("TC-U01-01: 初期表示ですべてのカテゴリで「すべて」が選択されている", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    for (const heading of CATEGORY_HEADINGS) {
      const container = getCategoryOptionsContainer(page, heading);
      const allButton = getAllButton(container);
      await expect(allButton).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("TC-U01-02: 同じカテゴリ内で2件選択すると後から選んだ1件だけが選択状態になる", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const timeContainer = getCategoryOptionsContainer(page, "時間帯から選ぶ");
    const lunchButton = getOptionButton(timeContainer, "ランチ");
    const dinnerButton = getOptionButton(timeContainer, "ディナー");

    await clickUntilPressed(lunchButton);

    await clickUntilPressed(dinnerButton);
    await expect(lunchButton).toHaveAttribute("aria-pressed", "false");

    // NF14: 選択状態は色だけでなく、チェックアイコン（svg）の有無でも判別できる
    await expect(dinnerButton.locator("svg")).toHaveCount(1);
    await expect(lunchButton.locator("svg")).toHaveCount(0);
  });

  test("TC-U01-03: 複数条件を選択後「条件をリセット」を押すと全カテゴリが「すべて」に戻る", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const timeContainer = getCategoryOptionsContainer(page, "時間帯から選ぶ");
    await clickUntilPressed(getOptionButton(timeContainer, "ランチ"));

    const sceneContainer = getCategoryOptionsContainer(
      page,
      "利用シーンから選ぶ",
    );
    await clickUntilPressed(getOptionButton(sceneContainer, "ひとり"));

    await page.getByRole("button", { name: "条件をリセット" }).click();

    for (const heading of CATEGORY_HEADINGS) {
      const container = getCategoryOptionsContainer(page, heading);
      const allButton = getAllButton(container);
      await expect(allButton).toHaveAttribute("aria-pressed", "true");
    }
  });
});
