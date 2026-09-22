import Image from "next/image";
import { AuthStatus } from "@/components/AuthStatus";
import { parseSearchConditions } from "@/lib/search-conditions";
import {
  getActiveAreas,
  getActiveU01Dishes,
  type MasterArea,
  type MasterDish,
} from "@/lib/queries/masters";
import SearchForm from "./SearchForm";
import styles from "./page.module.css";

export type Area = MasterArea;

export type Dish = MasterDish;

export default async function Home(props: PageProps<"/">) {
  const rawSearchParams = await props.searchParams;

  const getParam = (key: string): string | undefined => {
    const value = rawSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { areaId, time, scene, dishId } = parseSearchConditions(getParam);

  const [areas, dishes] = await Promise.all([
    getActiveAreas(),
    getActiveU01Dishes(),
  ]);

  const initialAreaId =
    areaId !== null && areas.some((area) => area.area_id === areaId)
      ? areaId
      : null;
  const initialDishId =
    dishId !== null && dishes.some((dish) => dish.dish_id === dishId)
      ? dishId
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.topSection}>
        <div className={styles.headerBand}>
          <span className={styles.logo}>
            <Image
              src="/images/thai-temple-logo-v2.png"
              alt=""
              width={1536}
              height={1024}
              priority
              className={styles.logoIcon}
            />
            THAI TABE TOKYO
          </span>
          <AuthStatus />
        </div>

        <div className={styles.heroBand}>
          <Image
            src="/images/hero-left-decoration.png"
            alt=""
            width={1448}
            height={1086}
            aria-hidden="true"
            className={`${styles.heroDecoration} ${styles.heroDecorationLeft}`}
          />
          <h1 className={styles.message}>
            東京で、食べたい
            <span className={styles.messageKeep}>タイ料理店</span>
            を見つけよう
          </h1>
          <p className={styles.description}>
            エリアや利用シーン、食べたい料理を選んで、今の気分に合うタイ料理店を探せます。
          </p>
          <Image
            src="/images/hero-right-decoration.png"
            alt=""
            width={1448}
            height={1086}
            aria-hidden="true"
            className={`${styles.heroDecoration} ${styles.heroDecorationRight}`}
          />
        </div>
      </div>

      <main className={styles.searchSection}>
        <SearchForm
          areas={areas}
          dishes={dishes}
          initialAreaId={initialAreaId}
          initialTime={time}
          initialScene={scene}
          initialDishId={initialDishId}
        />
      </main>
    </div>
  );
}
