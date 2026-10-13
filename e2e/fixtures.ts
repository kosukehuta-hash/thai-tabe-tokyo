import {
  test as base,
  expect,
  type BrowserContext,
  type Request,
} from "@playwright/test";
import { getSupabaseOrigin } from "./supabase-data";

// E2Eのテストは、必ずこのファイルから test / expect / 型を import する。
// このファイルを経由しないと、本番Supabase Storageの画像通信を止める仕組みと、
// その検証が働かない（eslint.config.mjs で、e2e/ 配下から @playwright/test の直接 import を禁止している）。
// 同名の export（test）は、下で定義したものが優先される。
// browser.newContext() で自前にコンテキストを作る場合は、installImageGuard() を呼んで同じ保護を適用すること。
export * from "@playwright/test";

/** 止める対象の通信の種類 */
export type BlockedImageKind = "next-image" | "direct-storage";

/**
 * 止める対象の通信を判定する関数。対象なら種類を、対象外なら null を返す。
 * 対象外: ローカルの画像（ヘッダーロゴなど）、Supabase以外の画像、DB・認証のAPI、ページ遷移など。
 */
export type ImageRequestClassifier = (
  rawUrl: string,
) => BlockedImageKind | null;

/**
 * 止める対象 = 指定したSupabaseのオリジンの Storage（/storage/v1/）への通信だけ。
 * - "direct-storage": そのStorageへの直接アクセス（preload や <img src> も含む）
 * - "next-image": Next.js の画像変換（/_next/image）のうち、取得元（url の値）がそのStorageを指すもの
 * 取得元の形式は、DBの photo_url（絶対URL）と、Next.js の既定ローダー
 * （/_next/image?url=<encodeURIComponent(元URL)>&w=…&q=…）に合わせている。
 */
export function createImageRequestClassifier(
  supabaseOrigin: string,
): ImageRequestClassifier {
  const parsed = new URL(supabaseOrigin);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    // data: や file: などだと、オリジンが "null" になり、正しく判定できないため
    throw new Error(
      `Supabaseのオリジンとして使えないプロトコルです（${parsed.protocol}）`,
    );
  }
  const origin = parsed.origin;
  const isStorageUrl = (url: URL) =>
    url.origin === origin && url.pathname.startsWith("/storage/v1/");

  return (rawUrl) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }

    if (isStorageUrl(url)) {
      return "direct-storage";
    }

    if (url.pathname === "/_next/image") {
      let source: URL;
      try {
        // 相対パス（ローカルの画像）や、"//" 始まり（Next.js側が拒否する形式）は、ここで解釈できず対象外になる
        source = new URL(url.searchParams.get("url") ?? "");
      } catch {
        return null;
      }
      return isStorageUrl(source) ? "next-image" : null;
    }

    return null;
  };
}

/**
 * 環境変数（または .env.local）のSupabaseのURLから、判定関数を作る。
 * URLを取得できない場合は、画像通信を止める仕組みを使えないため、明示的なエラーにして、テストを先へ進めない。
 * （止めずに進めると、本番Supabase Storageから画像を取得するおそれがある）
 */
export function createImageRequestClassifierFromEnv(): ImageRequestClassifier {
  try {
    return createImageRequestClassifier(getSupabaseOrigin());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "原因不明";
    throw new Error(
      "画像通信の停止に必要なSupabaseのURLを取得できないため、テストを中止しました。" +
        `止めずに進めると、本番Supabase Storageから画像を取得するおそれがあります。原因: ${reason}`,
    );
  }
}

/** 止める対象のリクエスト1件ごとの記録 */
export type ImageRequestRecord = {
  kind: BlockedImageKind;
  /** 表示用の名前（ホストは含めない） */
  label: string;
  /** 共通部品の route が処理した */
  handledByGuard: boolean;
  /** 共通部品が route.abort() を実行中（まだ完了も失敗もしていない） */
  abortInProgress: boolean;
  /** 共通部品が route.abort() を完了した（ブラウザ側で、通信を行わずに失敗させた） */
  abortCompleted: boolean;
  /** route.abort() が失敗した場合の、エラーメッセージ（1行目のみ） */
  abortError: string | null;
  /** ブラウザ側で通信が成立せずに終了した（requestfailed）。ページ移動で取り消された場合などは、発行されないことがある */
  failed: boolean;
  /** レスポンスが返った場合のHTTPステータス（返らなければ null） */
  responseStatus: number | null;
};

