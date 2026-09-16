import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";
import { PersonIcon } from "../../search/SearchIcons";

type TimeValue = "lunch" | "dinner";
type SceneValue = "solo" | "date" | "friends" | "family";

type Store = {
  store_id: number;
  store_name: string;
  catch_copy: string;
  scene_solo: boolean;
  scene_date: boolean;
  scene_friends: boolean;
  scene_family: boolean;
  spice_support_text: string | null;
  reservation_text: string | null;
  seat_type_text: string | null;
  atmosphere_text: string;
  address: string;
  nearest_station_name: string;
  walk_minutes: number;
  has_lunch: boolean;
  lunch_hours: string | null;
  lunch_price_from: number | null;
  has_dinner: boolean;
  dinner_hours: string | null;
  dinner_price_from: number | null;
  regular_holiday: string | null;
  phone_number: string | null;
  map_url: string;
  official_site_url: string | null;
  last_verified_on: string;
  is_published: boolean;
};

type StoreFetchResult =
  | { status: "invalid_id" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "found"; store: Store };

async function fetchStore(storeId: number): Promise<StoreFetchResult> {
  const { data, error } = await supabase
    .from("stores")
    .select(
      "store_id, store_name, catch_copy, scene_solo, scene_date, scene_friends, scene_family, spice_support_text, reservation_text, seat_type_text, atmosphere_text, address, nearest_station_name, walk_minutes, has_lunch, lunch_hours, lunch_price_from, has_dinner, dinner_hours, dinner_price_from, regular_holiday, phone_number, map_url, official_site_url, last_verified_on, is_published"
    )
    .eq("store_id", storeId)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    return { status: "error" };
  }
  if (!data) {
    return { status: "not_found" };
  }
  return { status: "found", store: data };
}

type StorePhoto = {
  photo_url: string;
  alt_text: string;
};

type PhotoFetchResult =
  | { status: "error" }
  | { status: "empty" }
  | { status: "found"; photo: StorePhoto };

async function fetchExteriorPhoto(storeId: number): Promise<PhotoFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("photo_url, alt_text")
    .eq("store_id", storeId)
    .eq("photo_type", "外観")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { status: "error" };
  }
  if (!data) {
    return { status: "empty" };
  }
  return { status: "found", photo: data };
}

type InteriorPhotosFetchResult =
  | { status: "error" }
  | { status: "success"; photos: StorePhoto[] };

async function fetchInteriorPhotos(
  storeId: number
): Promise<InteriorPhotosFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("photo_url, alt_text, display_order")
    .eq("store_id", storeId)
    .eq("photo_type", "店内")
    .order("display_order", { ascending: true });

  if (error) {
    return { status: "error" };
  }
  return { status: "success", photos: (data ?? []).slice(0, 2) };
}

type MainDish = {
  dish_id: number;
  dish_name: string;
  description: string;
};

type MainDishesFetchResult =
  | { status: "error" }
  | { status: "success"; dishes: MainDish[] };

async function fetchMainDishes(storeId: number): Promise<MainDishesFetchResult> {
  const { data: storeDishRows, error: storeDishError } = await supabase
    .from("store_dishes")
    .select("store_id, dish_id, display_order, is_available")
    .eq("store_id", storeId)
    .eq("is_available", true)
    .order("display_order", { ascending: true })
    .limit(6);

  if (storeDishError) {
    return { status: "error" };
  }

  const orderedRows = storeDishRows ?? [];
  if (orderedRows.length === 0) {
    return { status: "success", dishes: [] };
  }

  const dishIds = orderedRows.map((row) => row.dish_id);

  const { data: dishRows, error: dishError } = await supabase
    .from("dishes")
    .select("dish_id, dish_name, description")
    .in("dish_id", dishIds);

  if (dishError) {
    return { status: "error" };
  }

  const dishById = new Map<
    number,
    { dish_name: string; description: string }
  >();
  for (const dish of dishRows ?? []) {
    dishById.set(dish.dish_id, {
      dish_name: dish.dish_name,
      description: dish.description,
    });
  }

  const dishes: MainDish[] = orderedRows
    .map((row) => {
      const dish = dishById.get(row.dish_id);
      return dish
        ? { dish_id: row.dish_id, dish_name: dish.dish_name, description: dish.description }
        : null;
    })
    .filter((dish): dish is MainDish => dish !== null);

  return { status: "success", dishes };
}

