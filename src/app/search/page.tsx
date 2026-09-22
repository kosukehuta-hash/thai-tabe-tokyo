import Image from "next/image";
import Link from "next/link";
import { AuthStatus } from "@/components/AuthStatus";
import styles from "./page.module.css";
import ScrollRestorer from "./ScrollRestorer";
import StoreCard from "./StoreCard";
import StoreConditionTags from "./StoreConditionTags";
import { PencilIcon } from "@/components/SearchIcons";
import { buildTopHref, parseSearchConditions } from "@/lib/search-conditions";
import { formatHoursForList, formatPriceForList } from "@/lib/format";
import {
  fetchSearchResults,
  type SearchQueryResult,
  type Store,
  type StorePhoto,
} from "@/lib/queries/search";

export type StoreDisplayInfo = Store & {
  photo: StorePhoto | null;
  otherDishText: string | null;
  mainDishText: string | null;
  lunchInfo: { hours: string | null; priceText: string | null } | null;
  dinnerInfo: { hours: string | null; priceText: string | null } | null;
  sceneText: string | null;
};

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

export default async function SearchPage(props: PageProps<"/search">) {
  const rawSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { areaId, time, scene, dishId } = parseSearchConditions(getParam);

  const {
    areaName,
    validatedAreaId,
    dishName,
    validatedDishId,
    stores,
    dishesByStore,
    photoByStore,
  }: SearchQueryResult = await fetchSearchResults({
    areaId,
    time,
    scene,
    dishId,
  });

  const storeDisplayInfo: StoreDisplayInfo[] = stores.map((store) => {
    const dishes = dishesByStore.get(store.store_id) ?? [];
    const photo = photoByStore.get(store.store_id) ?? null;

    let otherDishText: string | null = null;
    let mainDishText: string | null = null;

    if (validatedDishId !== null) {
      const other = dishes.find((dish) => dish.dish_id !== validatedDishId);
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
            priceText: formatPriceForList(store.lunch_price_from),
          }
        : null;

    const dinnerInfo =
      (time === "dinner" || time === null) && store.has_dinner
        ? {
            hours: formatHoursForList(store.dinner_hours),
            priceText: formatPriceForList(store.dinner_price_from),
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

  const searchConditions = {
    areaId: validatedAreaId,
    time,
    scene,
    dishId: validatedDishId,
  };
  const backToTopHref = buildTopHref(searchConditions);

  return (
    <>
      <header className={styles.headerBand} data-page="search">
        <Link
          href={backToTopHref}
          className={`${styles.changeButton} ${styles.headerChangeButton}`}
        >
          <PencilIcon className={styles.buttonIcon} />
          条件を変更する
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

        <AuthStatus />
      </header>

      <div className={styles.page}>
        <Link
          href={backToTopHref}
          className={`${styles.changeButton} ${styles.topChangeButtonMobile}`}
        >
          <PencilIcon className={styles.buttonIcon} />
          条件を変更する
        </Link>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>検索結果</h1>
          <p className={styles.count}>
            {stores.length === 0 ? (
              "条件に合うお店が見つかりませんでした"
            ) : (
              <>
                条件に合うお店が
                <span className={styles.countNumber}>{stores.length}</span>
                件見つかりました
              </>
            )}
          </p>
        </div>

        <div className={styles.conditionsBlock}>
          <span className={styles.conditionsLabel}>選択中の条件</span>
          <StoreConditionTags
            areaName={areaName}
            time={time}
            scene={scene}
            dishName={dishName}
          />
        </div>

        <div className={styles.storeGrid}>
          {storeDisplayInfo.map((store) => (
            <StoreCard
              key={store.store_id}
              store={store}
              isDishSelected={validatedDishId !== null}
              searchConditions={searchConditions}
            />
          ))}
        </div>
      </div>

      <ScrollRestorer searchConditions={searchConditions} />
    </>
  );
}
