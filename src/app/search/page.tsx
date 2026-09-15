import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";
import ScrollRestorer from "./ScrollRestorer";
import StoreDetailLink from "./StoreDetailLink";
import {
  CheckIcon,
  ForkKnifeIcon,
  MoonIcon,
  PencilIcon,
  PersonIcon,
  PinIcon,
  SunIcon,
  WalkIcon,
} from "./SearchIcons";

type SceneValue = "solo" | "date" | "friends" | "family";
type TimeValue = "lunch" | "dinner";

const SCENE_COLUMN: Record<SceneValue, string> = {
  solo: "scene_solo",
  date: "scene_date",
  friends: "scene_friends",
  family: "scene_family",
};

const TIME_LABEL: Record<TimeValue, string> = {
  lunch: "ランチ",
  dinner: "ディナー",
};

const SCENE_LABEL: Record<SceneValue, string> = {
  solo: "ひとり",
  date: "デート",
  friends: "友人",
  family: "家族",
};

type Store = {
  store_id: number;
  store_name: string;
  nearest_station_name: string;
  walk_minutes: number;
  has_lunch: boolean;
  lunch_hours: string | null;
  lunch_price_from: number | null;
  has_dinner: boolean;
  dinner_hours: string | null;
  dinner_price_from: number | null;
  scene_solo: boolean;
  scene_date: boolean;
  scene_friends: boolean;
  scene_family: boolean;
};

function formatPrice(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `¥${value.toLocaleString()}〜`;
}

const DAY_PREFIX = /^(月|火|水|木|金|土|日|祝|平日)/;