/**
 * リクエスト1件が「未完了」（まだ結果が決まっていない）かを返す。
 * 未完了 = 応答が返っておらず、かつ、次のどちらか。
 * - 共通部品が route.abort() を実行中（完了も失敗もしていない）
 * - 共通部品のrouteがまだ処理しておらず、通信の失敗（requestfailed）も届いていない
 * 未完了の間は、「止められた」とも「漏れた」とも判定せず、完了を待つ。
 */
export function isImageRequestPending(record: ImageRequestRecord): boolean {
  if (record.responseStatus !== null) {
    return false;
  }
  return record.abortInProgress || (!record.handledByGuard && !record.failed);
}

/**
 * リクエスト1件を判定する。問題がなければ null、問題があれば理由を返す。
 * 未完了のもの（isImageRequestPending）は、まだ結果が決まっていないため、問題ありとはせず null を返す
 * （未完了の扱いは、summarizeImageRequests と assertImageGuardClean が行う）。
 * 「中止された」と言えるのは、共通部品が処理し、中止の完了（route.abort() の完了、または requestfailed）を確認でき、
 * レスポンスが返っていない場合だけ。
 * 画像の読み込みに失敗したことだけでは、「通信がなかった」とも「止められた」とも判定しない。
 * route.abort() が失敗しても、Playwrightはそのリクエストを再開しない（保留のままになる）ため、通信は発生しない。
 * ただし、中止を確認できないので、ここでは問題ありとして扱い、テストを失敗させる。
 */
export function judgeImageRequest(record: ImageRequestRecord): string | null {
  if (record.responseStatus !== null) {
    return `通信漏れ: 応答が返りました（HTTP ${record.responseStatus}）`;
  }
  if (isImageRequestPending(record)) {
    return null;
  }
  if (!record.handledByGuard) {
    return "共通部品のrouteを通っていません（止められていません）";
  }
  if (!record.abortCompleted && !record.failed) {
    const cause = record.abortError
      ? `。route.abort() が失敗しました: ${record.abortError}`
      : "";
    return `中止の完了（route.abort() の完了、または requestfailed）を確認できません${cause}`;
  }
  return null;
}

export type ImageGuardSummary = {
  /**
   * - "pending": 未完了の通信が残っている（結果はまだ決まっていない）
   * - "no-traffic": 止める対象の通信が1件も発生しなかった
   * - "blocked": 1件以上発生し、すべて中止を確認できた
   * - "violation": 1件以上、中止を確認できないものがある（未完了の通信はない）
   */
  outcome: "pending" | "no-traffic" | "blocked" | "violation";
  total: number;
  /** 未完了の通信の説明（完了するまで待つ対象。空であれば、結果が決まっている） */
  pending: string[];
  violations: string[];
};

export function summarizeImageRequests(
  records: ImageRequestRecord[],
): ImageGuardSummary {
  const label = (record: ImageRequestRecord, index: number) =>
    `#${index + 1} [${record.kind}] ${record.label}`;
  const pending = records.flatMap((record, index) =>
    isImageRequestPending(record)
      ? [`${label(record, index)}: 中止がまだ完了していません`]
      : [],
  );
  const violations = records.flatMap((record, index) => {
    const reason = judgeImageRequest(record);
    return reason ? [`${label(record, index)}: ${reason}`] : [];
  });
  const outcome =
    pending.length > 0
      ? "pending"
      : violations.length > 0
        ? "violation"
        : records.length === 0
          ? "no-traffic"
          : "blocked";
  return { outcome, total: records.length, pending, violations };
}

export type ImageGuard = {
  records: () => ImageRequestRecord[];
  summary: () => ImageGuardSummary;
  /** ブラウザがすでに発行した通信のイベントを、先に取り込む（検査の直前に呼ぶ） */
  flush: () => Promise<void>;
};

function describeRequestUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const source =
      url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
    return new URL(source ?? rawUrl).pathname;
  } catch {
    return "(URLを解釈できません)";
  }
}

