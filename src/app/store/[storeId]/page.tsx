import Image from "next/image";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthStatus } from "@/components/AuthStatus";
import { StoreVisitNote } from "@/components/StoreVisitNote";
import BackToSearchLink from "./BackToSearchLink";
import StoreBasicInfo from "./StoreBasicInfo";
import StoreDishGrid from "./StoreDishGrid";
import StoreInfoRows from "./StoreInfoRows";
import StorePhotoGallery from "./StorePhotoGallery";
import { StoreErrorMessage, StoreNotFoundMessage } from "./StoreStatusMessages";
import styles from "./page.module.css";
import {
  buildSearchHref,
  buildTopHref,
  parsePositiveInt,
  parseSearchConditions,
} from "@/lib/search-conditions";
import { formatPriceForDetail, formatVerifiedDate } from "@/lib/format";
import {
  fetchExteriorPhoto,
  fetchInteriorPhotos,
  fetchMainDishes,
  fetchMainDishPhotos,
  fetchOwnNote,
  fetchStore,
  type Store,
  type StoreFetchResult,
  type StorePhoto,
} from "@/lib/queries/store";

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

export default async function StorePage(props: PageProps<"/store/[storeId]">) {
  const { storeId: rawStoreId } = await props.params;
  const rawSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const storeId = parsePositiveInt(rawStoreId);
  const searchConditions = parseSearchConditions(getParam);
  const { dishId } = searchConditions;

  const result: StoreFetchResult =
    storeId === null ? { status: "invalid_id" } : await fetchStore(storeId);

  const backToSearchHref = buildSearchHref(searchConditions);
  const backToTopHref = buildTopHref(searchConditions);

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
    return <StoreNotFoundMessage backToSearchHref={backToSearchHref} />;
  }

  const renderComError = () => (
    <StoreErrorMessage retryHref={retryHref} backToTopHref={backToTopHref} />
  );

  if (result.status === "error") {
    return renderComError();
  }

  const store = result.store;
  const photoResult = await fetchExteriorPhoto(store.store_id);
  const interiorPhotosResult = await fetchInteriorPhotos(store.store_id);
  const mainDishesResult = await fetchMainDishes(store.store_id);
  const sceneLabels = buildSceneLabels(store);

  const supabaseServer = await createServerSupabaseClient();
  const { data: claimsData } = await supabaseServer.auth.getClaims();
  const currentUserId = claimsData?.claims.sub ?? null;

  const ownNoteResult =
    currentUserId !== null
      ? await fetchOwnNote(supabaseServer, store.store_id)
      : null;

  if (
    photoResult.status === "error" ||
    interiorPhotosResult.status === "error" ||
    mainDishesResult.status === "error" ||
    ownNoteResult?.status === "error"
  ) {
    return renderComError();
  }

  const interiorPhotos = interiorPhotosResult.photos;
  const mainDishes = mainDishesResult.dishes;

  const dishPhotosResult =
    mainDishes.length > 0
      ? await fetchMainDishPhotos(
          store.store_id,
          mainDishes.map((dish) => dish.dish_id),
        )
      : {
          status: "success" as const,
          photoByDishId: new Map<number, StorePhoto>(),
        };

  if (dishPhotosResult.status === "error") {
    return renderComError();
  }

  const dishPhotoByDishId = dishPhotosResult.photoByDishId;

  return (
    <>
      <header className={styles.headerBand}>
        <BackToSearchLink
          storeId={store.store_id}
          href={backToSearchHref}
          className={styles.headerBackLink}
        >
          ← 検索結果に戻る
        </BackToSearchLink>

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

        <AuthStatus />
      </header>

      <div className={styles.pageShell}>
        <div className={styles.page}>
          <BackToSearchLink
            storeId={store.store_id}
            href={backToSearchHref}
            className={styles.backLink}
          >
            ← 検索結果に戻る
          </BackToSearchLink>

          <div className={styles.layoutGrid}>
            <div className={styles.leftColumn}>
              <StorePhotoGallery
                exteriorPhoto={photoResult}
                interiorPhotos={interiorPhotos}
              />

              <StoreDishGrid
                mainDishes={mainDishes}
                dishPhotoByDishId={dishPhotoByDishId}
                selectedDishId={dishId}
              />
            </div>

            <div className={styles.rightColumn}>
              <div className={styles.infoCard}>
                <h1 className={styles.storeName}>{store.store_name}</h1>
                <p className={styles.catchCopy}>{store.catch_copy}</p>

                <StoreInfoRows
                  sceneLabels={sceneLabels}
                  spiceSupportText={store.spice_support_text}
                  reservationText={store.reservation_text}
                  seatTypeText={store.seat_type_text}
                />

                <div className={styles.atmosphereItem}>
                  <h2 className={styles.sectionHeading}>お店の雰囲気</h2>
                  <p className={styles.atmosphereText}>
                    {store.atmosphere_text}
                  </p>
                </div>

                <div className={styles.basicInfoSection}>
                  <StoreBasicInfo
                    address={store.address}
                    nearestStationName={store.nearest_station_name}
                    walkMinutes={store.walk_minutes}
                    hasLunch={store.has_lunch}
                    hasDinner={store.has_dinner}
                    lunchHours={store.lunch_hours}
                    dinnerHours={store.dinner_hours}
                    regularHoliday={store.regular_holiday}
                    lunchPriceText={formatPriceForDetail(
                      store.lunch_price_from,
                    )}
                    dinnerPriceText={formatPriceForDetail(
                      store.dinner_price_from,
                    )}
                    phoneNumber={store.phone_number}
                  />

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

                {currentUserId !== null && ownNoteResult && (
                  <div className={styles.noteSection}>
                    <StoreVisitNote
                      storeId={store.store_id}
                      initialNoteText={ownNoteResult.noteText}
                    />
                  </div>
                )}

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
