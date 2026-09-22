import Image from "next/image";
import styles from "./page.module.css";
import StoreDetailLink from "./StoreDetailLink";
import {
  ForkKnifeIcon,
  MoonIcon,
  PersonIcon,
  SunIcon,
  WalkIcon,
} from "@/components/SearchIcons";
import { buildStoreHref, type SearchConditions } from "@/lib/search-conditions";
import type { StoreDisplayInfo } from "./page";

// U02「すべて」選択時の外観画像のみに適用する、店舗ごとのobject-position縦位置調整。
// 未指定の店舗は既定値(center center)のまま。
const EXTERIOR_PHOTO_POSITION_BY_STORE: Record<number, string> = {
  11: "center 40%",
  21: "center 40%",
  34: "center 40%",
  6: "center 40%",
  27: "center 20%",
  40: "center 20%",
  1: "center 20%",
};

type StoreCardProps = {
  store: StoreDisplayInfo;
  isDishSelected: boolean;
  searchConditions: SearchConditions;
};

export default function StoreCard({
  store,
  isDishSelected,
  searchConditions,
}: StoreCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.photoWrapper}>
        {store.photo ? (
          <Image
            src={store.photo.photoUrl}
            alt={store.photo.altText ?? store.store_name}
            fill
            sizes="(max-width: 767px) 100vw, 33vw"
            className={styles.photo}
            style={
              !isDishSelected
                ? {
                    objectPosition:
                      EXTERIOR_PHOTO_POSITION_BY_STORE[store.store_id] ??
                      "center",
                  }
                : undefined
            }
          />
        ) : (
          <div className={styles.photoPlaceholder}>
            {!isDishSelected ? "店舗写真準備中" : "料理写真準備中"}
          </div>
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
          href={buildStoreHref(store.store_id, searchConditions)}
          storeId={store.store_id}
          searchConditions={searchConditions}
        />
      </div>
    </div>
  );
}
