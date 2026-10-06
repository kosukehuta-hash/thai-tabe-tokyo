export function formatPriceForList(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `¥${value.toLocaleString()}〜`;
}

export function formatPriceForDetail(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `${value.toLocaleString()}円〜`;
}

const DAY_PREFIX = /^(月|火|水|木|金|土|日|祝|平日)/;

// U02一覧表示用に、営業時間文字列からL.O.等の括弧内補足情報を除き、
// 曜日ごとに区切られている場合は先頭の区分(通常は平日)だけを残す。
// DBの値(store.lunch_hours / dinner_hours)自体は変更しない。
// 曜日区分と確信できない区切り(例: 2部制の案内など)がある場合は、
// 誤って情報を落とさないよう括弧の除去だけ行い、区切りには触れない。
export function formatHoursForList(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const withoutNotes = value.replace(/（[^（）]*）/g, "").trim();
  if (!withoutNotes) {
    return null;
  }

  const segments = withoutNotes
    .split(/[／、]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length <= 1) {
    return withoutNotes;
  }

  const isDaySplit = segments.every((segment) => DAY_PREFIX.test(segment));
  return isDaySplit ? "曜日により営業時間が異なります" : withoutNotes;
}

export function formatVerifiedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

const jstDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// 日時文字列(ISO 8601)を、実行環境のタイムゾーンに関係なく日本時間(JST)で
// 「YYYY年M月D日 HH:mm」形式に整形する。
export function formatDateTimeJst(value: string): string {
  const parts = jstDateTimeFormatter.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}
