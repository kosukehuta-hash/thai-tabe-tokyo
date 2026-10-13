import http from "node:http";
import {
  assertImageGuardClean,
  createImageRequestClassifier,
  createImageRequestClassifierFromEnv,
  expect,
  installImageGuard,
  isImageRequestPending,
  judgeImageRequest,
  summarizeImageRequests,
  test,
  type Browser,
  type BlockedImageKind,
  type ImageGuard,
  type ImageRequestRecord,
  type Page,
} from "./fixtures";
import { fetchAllStorePhotos, getSupabaseOrigin } from "./supabase-data";

// 1x1の透明PNG（疑似的な応答に使う。実際の画像データではない）
const DUMMY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// 判定の確認だけに使うダミーのホスト名（実際のSupabaseのURLではない）
const DUMMY_ORIGIN = "https://example.supabase.co";
// 実データと同じ形式のURL（supabase/seed/store_photos.csv の photo_url、SearchForm.tsx の料理画像と同じ形）
const STORE_PHOTO = `${DUMMY_ORIGIN}/storage/v1/object/public/thai-tabe-images/stores/store-001-exterior-01.png`;
const DISH_PHOTO = `${DUMMY_ORIGIN}/storage/v1/object/public/thai-tabe-images/dishes/all-dishes.png`;
// Next.js の既定ローダーが作る形（/_next/image?url=<encodeURIComponent(元URL)>&w=…&q=…）
const nextImagePath = (source: string, width = 640) =>
  `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
const nextImageUrl = (source: string, width = 640) =>
  `http://localhost:3000${nextImagePath(source, width)}`;

test.describe("画像通信ガード: 止める対象の判定（ネットワーク不要）", () => {
  const classify = createImageRequestClassifier(DUMMY_ORIGIN);

  const blocked: Array<[string, string, BlockedImageKind]> = [
    [
      "画像変換: 店舗写真（DBのphoto_urlと同じ形）",
      nextImageUrl(STORE_PHOTO),
      "next-image",
    ],
    ["画像変換: U01の料理画像", nextImageUrl(DISH_PHOTO), "next-image"],
    ["直接アクセス: 公開", STORE_PHOTO, "direct-storage"],
    [
      "直接アクセス: 署名付き",
      `${DUMMY_ORIGIN}/storage/v1/object/sign/thai-tabe-images/a.png?token=dummy`,
      "direct-storage",
    ],
    [
      "直接アクセス: Storageの画像変換API",
      `${DUMMY_ORIGIN}/storage/v1/render/image/public/thai-tabe-images/a.png?width=100`,
      "direct-storage",
    ],
  ];
  for (const [name, url, kind] of blocked) {
    test(`止める: ${name}`, () => {
      expect(classify(url)).toBe(kind);
    });
  }

  const allowed: Array<[string, string]> = [
    [
      "ローカルのロゴ（画像変換経由、取得元が相対パス）",
      nextImageUrl("/images/thai-temple-logo-v2.png", 256),
    ],
    [
      "Supabase以外の外部画像（画像変換経由）",
      nextImageUrl("https://other.example.com/a.png"),
    ],
    [
      "Supabase以外のホストの /storage/v1/（直接）",
      "https://other.example.com/storage/v1/object/public/a.png",
    ],
    [
      "名前が似ているだけの別ホスト",
      `${DUMMY_ORIGIN}.evil.test/storage/v1/object/public/a.png`,
    ],
    [
      "ローカルサーバー自身の /storage/v1/",
      "http://localhost:3000/storage/v1/object/public/a.png",
    ],
    [
      "画像変換の取得元が、相対パスのStorageパス（ローカルを指す）",
      nextImageUrl("/storage/v1/object/public/a.png"),
    ],
    [
      'Next.js側が拒否する "//" 始まりの取得元（取得は発生しない）',
      nextImageUrl("//example.supabase.co/storage/v1/object/public/a.png"),
    ],
    ["DBのAPI（REST）", `${DUMMY_ORIGIN}/rest/v1/stores?select=*`],
    ["認証API", `${DUMMY_ORIGIN}/auth/v1/token`],
    ["Next.jsの静的ファイル", "http://localhost:3000/_next/static/chunks/a.js"],
    ["ページ遷移", "http://localhost:3000/search?area=1"],
    ["data URL", "data:image/png;base64,AAAA"],
    ["URLとして不正な文字列", "not a url"],
  ];
  for (const [name, url] of allowed) {
    test(`止めない: ${name}`, () => {
      expect(classify(url)).toBeNull();
    });
  }
});

