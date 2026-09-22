import styles from "./page.module.css";
import {
  CheckIcon,
  ForkKnifeIcon,
  MoonIcon,
  PersonIcon,
  PinIcon,
  SunIcon,
} from "@/components/SearchIcons";
import type { SceneValue, TimeValue } from "@/lib/search-conditions";

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

type StoreConditionTagsProps = {
  areaName: string | null;
  time: TimeValue | null;
  scene: SceneValue | null;
  dishName: string | null;
};

export default function StoreConditionTags({
  areaName,
  time,
  scene,
  dishName,
}: StoreConditionTagsProps) {
  const hasAnyCondition =
    areaName !== null || time !== null || scene !== null || dishName !== null;

  if (!hasAnyCondition) {
    return null;
  }

  return (
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
  );
}