type DishPhotosFetchResult =
  | { status: "error" }
  | { status: "success"; photoByDishId: Map<number, StorePhoto> };

async function fetchMainDishPhotos(
  storeId: number,
  dishIds: number[]
): Promise<DishPhotosFetchResult> {
  const { data, error } = await supabase
    .from("store_photos")
    .select("dish_id, photo_url, alt_text, display_order")
    .eq("store_id", storeId)
    .eq("photo_type", "料理")
    .in("dish_id", dishIds)
    .order("display_order", { ascending: true });

  if (error) {
    return { status: "error" };
  }

  const photoByDishId = new Map<number, StorePhoto>();
  for (const row of data ?? []) {
    if (row.dish_id === null || photoByDishId.has(row.dish_id)) {
      continue;
    }
    photoByDishId.set(row.dish_id, {
      photo_url: row.photo_url,
      alt_text: row.alt_text,
    });
  }

  return { status: "success", photoByDishId };
}

function formatPrice(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `${value.toLocaleString()}円〜`;
}

function formatVerifiedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function buildSceneLabels(store: Store): string[] {
  const labels: string[] = [];
  if (store.scene_solo) {
    labels.push("ひとり");
  }
  if (store.scene_date) {
    labels.push("デート");
  }
  if (store.scene_friends) {
    labels.push("友人");
  }
  if (store.scene_family) {
    labels.push("家族");
  }
  return labels;
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

function buildQuery(params: {
  areaId: number | null;
  time: TimeValue | null;
  scene: SceneValue | null;
  dishId: number | null;
}): string {
  const query = new URLSearchParams();
  if (params.areaId !== null) {
    query.set("area_id", String(params.areaId));
  }
  if (params.time !== null) {
    query.set("time", params.time);
  }
  if (params.scene !== null) {
    query.set("scene", params.scene);
  }
  if (params.dishId !== null) {
    query.set("dish_id", String(params.dishId));
  }
  return query.toString();
}

export default async function StorePage(props: PageProps<"/store/[storeId]">) {
  const { storeId: rawStoreId } = await props.params;
  const rawSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const storeId = parsePositiveInt(rawStoreId);
  const areaId = parsePositiveInt(getParam("area_id"));
  const time = parseTime(getParam("time"));
  const scene = parseScene(getParam("scene"));
  const dishId = parsePositiveInt(getParam("dish_id"));

  const result: StoreFetchResult =
    storeId === null ? { status: "invalid_id" } : await fetchStore(storeId);

  const conditionQuery = buildQuery({ areaId, time, scene, dishId });
  const backToSearchHref = conditionQuery
    ? `/search?${conditionQuery}`
    : "/search";
  const backToTopHref = conditionQuery ? `/?${conditionQuery}` : "/";

  const retryQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        retryQuery.append(key, v);
      }
    } else if (value !== undefined) {
      retryQuery.set(key, value);
    }
  }
  const retryQueryString = retryQuery.toString();
  const retryHref = retryQueryString
    ? `/store/${rawStoreId}?${retryQueryString}`
    : `/store/${rawStoreId}`;

  if (result.status === "invalid_id" || result.status === "not_found") {
    return (
      <div className={styles.pageShell}>
        <div className={styles.page}>
          <p className={styles.message}>
            お探しの店舗情報を表示できませんでした。
          </p>
          <Link href={backToSearchHref} scroll={false} className={styles.actionLink}>
            検索結果に戻る
          </Link>
        </div>
      </div>
    );
  }

  const renderComError = () => (
    <div className={styles.pageShell}>
      <div className={styles.page}>
        <p className={styles.message}>
          情報を取得できませんでした。もう一度お試しください
        </p>
        <div className={styles.actions}>
          <Link href={retryHref} className={styles.actionLink}>
            再試行
          </Link>
          <Link href={backToTopHref} className={styles.actionLink}>
            条件選択へ戻る
          </Link>
        </div>
      </div>
    </div>
  );

  if (result.status === "error") {
    return renderComError();
  }

  const store = result.store;
  const photoResult = await fetchExteriorPhoto(store.store_id);
  const interiorPhotosResult = await fetchInteriorPhotos(store.store_id);
  const mainDishesResult = await fetchMainDishes(store.store_id);
  const sceneLabels = buildSceneLabels(store);

  if (
    photoResult.status === "error" ||
    interiorPhotosResult.status === "error" ||
    mainDishesResult.status === "error"
  ) {
    return renderComError();
  }

  const interiorPhotos = interiorPhotosResult.photos;
  const mainDishes = mainDishesResult.dishes;

  const dishPhotosResult =
    mainDishes.length > 0
      ? await fetchMainDishPhotos(
          store.store_id,
          mainDishes.map((dish) => dish.dish_id)
        )
      : { status: "success" as const, photoByDishId: new Map<number, StorePhoto>() };

  if (dishPhotosResult.status === "error") {
    return renderComError();
  }

  const dishPhotoByDishId = dishPhotosResult.photoByDishId;

  return (
    <>
      <header className={styles.headerBand}>
        <Link
          href={backToSearchHref}
          scroll={false}
          className={styles.headerBackLink}
        >
          ← 検索結果に戻る
        </Link>

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

      <div className={styles.pageShell}>
      <div className={styles.page}>
        <Link
          href={backToSearchHref}
          scroll={false}
          className={styles.backLink}
        >
          ← 検索結果に戻る
        </Link>

        <div className={styles.layoutGrid}>
        <div className={styles.leftColumn}>
        <div className={styles.photoRow}>
        <div className={styles.photoArea}>
          {photoResult.status === "found" ? (
            <Image
              src={photoResult.photo.photo_url}
              alt={photoResult.photo.alt_text}
              fill
              sizes="(max-width: 767px) 100vw, 45vw"
              className={styles.photo}
            />
          ) : (
            <span className={styles.photoPlaceholderText}>店舗写真準備中</span>
          )}
        </div>

        {interiorPhotos.length > 0 && (
          <div className={styles.interiorPhotoList}>
            {interiorPhotos.map((photo) => (
              <div key={photo.photo_url} className={styles.interiorPhotoArea}>
                <Image
                  src={photo.photo_url}
                  alt={photo.alt_text}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className={styles.photo}
                />
              </div>
            ))}
          </div>
        )}
        </div>

      {mainDishes.length > 0 && (
        <div className={styles.dishSection}>
          <h2 className={styles.sectionHeading}>食べられる主な料理</h2>
          <div className={styles.dishGrid}>
            {mainDishes.map((dish) => {
              const dishPhoto = dishPhotoByDishId.get(dish.dish_id);
              const isMatched = dishId !== null && dish.dish_id === dishId;
              return (
                <div key={dish.dish_id} className={styles.dishCard}>
                  <div className={styles.dishPhotoArea}>
                    {dishPhoto ? (
                      <Image
                        src={dishPhoto.photo_url}
                        alt={dishPhoto.alt_text}
                        fill
                        sizes="(max-width: 767px) 50vw, 33vw"
                        className={styles.photo}
                      />
                    ) : (
                      <span className={styles.photoPlaceholderText}>
                        料理写真準備中
                      </span>
                    )}
                  </div>
                  {isMatched && (
                    <div className={styles.matchTag}>
                      <span className={styles.matchTagStripe} />
                      <span className={styles.matchTagLabel}>条件一致</span>
                    </div>
                  )}
                  <p className={styles.dishName}>{dish.dish_name}</p>
                  <p className={styles.dishDescription}>{dish.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>

        <div className={styles.rightColumn}>
        <div className={styles.infoCard}>
          <h1 className={styles.storeName}>{store.store_name}</h1>
          <p className={styles.catchCopy}>{store.catch_copy}</p>

          <div className={styles.infoRows}>
            {sceneLabels.length > 0 && (
              <div className={styles.infoRow}>
                <PersonIcon className={styles.infoRowIcon} />
                <span className={styles.infoRowLabel}>利用シーン</span>
                <span className={styles.infoRowValue}>
                  {sceneLabels.join("・")}
                </span>
              </div>
            )}

            <div className={styles.infoRow}>
              <Image
                src="/images/store-spice-icon.png"
                alt=""
                width={32}
                height={32}
                className={styles.infoRowIconImage}
              />
              <span className={styles.infoRowLabel}>辛さ対応</span>
              <span className={styles.infoRowValue}>
                {store.spice_support_text?.trim()
                  ? store.spice_support_text
                  : "未確認"}
              </span>
            </div>

            {store.reservation_text !== null && (
              <div className={styles.infoRow}>
                <Image
                  src="/images/store-reservation-icon.png"
                  alt=""
                  width={32}
                  height={32}
                  className={styles.infoRowIconImage}
                />
                <span className={styles.infoRowLabel}>予約</span>
                <span className={styles.infoRowValue}>
                  {store.reservation_text}
                </span>
              </div>
            )}

            {store.seat_type_text !== null && (
              <div className={styles.infoRow}>
                <Image
                  src="/images/store-seat-icon.png"
                  alt=""
                  width={32}
                  height={32}
                  className={styles.infoRowIconImage}
                />
                <span className={styles.infoRowLabel}>席のタイプ</span>
                <span className={styles.infoRowValue}>
                  {store.seat_type_text}
                </span>
              </div>
            )}
          </div>

          <div className={styles.atmosphereItem}>
            <h2 className={styles.sectionHeading}>お店の雰囲気</h2>
            <p className={styles.atmosphereText}>{store.atmosphere_text}</p>
          </div>

          <div className={styles.basicInfoSection}>
            <h2 className={styles.sectionHeading}>店舗基本情報</h2>
            <dl className={styles.basicInfoList}>
              <div className={styles.basicInfoItem}>
                <dt className={styles.infoLabel}>住所</dt>
                <dd className={styles.infoValue}>{store.address}</dd>
              </div>

              <div className={styles.basicInfoItem}>
                <dt className={styles.infoLabel}>最寄り駅</dt>
                <dd className={styles.infoValue}>
                  {store.nearest_station_name}から徒歩{store.walk_minutes}分
                </dd>
              </div>

              {(store.has_lunch || store.has_dinner) && (
                <div className={styles.basicInfoItem}>
                  <dt className={styles.infoLabel}>営業時間</dt>
                  <dd className={styles.infoValue}>
                    {store.has_lunch && store.lunch_hours !== null && (
                      <span className={styles.hoursLine}>
                        {store.has_dinner ? "ランチ " : ""}
                        {store.lunch_hours}
                      </span>
                    )}
                    {store.has_dinner && store.dinner_hours !== null && (
                      <span className={styles.hoursLine}>
                        {store.has_lunch ? "ディナー " : ""}
                        {store.dinner_hours}
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {store.regular_holiday !== null && (
                <div className={styles.basicInfoItem}>
                  <dt className={styles.infoLabel}>定休日</dt>
                  <dd className={styles.infoValue}>{store.regular_holiday}</dd>
                </div>
              )}

              {(store.has_lunch || store.has_dinner) && (
                <div className={styles.basicInfoItem}>
                  <dt className={styles.infoLabel}>価格帯</dt>
                  <dd className={styles.infoValue}>
                    {store.has_lunch && store.lunch_price_from !== null && (
                      <span className={styles.hoursLine}>
                        {store.has_dinner ? "ランチ " : ""}
                        {formatPrice(store.lunch_price_from)}
                      </span>
                    )}
                    {store.has_dinner && store.dinner_price_from !== null && (
                      <span className={styles.hoursLine}>
                        {store.has_lunch ? "ディナー " : ""}
                        {formatPrice(store.dinner_price_from)}
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {store.phone_number !== null && (
                <div className={styles.basicInfoItem}>
                  <dt className={styles.infoLabel}>電話番号</dt>
                  <dd className={styles.infoValue}>{store.phone_number}</dd>
                </div>
              )}
            </dl>

            <div className={styles.externalLinks}>
              <a
                href={store.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
              >
                地図を見る
              </a>

              {store.official_site_url !== null && (
                <a
                  href={store.official_site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.externalLink}
                >
                  公式サイトを見る
                </a>
              )}
            </div>
          </div>

          <p className={styles.disclaimer}>
            掲載情報は、確認できた内容のみ表示しています。
            <br />
            最終確認日：{formatVerifiedDate(store.last_verified_on)}
            <br />
            最新情報は公式サイト等でご確認ください。
          </p>
        </div>
        </div>
      </div>
      </div>
      </div>
    </>
  );
}