test.describe("画像通信ガード: SupabaseのURLを取得できない場合（ネットワーク不要）", () => {
  const KEY = "NEXT_PUBLIC_SUPABASE_URL";
  // 同じワーカー内のテストは順番に実行されるため、環境変数を一時的に書き換えても、他のテストには影響しない
  const withEnv = (value: string | undefined, run: () => void) => {
    const before = process.env[KEY];
    try {
      if (value === undefined) {
        delete process.env[KEY];
      } else {
        process.env[KEY] = value;
      }
      run();
    } finally {
      if (before === undefined) {
        delete process.env[KEY];
      } else {
        process.env[KEY] = before;
      }
    }
  };
  const ABORT_MESSAGE =
    "画像通信の停止に必要なSupabaseのURLを取得できないため、テストを中止しました";

  test("URLが空: 画像通信を止める仕組みを使えないため、明示的なエラーにして先へ進めない", () => {
    withEnv("", () => {
      expect(() => createImageRequestClassifierFromEnv()).toThrow(
        ABORT_MESSAGE,
      );
    });
  });

  test("URLの形式が不正: 明示的なエラーになり、環境変数の値はメッセージに含まれない", () => {
    withEnv("not a url at all", () => {
      let message = "";
      try {
        createImageRequestClassifierFromEnv();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(ABORT_MESSAGE);
      expect(message).not.toContain("not a url at all");
    });
  });

  test("プロトコルが http / https ではない: 明示的なエラーになる", () => {
    withEnv("ftp://example.com", () => {
      expect(() => createImageRequestClassifierFromEnv()).toThrow(
        "使えないプロトコル",
      );
    });
    expect(() => createImageRequestClassifier("data:text/plain,hello")).toThrow(
      "使えないプロトコル",
    );
  });

  test("URLが正しい: 判定関数が作られる", () => {
    withEnv(DUMMY_ORIGIN, () => {
      expect(createImageRequestClassifierFromEnv()(STORE_PHOTO)).toBe(
        "direct-storage",
      );
    });
  });
});

test.describe("画像通信ガード: リクエスト単位の判定（ネットワーク不要）", () => {
  const ok: ImageRequestRecord = {
    kind: "next-image",
    label: "/storage/v1/object/public/a.png",
    handledByGuard: true,
    abortInProgress: false,
    abortCompleted: true,
    abortError: null,
    failed: true,
    responseStatus: null,
  };

  test("リクエスト1件の判定: 中止を確認できたものだけが問題なし", () => {
    expect(judgeImageRequest(ok)).toBeNull();
    expect(judgeImageRequest({ ...ok, responseStatus: 200 })).toContain(
      "通信漏れ",
    );
    expect(
      judgeImageRequest({
        ...ok,
        handledByGuard: false,
        abortCompleted: false,
        failed: false,
        responseStatus: 200,
      }),
    ).toContain("通信漏れ");
    expect(judgeImageRequest({ ...ok, handledByGuard: false })).toContain(
      "通っていません",
    );
    // 中止の完了は、route.abort() の完了、または requestfailed のどちらかで確認できればよい
    // （ページ移動で取り消された通信では、requestfailed が発行されないことがある）
    expect(judgeImageRequest({ ...ok, failed: false })).toBeNull();
    expect(judgeImageRequest({ ...ok, abortCompleted: false })).toBeNull();
    // どちらも確認できない場合は、問題あり。route.abort() の失敗理由があれば、メッセージに含める
    expect(
      judgeImageRequest({ ...ok, abortCompleted: false, failed: false }),
    ).toContain("中止の完了");
    expect(
      judgeImageRequest({
        ...ok,
        abortCompleted: false,
        failed: false,
        abortError: "boom",
      }),
    ).toContain("route.abort() が失敗しました: boom");
  });

  test("未完了の判定: 中止の実行中や、ガードの処理待ちは、未完了として扱い、問題ありとはしない", () => {
    expect(isImageRequestPending(ok)).toBe(false);
    // route.abort() の実行中（requestfailed が先に届いていても、未完了）
    const aborting = { ...ok, abortInProgress: true, abortCompleted: false };
    expect(isImageRequestPending(aborting)).toBe(true);
    expect(judgeImageRequest(aborting)).toBeNull();
    // 共通部品のrouteがまだ処理しておらず、失敗も届いていない
    const waiting = {
      ...ok,
      handledByGuard: false,
      abortCompleted: false,
      failed: false,
    };
    expect(isImageRequestPending(waiting)).toBe(true);
    expect(judgeImageRequest(waiting)).toBeNull();
    // 応答が返ったものは、実行中でも未完了ではなく、通信漏れ（結果が決まっている）
    const leaked = { ...aborting, responseStatus: 200 };
    expect(isImageRequestPending(leaked)).toBe(false);
    expect(judgeImageRequest(leaked)).toContain("通信漏れ");
    // route.abort() が失敗して終わったもの（実行中ではない）は、未完了ではなく、問題あり
    const abortFailed = {
      ...ok,
      abortCompleted: false,
      failed: false,
      abortError: "boom",
    };
    expect(isImageRequestPending(abortFailed)).toBe(false);
    expect(judgeImageRequest(abortFailed)).not.toBeNull();
  });

  test("まとめの判定: 通信なし／中止を確認／問題あり／未完了 を区別する", () => {
    expect(summarizeImageRequests([])).toEqual({
      outcome: "no-traffic",
      total: 0,
      pending: [],
      violations: [],
    });
    expect(summarizeImageRequests([ok, ok])).toMatchObject({
      outcome: "blocked",
      total: 2,
      pending: [],
      violations: [],
    });

    // 未完了が1件でも残っていれば、他に問題があっても、結果は未完了（完了を待ってから判定する）
    const pending = summarizeImageRequests([
      ok,
      { ...ok, abortInProgress: true, abortCompleted: false },
      { ...ok, responseStatus: 200 },
    ]);
    expect(pending.outcome).toBe("pending");
    expect(pending.pending).toHaveLength(1);
    expect(pending.pending[0]).toContain("#2");
    expect(pending.violations).toHaveLength(1);

    const mixed = summarizeImageRequests([ok, { ...ok, responseStatus: 200 }]);
    expect(mixed.outcome).toBe("violation");
    expect(mixed.total).toBe(2);
    expect(mixed.violations).toHaveLength(1);
    expect(mixed.violations[0]).toContain("#2");
    expect(mixed.violations[0]).toContain("通信漏れ");
  });
});

test.describe("画像通信ガード: 仕組みの動作確認（疑似通信・ネットワーク不要）", () => {
  const ORIGIN = "http://guard.test";
  const classifyDummy = createImageRequestClassifier(DUMMY_ORIGIN);
  const html = (body: string) => `<!doctype html><meta charset="utf-8">${body}`;

  // 疑似ページ用に、自前のコンテキストとガードを作る（テスト本体のコンテキストには影響しない）
  async function withGuardedPage(
    browser: Browser,
    setup: (page: Page) => Promise<void>,
    run: (page: Page, guard: ImageGuard) => Promise<void>,
  ) {
    const context = await browser.newContext();
    try {
      const guard = await installImageGuard(
        context,
        createImageRequestClassifier(DUMMY_ORIGIN),
      );
      const page = await context.newPage();
      await setup(page);
      await run(page, guard);
    } finally {
      await context.close();
    }
  }

  const imageLoaded = (page: Page, id: string) =>
    page.evaluate(
      (target) =>
        (document.getElementById(target) as HTMLImageElement).naturalWidth > 0,
      id,
    );

  test("通信停止の成功: 3経路（画像変換・直接・preload）がすべて中止され、ローカルのロゴとSupabase以外の画像は止まらない", async ({
    browser,
  }) => {
    await withGuardedPage(
      browser,
      async (page) => {
        await page.route(`${ORIGIN}/**`, async (route) => {
          const { pathname } = new URL(route.request().url());
          if (pathname === "/") {
            await route.fulfill({
              contentType: "text/html",
              body: html(`
                <link rel="preload" as="image" href="${nextImagePath(DISH_PHOTO)}">
                <img id="logo" alt="" width="40" height="20" src="${nextImagePath("/images/logo.png", 256)}">
                <img id="store" alt="" width="40" height="20" src="${nextImagePath(STORE_PHOTO)}">
                <img id="direct" alt="" width="40" height="20" src="${DISH_PHOTO}">
                <img id="other" alt="" width="40" height="20" src="https://other.example.com/a.png">`),
            });
            return;
          }
          // 止める対象は、ここで応答せず、共通部品のrouteへ回す（応答すると、通信漏れになる）
          if (classifyDummy(route.request().url())) {
            await route.fallback();
            return;
          }
          // ローカルのロゴ（止める対象外）は、ここで応答する
          await route.fulfill({ contentType: "image/png", body: DUMMY_PNG });
        });
        await page.route("https://other.example.com/**", (route) =>
          route.fulfill({ contentType: "image/png", body: DUMMY_PNG }),
        );
      },
      async (page, guard) => {
        await page.goto(`${ORIGIN}/`);
        await page.waitForLoadState("networkidle");

        await assertImageGuardClean(guard);
        const summary = guard.summary();
        expect(summary.outcome).toBe("blocked");
        expect(summary.total).toBe(3);
        expect(
          guard
            .records()
            .map((r) => r.kind)
            .sort(),
        ).toEqual(["direct-storage", "next-image", "next-image"]);
        expect(await imageLoaded(page, "logo")).toBe(true);
        expect(await imageLoaded(page, "other")).toBe(true);
        expect(await imageLoaded(page, "store")).toBe(false);
        expect(await imageLoaded(page, "direct")).toBe(false);
      },
    );
  });

  test("通信なし: 止める対象の通信が発生しなかった場合は、通信停止の成功と区別される", async ({
    browser,
  }) => {
    await withGuardedPage(
      browser,
      async (page) => {
        await page.route(`${ORIGIN}/**`, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: html("<p>画像なし</p>"),
          }),
        );
      },
      async (page, guard) => {
        await page.goto(`${ORIGIN}/`);
        await page.waitForLoadState("networkidle");

        expect(guard.summary()).toEqual({
          outcome: "no-traffic",
          total: 0,
          pending: [],
          violations: [],
        });
      },
    );
  });

  test("通信漏れの検知: 中止されずに応答が返った通信を、リクエスト単位で検知して失敗扱いにする", async ({
    browser,
  }) => {
    await withGuardedPage(
      browser,
      async (page) => {
        // ページ単位のrouteは、共通部品のroute（コンテキスト単位）より優先される。
        // これを使って、「中止されずに応答が返ってしまう」状況を、疑似的に作る。
        await page.route(`${ORIGIN}/**`, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: html(`<img alt="" src="${DISH_PHOTO}">`),
          }),
        );
        await page.route(`${DUMMY_ORIGIN}/**`, (route) =>
          route.fulfill({ contentType: "image/png", body: DUMMY_PNG }),
        );
      },
      async (page, guard) => {
        await page.goto(`${ORIGIN}/`);
        await page.waitForLoadState("networkidle");

        expect(guard.summary().outcome).toBe("violation");
        expect(guard.summary().violations[0]).toContain("通信漏れ");
        // 終了時の検査と同じ関数が、実際に例外を投げる（＝テストを失敗させる）
        await expect(assertImageGuardClean(guard)).rejects.toThrow(
          "画像通信の検証に失敗しました",
        );
      },
    );
  });

  test("route.abort() の失敗: 通信は再開されず（擬似サーバーの受信が0件）、原因つきで失敗扱いになる", async ({
    browser,
  }) => {
    let storageHits = 0;
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith("/storage/v1/")) {
        storageHits++;
        res.writeHead(200, { "content-type": "image/png" });
        res.end(DUMMY_PNG);
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        html(
          '<img alt="" width="10" height="10" src="/storage/v1/object/public/a.png">',
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    const context = await browser.newContext();
    try {
      // 判定の対象を、この擬似サーバー（実際の通信先）にして、通信が再開されたかを実測する
      const guard = await installImageGuard(
        context,
        createImageRequestClassifier(origin),
      );
      const page = await context.newPage();
      // 共通部品より先に動くページ単位のrouteで、同じrouteオブジェクトの abort を失敗するものに差し替えてから、
      // 共通部品へ回す（共通部品の、abort失敗時の処理を確認するための再現）
      await page.route(`${origin}/storage/**`, async (route) => {
        route.abort = async () => {
          throw new Error("simulated abort failure");
        };
        await route.fallback();
      });
      await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1_000);

      expect(storageHits, "通信が再開されています").toBe(0);
      expect(guard.summary().outcome).toBe("violation");
      expect(guard.summary().violations[0]).toContain(
        "route.abort() が失敗しました: simulated abort failure",
      );
      await expect(assertImageGuardClean(guard)).rejects.toThrow(
        "画像通信の検証に失敗しました",
      );
    } finally {
      await context.close();
      server.close();
    }
  });

  test("中止の完了待ち: requestfailed が先に届いても、route.abort() が完了するまでは、正常終了と判定しない", async ({
    browser,
  }) => {
    await withGuardedPage(
      browser,
      async (page) => {
        await page.route(`${ORIGIN}/**`, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: html(
              `<img alt="" width="10" height="10" src="${DISH_PHOTO}">`,
            ),
          }),
        );
        // 共通部品より先に動き、route.abort() を「実行はすぐに行い、完了だけを1秒遅らせる」ものに差し替える。
        // これにより、requestfailed は先に届くが、共通部品の route.abort() はまだ完了していない状態になる。
        await page.route(`${DUMMY_ORIGIN}/**`, async (route) => {
          const originalAbort = route.abort.bind(route);
          route.abort = async (errorCode) => {
            await originalAbort(errorCode);
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          };
          await route.fallback();
        });
      },
      async (page, guard) => {
        await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
        await expect
          .poll(() => guard.records().some((r) => r.failed), {
            intervals: [20],
            timeout: 5_000,
          })
          .toBe(true);

        // この時点では、requestfailed は届いているが、route.abort() は完了していない（＝未完了）
        expect(guard.records()[0].abortCompleted).toBe(false);
        expect(guard.summary().outcome).toBe("pending");

        const startedAt = Date.now();
        await assertImageGuardClean(guard);
        expect(
          Date.now() - startedAt,
          "route.abort() の完了を待たずに、正常終了と判定しました",
        ).toBeGreaterThanOrEqual(400);

        expect(guard.records()[0].abortCompleted).toBe(true);
        expect(guard.summary().outcome).toBe("blocked");
      },
    );
  });

  test("中止が完了しない場合: 時間切れで失敗させ、未完了の通信が残っていることを示す", async ({
    browser,
  }) => {
    await withGuardedPage(
      browser,
      async (page) => {
        await page.route(`${ORIGIN}/**`, (route) =>
          route.fulfill({
            contentType: "text/html",
            body: html(
              `<img alt="" width="10" height="10" src="${DISH_PHOTO}">`,
            ),
          }),
        );
        // route.abort() が、いつまでも完了しない状況を作る（abort自体も実行しないため、通信は保留のまま）
        await page.route(`${DUMMY_ORIGIN}/**`, async (route) => {
          route.abort = () => new Promise<void>(() => {});
          await route.fallback();
        });
      },
      async (page, guard) => {
        await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
        await expect.poll(() => guard.records().length).toBe(1);

        const startedAt = Date.now();
        await expect(
          assertImageGuardClean(guard, { timeoutMs: 500 }),
        ).rejects.toThrow("未完了の通信が残っています");
        // 即座には失敗せず、指定した時間（500ミリ秒）に近い間は待ち、無限には待たない
        // （expect.poll は、最後の待ち時間を詰めるため、指定より少し早く終わる）
        const elapsed = Date.now() - startedAt;
        expect(elapsed).toBeGreaterThanOrEqual(300);
        expect(elapsed).toBeLessThan(2_000);
        expect(guard.summary().outcome).toBe("pending");
      },
    );
  });

  // 終了直前の通信の再現用。画像を1枚追加して、通信の発行を待たずに戻る
  // （検査が、通信の発行をまだ受け取っていない状態を作るため）。
  const addImageWithoutWaiting = (page: Page, url: string) =>
    page.evaluate((src) => {
      const img = new Image();
      img.src = src;
      document.body.append(img);
    }, url);

  test("終了直前の通信: 画像を追加した直後（待たずに）に検査しても、通信漏れを検知できる", async ({
    browser,
  }) => {
    // 検査の直前にブラウザとの往復（flush）をしないと、通信の発行が検査に届く前に、
    // 「問題なし」と判定してしまう（擬似ページでは、40回中0回しか検知できなかった）。
    const attempts = 5;
    let detected = 0;
    for (let i = 0; i < attempts; i++) {
      await withGuardedPage(
        browser,
        async (page) => {
          await page.route(`${ORIGIN}/**`, (route) =>
            route.fulfill({
              contentType: "text/html",
              body: html("<p>終了直前</p>"),
            }),
          );
          // ページ単位のrouteで、中止されずに応答が返る状況（＝通信漏れ）を作る
          await page.route(`${DUMMY_ORIGIN}/**`, (route) =>
            route.fulfill({ contentType: "image/png", body: DUMMY_PNG }),
          );
        },
        async (page, guard) => {
          await page.goto(`${ORIGIN}/`);
          await addImageWithoutWaiting(
            page,
            `${DUMMY_ORIGIN}/storage/v1/object/public/late-leak-${i}.png`,
          );
          await assertImageGuardClean(guard, { timeoutMs: 800 }).then(
            () => undefined,
            () => {
              detected++;
            },
          );
        },
      );
    }
    expect(
      detected,
      `終了直前の通信漏れを、${attempts}回中${detected}回しか検知できませんでした（検査の直前の flush が働いていない可能性があります）`,
    ).toBe(attempts);
  });

  test("終了直前の通信: 画像を追加した直後（待たずに）に検査しても、中止の完了を待つ", async ({
    browser,
  }) => {
    // flush がないと、通信の発行が検査に届く前に「問題なし」と判定し、中止の完了を待たない
    // （擬似ページでは、15回中0回しか待たなかった）。
    const attempts = 2;
    const elapsedList: number[] = [];
    for (let i = 0; i < attempts; i++) {
      await withGuardedPage(
        browser,
        async (page) => {
          await page.route(`${ORIGIN}/**`, (route) =>
            route.fulfill({
              contentType: "text/html",
              body: html("<p>終了直前</p>"),
            }),
          );
          // route.abort() の完了を、800ミリ秒遅らせる（abort自体は、すぐに実行する）
          await page.route(`${DUMMY_ORIGIN}/**`, async (route) => {
            const originalAbort = route.abort.bind(route);
            route.abort = async (errorCode) => {
              await originalAbort(errorCode);
              await new Promise((resolve) => setTimeout(resolve, 800));
            };
            await route.fallback();
          });
        },
        async (page, guard) => {
          await page.goto(`${ORIGIN}/`);
          await addImageWithoutWaiting(
            page,
            `${DUMMY_ORIGIN}/storage/v1/object/public/late-abort-${i}.png`,
          );
          const startedAt = Date.now();
          await assertImageGuardClean(guard);
          elapsedList.push(Date.now() - startedAt);
          expect(guard.summary().outcome).toBe("blocked");
        },
      );
    }
    expect(
      Math.min(...elapsedList),
      `中止の完了を待たずに、正常と判定した回があります（検査にかかった時間: ${elapsedList.join("、")}ミリ秒）`,
    ).toBeGreaterThanOrEqual(400);
  });

  test("終了時の検査が自動で働く: 通信漏れを残したテストは、必ず失敗する", async ({
    page,
  }) => {
    // このテストは「失敗すること」を期待している（test.fail）。
    // 失敗しなかった場合（＝自動の検査が働いていない場合）は、このテスト自体が失敗する。
    // テスト本文には、失敗しうる検査を書かない（失敗の原因を、終了時の検査だけにするため）。
    test.fail();

    const leakedUrl = `${getSupabaseOrigin()}/storage/v1/object/public/dummy.png`;
    await page.route(`${ORIGIN}/**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: html(`<img alt="" src="${leakedUrl}">`),
      }),
    );
    // ページ単位のrouteが優先されるため、実際のSupabaseには接続せず、疑似の応答（＝通信漏れ）になる
    await page.route(`${getSupabaseOrigin()}/**`, (route) =>
      route.fulfill({ contentType: "image/png", body: DUMMY_PNG }),
    );
    await page.goto(`${ORIGIN}/`);
    await page.waitForLoadState("networkidle");
  });
});

test.describe("画像通信ガード: 実ページでの稼働確認", () => {
  const expectBlocked = async (guard: ImageGuard, pageName: string) => {
    // 中止の完了を待ってから、結果を確認する（未完了のままの通信を、「止められた」と誤認しないため）
    await assertImageGuardClean(guard);
    const summary = guard.summary();
    expect(
      summary.outcome,
      `${pageName}: Storage画像の通信が発生し、すべて中止された状態になっていません（outcome=${summary.outcome}、通信${summary.total}件）。` +
        `no-trafficの場合は、検証の仕組みが動いていない可能性があります。${summary.violations.join(" / ")}`,
    ).toBe("blocked");
    expect(
      guard.records().some((r) => r.kind === "next-image"),
      `${pageName}: 実アプリの画像通信（/_next/image）が、止める対象の判定と一致していません`,
    ).toBe(true);
  };

  test("U02: 店舗写真の通信が発行され、すべて中止されている。ローカルのロゴは止まっていない", async ({
    page,
    imageGuard,
  }) => {
    await page.goto("/search");
    await page.waitForLoadState("networkidle");

    await expectBlocked(imageGuard, "U02");

    // ローカルのロゴ（取得元が相対パス）は止めていない
    const logo = page.locator('img[src*="thai-temple-logo"]').first();
    await expect
      .poll(
        () =>
          logo.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        { message: "ローカルのロゴが読み込まれていません（止めすぎています）" },
      )
      .toBe(true);
  });

  test("U03: 店舗詳細の外観写真の通信が発行され、すべて中止されている", async ({
    page,
    imageGuard,
  }) => {
    const photos = await fetchAllStorePhotos();
    const exterior = photos.find((p) => p.photo_type === "外観");
    expect(
      exterior,
      "事前条件が失われました: 外観写真が登録されている公開店舗が見つかりません",
    ).toBeDefined();

    await page.goto(`/store/${exterior!.store_id}`);
    await page.waitForLoadState("networkidle");

    await expectBlocked(imageGuard, "U03");
  });
});