/** コンテキストに、止める対象の通信の中止と、リクエスト単位の記録を設定する。 */
export async function installImageGuard(
  context: BrowserContext,
  classify: ImageRequestClassifier,
): Promise<ImageGuard> {
  const recordsByRequest = new Map<Request, ImageRequestRecord>();

  // 対象のリクエストだけ、記録を作る（対象外は null）。イベントの順序に左右されないよう、どこからでも呼べる。
  const recordOf = (request: Request): ImageRequestRecord | null => {
    const existing = recordsByRequest.get(request);
    if (existing) {
      return existing;
    }
    const kind = classify(request.url());
    if (!kind) {
      return null;
    }
    const created: ImageRequestRecord = {
      kind,
      label: describeRequestUrl(request.url()),
      handledByGuard: false,
      abortInProgress: false,
      abortCompleted: false,
      abortError: null,
      failed: false,
      responseStatus: null,
    };
    recordsByRequest.set(request, created);
    return created;
  };

  context.on("request", (request) => {
    recordOf(request);
  });
  context.on("requestfailed", (request) => {
    const record = recordOf(request);
    if (record) {
      record.failed = true;
    }
  });
  context.on("response", (response) => {
    const record = recordOf(response.request());
    if (record) {
      record.responseStatus = response.status();
    }
  });
  await context.route(
    (url) => classify(url.href) !== null,
    async (route) => {
      const record = recordOf(route.request());
      if (record) {
        record.handledByGuard = true;
        // route.abort() が完了（または失敗）するまでは、未完了として扱う
        record.abortInProgress = true;
      }
      try {
        await route.abort();
        if (record) {
          record.abortCompleted = true;
        }
      } catch (error) {
        // 例外をそのまま投げると、未処理の拒否になるため、ここで記録して握りつぶす。
        // abort に失敗したリクエストは、Playwrightが再開しない（保留のまま）ので、通信は発生しない。
        // 中止を確認できない状態として、終了時の検査でテストを失敗させる。
        if (record) {
          record.abortError = (
            error instanceof Error ? error.message : String(error)
          )
            .split("\n")[0]
            .slice(0, 200);
        }
      } finally {
        if (record) {
          record.abortInProgress = false;
        }
      }
    },
  );

  const records = () => [...recordsByRequest.values()];
  // 開いているページに対して、ブラウザとの往復を1回行う。往復の前にブラウザが発行したイベント
  // （通信の発行など）は、往復の応答より先にこちらへ届くため、検査の前に取り込める。
  // 効果: テストの終了直前に発生した通信は、これがないと、検査の最初の確認までに届かず、
  //   通信漏れや未完了を見逃す。擬似ページで確認済み（画像を追加した直後に検査した場合の、通信漏れの検知は
  //   あり 40/40・なし 0/40、中止の完了待ちはあり 15/15・なし 0/15）。image-guard.spec.ts の
  //   「終了直前の通信」のテストが、この効果を確認している（この処理を消すと、そのテストが失敗する）。
  // 限界: ブラウザがまだ発行していない通信は、取り込めない。実アプリでの効果は未確認。
  //   なお、通信そのものの中止は、この処理とは無関係に、ガードのrouteが行う（これは、検査の精度のための処理）。
  // ページが応答しない場合に備え、1ページあたり1秒で打ち切り、失敗にはせず先へ進む（判定は、この後の検査が行う）。
  const flush = async () => {
    await Promise.all(
      context
        .pages()
        .map((page) =>
          Promise.race([
            page.evaluate(() => undefined).catch(() => undefined),
            new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
          ]),
        ),
    );
  };
  return { records, summary: () => summarizeImageRequests(records()), flush };
}

/**
 * 通信の中止がすべて完了するのを待ってから、通信漏れ・中止失敗がないことを検査する。
 * - 未完了の通信（isImageRequestPending）が残っている間は、正常終了と判定しない。
 * - 未完了が timeoutMs（既定3秒）のうちに解消しない場合は、未完了の通信を示して失敗させる。
 * - 未完了がなくなってから、通信漏れ・中止失敗（violations）を検査し、1件でもあれば失敗させる。
 */
export async function assertImageGuardClean(
  guard: ImageGuard,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  await guard.flush();
  await expect
    .poll(() => guard.summary().pending, {
      message:
        "画像通信の中止が完了しないまま、時間切れになりました（未完了の通信が残っています）",
      // 確認間隔を短くして、中止の完了を、すぐに検知する（既定の間隔は、最大1秒まで広がるため）
      intervals: [20, 50, 100],
      timeout: options.timeoutMs ?? 3_000,
    })
    .toEqual([]);
  expect(guard.summary().violations, "画像通信の検証に失敗しました").toEqual(
    [],
  );
}

export const test = base.extend<{ imageGuard: ImageGuard }>({
  // 全テストで自動的に有効になる（auto: true）。テスト本文は何も変えなくてよい。
  imageGuard: [
    async ({ context }, provide) => {
      const guard = await installImageGuard(
        context,
        createImageRequestClassifierFromEnv(),
      );
      await provide(guard);
      // テスト終了時の検査。問題があれば、テストを失敗させる。
      await assertImageGuardClean(guard);
    },
    { auto: true },
  ],
});