// U02一覧表示用に、営業時間文字列からL.O.等の括弧内補足情報を除き、
// 曜日ごとに区切られている場合は先頭の区分(通常は平日)だけを残す。
// DBの値(store.lunch_hours / dinner_hours)自体は変更しない。
// 曜日区分と確信できない区切り(例: 2部制の案内など)がある場合は、
// 誤って情報を落とさないよう括弧の除去だけ行い、区切りには触れない。
function formatHoursForList(value: string | null): string | null {
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

function buildSceneText(store: Store): string | null {
  const scenes: string[] = [];
  if (store.scene_solo) {
    scenes.push("ひとり");
  }
  if (store.scene_date) {
    scenes.push("デート");
  }
  if (store.scene_friends) {
    scenes.push("友人");
  }
  if (store.scene_family) {
    scenes.push("家族");
  }
  return scenes.length > 0 ? scenes.join("・") : null;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  if (!/^[1-9][0-9]*$/.test(value)) {
    return null;
  }
  return Number(value);
}

function parseTime(value: string | undefined): TimeValue | null {
  return value === "lunch" || value === "dinner" ? value : null;
}

function parseScene(value: string | undefined): SceneValue | null {
  return value === "solo" ||
    value === "date" ||
    value === "friends" ||
    value === "family"
    ? value
    : null;
}

export default async function SearchPage(props: PageProps<"/search">) {
  const rawSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const areaId = parsePositiveInt(getParam("area_id"));
  const time = parseTime(getParam("time"));
  const scene = parseScene(getParam("scene"));
  const dishId = parsePositiveInt(getParam("dish_id"));

  let areaName: string | null = null;
  if (areaId !== null) {
    const { data } = await supabase
      .from("areas")
      .select("area_name")
      .eq("area_id", areaId)
      .single();
    areaName = data?.area_name ?? null;
  }

  let dishName: string | null = null;
  if (dishId !== null) {
    const { data } = await supabase
      .from("dishes")
      .select("dish_name")
      .eq("dish_id", dishId)
      .single();
    dishName = data?.dish_name ?? null;
  }

  let matchedStoreIds: number[] | null = null;
  if (dishId !== null) {
    const { data } = await supabase
      .from("store_dishes")
      .select("store_id")
      .eq("dish_id", dishId)
      .eq("is_available", true);
    matchedStoreIds = (data ?? []).map((row) => row.store_id);
  }

  let stores: Store[] = [];

  const shouldSkipQuery = dishId !== null && matchedStoreIds?.length === 0;

  if (!shouldSkipQuery) {
    let query = supabase
      .from("stores")
      .select(
        "store_id, store_name, nearest_station_name, walk_minutes, has_lunch, lunch_hours, lunch_price_from, has_dinner, dinner_hours, dinner_price_from, scene_solo, scene_date, scene_friends, scene_family"
      )
      .eq("is_published", true);

    if (areaId !== null) {
      query = query.eq("area_id", areaId);
    }
    if (time === "lunch") {
      query = query.eq("has_lunch", true);
    }
    if (time === "dinner") {
      query = query.eq("has_dinner", true);
    }
    if (scene !== null) {
      query = query.eq(SCENE_COLUMN[scene], true);
    }
    if (matchedStoreIds !== null) {
      query = query.in("store_id", matchedStoreIds);
    }

    const { data } = await query
      .order("walk_minutes", { ascending: true })
      .order("store_id", { ascending: true });

    stores = data ?? [];
  }

  const storeIds = stores.map((store) => store.store_id);

  type StoreDishRow = {
    store_id: number;
    dish_id: number;
    display_order: number;
  };

  let storeDishRows: StoreDishRow[] = [];
  if (storeIds.length > 0) {
    const { data } = await supabase
      .from("store_dishes")
      .select("store_id, dish_id, display_order")
      .in("store_id", storeIds)
      .eq("is_available", true)
      .order("store_id", { ascending: true })
      .order("display_order", { ascending: true });
    storeDishRows = data ?? [];
  }

  const dishIdsInResults = Array.from(
    new Set(storeDishRows.map((row) => row.dish_id))
  );

  let dishNameById = new Map<number, string>();
  if (dishIdsInResults.length > 0) {
    const { data } = await supabase
      .from("dishes")
      .select("dish_id, dish_name")
      .in("dish_id", dishIdsInResults);
    dishNameById = new Map(
      (data ?? []).map((row) => [row.dish_id, row.dish_name])
    );
  }

  const dishesByStore = new Map<
    number,
    { dish_id: number; dish_name: string; display_order: number }[]
  >();
  for (const row of storeDishRows) {
    const list = dishesByStore.get(row.store_id) ?? [];
    list.push({
      dish_id: row.dish_id,
      dish_name: dishNameById.get(row.dish_id) ?? "",
      display_order: row.display_order,
    });
    dishesByStore.set(row.store_id, list);
  }

  type StorePhoto = { photoUrl: string; altText: string | null };

  const photoByStore = new Map<number, StorePhoto>();
  if (storeIds.length > 0) {
    const { data } = await supabase
      .from("store_photos")
      .select("store_id, photo_url, alt_text, display_order")
      .in("store_id", storeIds)
      .eq("photo_type", "料理")
      .order("store_id", { ascending: true })
      .order("display_order", { ascending: true });

    for (const row of data ?? []) {
      if (!photoByStore.has(row.store_id)) {
        photoByStore.set(row.store_id, {
          photoUrl: row.photo_url,
          altText: row.alt_text,
        });
      }
    }
  }

  const storeDisplayInfo = stores.map((store) => {
    const dishes = dishesByStore.get(store.store_id) ?? [];
    const photo = photoByStore.get(store.store_id) ?? null;

    let otherDishText: string | null = null;
    let mainDishText: string | null = null;

    if (dishId !== null) {
      const other = dishes.find((dish) => dish.dish_id !== dishId);
      otherDishText = other ? `ほかにも：${other.dish_name}` : null;
    } else {
      const main = dishes.slice(0, 2);
      mainDishText =
        main.length > 0
          ? `主な料理：${main.map((dish) => dish.dish_name).join("・")}`
          : null;
    }

    const lunchInfo =
      (time === "lunch" || time === null) && store.has_lunch
        ? {
            hours: formatHoursForList(store.lunch_hours),
            priceText: formatPrice(store.lunch_price_from),
          }
        : null;

    const dinnerInfo =
      (time === "dinner" || time === null) && store.has_dinner
        ? {
            hours: formatHoursForList(store.dinner_hours),
            priceText: formatPrice(store.dinner_price_from),
          }
        : null;

    const sceneText = buildSceneText(store);

    return {
      ...store,
      photo,
      otherDishText,
      mainDishText,
      lunchInfo,
      dinnerInfo,
      sceneText,
    };
  });

  const hasAnyCondition = areaName !== null || time !== null || scene !== null || dishName !== null;

  const conditionTagsNode = hasAnyCondition ? (
    <div className={styles.tagRow}>
      {areaName && (
        <span className={`${styles.tag} ${styles.areaTag}`}>
          <PinIcon className={styles.iconAccent} />
          {areaName}
          <CheckIcon className={styles.tagCheck} />
        </span>
      )}
      {time && (
        <span className={styles.tag}>
          {time === "lunch" ? (
            <SunIcon className={styles.iconAccent} />
          ) : (
            <MoonIcon className={styles.iconMoon} />
          )}
          {TIME_LABEL[time]}
          <CheckIcon className={styles.tagCheck} />
        </span>
      )}
      {scene && (
        <span className={styles.tag}>
          <PersonIcon className={styles.iconAccent} />
          {SCENE_LABEL[scene]}
          <CheckIcon className={styles.tagCheck} />
        </span>
      )}
      {dishName && (
        <span className={styles.tag}>
          <ForkKnifeIcon className={styles.iconAccent} />
          {dishName}
          <CheckIcon className={styles.tagCheck} />
        </span>
      )}
    </div>
  ) : null;

  const backToTopParams = new URLSearchParams();
  if (areaId !== null) {
    backToTopParams.set("area_id", String(areaId));
  }
  if (time !== null) {
    backToTopParams.set("time", time);
  }
  if (scene !== null) {
    backToTopParams.set("scene", scene);
  }
  if (dishId !== null) {
    backToTopParams.set("dish_id", String(dishId));
  }
  const backToTopQuery = backToTopParams.toString();
  const backToTopHref = backToTopQuery ? `/?${backToTopQuery}` : "/";

  const detailParams = new URLSearchParams();
  if (areaId !== null) {
    detailParams.set("area_id", String(areaId));
  }
  if (time !== null) {
    detailParams.set("time", time);
  }
  if (scene !== null) {
    detailParams.set("scene", scene);
  }
  if (dishId !== null) {
    detailParams.set("dish_id", String(dishId));
  }
  const detailQuery = detailParams.toString();

  const topActionsNode = (
    <div className={styles.topActions}>
      <Link href={backToTopHref} className={styles.changeButton}>
        <PencilIcon className={styles.buttonIcon} />
        条件を変更する
      </Link>
    </div>
  );

  return (
    <>
      <header className={styles.headerBand} data-page="search">
        <div className={styles.headerInner}>
          <Image
            src="/images/thai-temple-logo-v2.png"
            alt=""
            width={1536}
            height={1024}
            priority
            className={styles.headerLogoIcon}
          />
          <span className={styles.headerLogoText}>THAI TABE TOKYO</span>
        </div>
      </header>

      <div className={styles.page}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>検索結果</h1>
          <p className={styles.count}>
            条件に合うお店が
            <span className={styles.countNumber}>{stores.length}</span>
            件見つかりました
          </p>
        </div>

        <div className={styles.conditionsBlock}>
          <span className={styles.conditionsLabel}>選択中の条件</span>
          {conditionTagsNode}
          {topActionsNode}
        </div>

        <div className={styles.storeGrid}>
        {storeDisplayInfo.map((store) => (
          <div key={store.store_id} className={styles.card}>
            <div className={styles.photoWrapper}>
              {store.photo ? (
                <Image
                  src={store.photo.photoUrl}
                  alt={store.photo.altText ?? store.store_name}
                  fill
                  sizes="(max-width: 767px) 100vw, 33vw"
                  className={styles.photo}
                />
              ) : (
                <div className={styles.photoPlaceholder}>料理写真準備中</div>
              )}
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.storeName}>{store.store_name}</h3>

              <div className={styles.infoRow}>
                <WalkIcon className={styles.iconAccent} />
                <span>
                  {store.nearest_station_name} 徒歩{store.walk_minutes}分
                </span>
              </div>

              {(store.lunchInfo || store.dinnerInfo) && (
                <div className={styles.hoursRow}>
                  {store.lunchInfo && (
                    <span className={styles.hoursItem}>
                      <SunIcon className={styles.iconAccent} />
                      {store.lunchInfo.hours}
                      {store.lunchInfo.priceText && (
                        <span className={styles.priceText}>
                          {store.lunchInfo.priceText}
                        </span>
                      )}
                    </span>
                  )}
                  {store.dinnerInfo && (
                    <span className={styles.hoursItem}>
                      <MoonIcon className={styles.iconMoon} />
                      {store.dinnerInfo.hours}
                      {store.dinnerInfo.priceText && (
                        <span className={styles.priceText}>
                          {store.dinnerInfo.priceText}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

              {(store.sceneText || store.otherDishText || store.mainDishText) && (
                <div className={styles.infoRow}>
                  {store.sceneText && (
                    <span className={styles.hoursItem}>
                      <PersonIcon className={styles.iconAccent} />
                      {store.sceneText}
                    </span>
                  )}
                  {(store.otherDishText || store.mainDishText) && (
                    <span className={styles.hoursItem}>
                      <ForkKnifeIcon className={styles.iconAccent} />
                      {store.otherDishText ?? store.mainDishText}
                    </span>
                  )}
                </div>
              )}

              <StoreDetailLink
                href={
                  detailQuery
                    ? `/store/${store.store_id}?${detailQuery}`
                    : `/store/${store.store_id}`
                }
              />
            </div>
          </div>
        ))}
        </div>
      </div>

      <ScrollRestorer />
    </>
  );
}
