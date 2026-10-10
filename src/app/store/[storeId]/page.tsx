import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthStatus } from "@/components/AuthStatus";
import { HeaderHomeLink } from "@/components/HeaderHomeLink";
import { FavoriteButton } from "@/components/FavoriteButton";
import { StoreVisitNote } from "@/components/StoreVisitNote";
import BackToSearchLink from "./BackToSearchLink";
import StoreBasicInfo from "./StoreBasicInfo";
import StoreDishGrid from "./StoreDishGrid";
import StoreInfoRows from "./StoreInfoRows";
import StorePhotoGallery from "./StorePhotoGallery";
import { StoreErrorMessage } from "./StoreStatusMessages";
import styles from "./page.module.css";
import {
  buildSearchHref,
  buildTopHref,
  parsePositiveInt,
  parseSearchConditions,
} from "@/lib/search-conditions";
import {
  LIST_ORIGIN_PARAM,
  getListOriginTarget,
  parseListOrigin,
} from "@/lib/list-origin";
import { formatPriceForDetail, formatVerifiedDate } from "@/lib/format";
import { getSceneLabels } from "@/lib/scene-labels";
import { fetchIsFavorite } from "@/lib/queries/favorites";
import {
  fetchExteriorPhoto,
  fetchInteriorPhotos,
  fetchMainDishes,
  fetchMainDishPhotos,
  fetchOwnNote,
  fetchStore,
  type StoreFetchResult,
  type StorePhoto,
} from "@/lib/queries/store";

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

  // メモ一覧・お気に入りから来た場合（from=notes / from=favorites）だけ、戻りリンクを元の一覧へ向ける。
  // 戻り先は固定の対応表から決め、from が無効な値のときは従来の「検索結果に戻る」にする
  const listOrigin = parseListOrigin(getParam(LIST_ORIGIN_PARAM));
  const listOriginTarget =
    listOrigin === null ? null : getListOriginTarget(listOrigin);

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
    notFound();
  }

  const renderComError = () => (
    <StoreErrorMessage retryHref={retryHref} backToTopHref={backToTopHref} />
  );

  if (result.status === "error") {
    return renderComError();
  }

  const store = result.store;
  const sceneLabels = getSceneLabels(store);

  const supabaseServer = await createServerSupabaseClient();

  // 外観写真・店内写真・主要料理・認証claimsはstore_idのみ（または無関係）に依存し、
  // 互いの結果を参照しないため並列実行する。
  const [photoResult, interiorPhotosResult, mainDishesResult, claimsResult] =
    await Promise.all([
      fetchExteriorPhoto(store.store_id),
      fetchInteriorPhotos(store.store_id),
      fetchMainDishes(store.store_id),
      supabaseServer.auth.getClaims(),
    ]);

  const currentUserId = claimsResult.data?.claims.sub ?? null;

  if (
    photoResult.status === "error" ||
    interiorPhotosResult.status === "error" ||
    mainDishesResult.status === "error"
  ) {
    return renderComError();
  }

  const interiorPhotos = interiorPhotosResult.photos;
  const mainDishes = mainDishesResult.dishes;

  // 自分のメモ取得・お気に入り状態の取得・料理写真取得は、それぞれ上記の結果
  // （currentUserId／mainDishes）にのみ依存し、互いの結果を参照しないため並列実行する。
  const [ownNoteResult, favoriteResult, dishPhotosResult] = await Promise.all([
    currentUserId !== null
      ? fetchOwnNote(supabaseServer, store.store_id)
      : Promise.resolve(null),
    currentUserId !== null
      ? fetchIsFavorite(supabaseServer, store.store_id)
      : Promise.resolve(null),
    mainDishes.length > 0
      ? fetchMainDishPhotos(
          store.store_id,
          mainDishes.map((dish) => dish.dish_id),
        )
      : Promise.resolve({
          status: "success" as const,
          photoByDishId: new Map<number, StorePhoto>(),
        }),
  ]);

  if (
    ownNoteResult?.status === "error" ||
    favoriteResult?.status === "error" ||
    dishPhotosResult.status === "error"
  ) {
    return renderComError();
  }

  const dishPhotoByDishId = dishPhotosResult.photoByDishId;

  // 戻りリンク（ヘッダーと本文の2か所）。
  // 一覧から来た場合は、履歴（router.back()）に頼らず、固定の /notes または /favorites への通常のリンクにする。
  // それ以外（検索結果から来た場合・直接アクセス・無効な from）は、従来の「検索結果に戻る」
  const renderBackLink = (className: string) =>
    listOriginTarget !== null ? (
      <Link href={listOriginTarget.href} className={className}>
        {`← ${listOriginTarget.label}に戻る`}
      </Link>
    ) : (
      <BackToSearchLink
        storeId={store.store_id}
        href={backToSearchHref}
        className={className}
      >
        ← 検索結果に戻る
      </BackToSearchLink>
    );

  return (
    <>
      <header className={styles.headerBand}>
        {renderBackLink(styles.headerBackLink)}

        <HeaderHomeLink
          className={`${styles.headerInner} ${styles.headerHomeLink}`}
          logoIconClassName={styles.headerLogoIcon}
          logoTextClassName={styles.headerLogoText}
        />

        <AuthStatus />
      </header>

      <div className={styles.pageShell}>
        <div className={styles.page}>
          {renderBackLink(styles.backLink)}

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
                <div className={styles.storeHeader}>
                  <h1 className={styles.storeName}>{store.store_name}</h1>
                  {currentUserId !== null && favoriteResult && (
                    <FavoriteButton
                      storeId={store.store_id}
                      initialIsFavorite={favoriteResult.isFavorite}
                    />
                  )}
                </div>
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
