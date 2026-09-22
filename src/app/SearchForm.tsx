"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  buildSearchHref,
  type SceneValue,
  type TimeValue,
} from "@/lib/search-conditions";
import type { Area, Dish } from "./page";
import styles from "./page.module.css";

const ALL_DISHES_IMAGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/thai-tabe-images/dishes/all-dishes.png`;

const TIME_OPTIONS: { value: TimeValue; label: string }[] = [
  { value: "lunch", label: "ランチ" },
  { value: "dinner", label: "ディナー" },
];

const SCENE_OPTIONS: { value: SceneValue; label: string }[] = [
  { value: "solo", label: "ひとり" },
  { value: "date", label: "デート" },
  { value: "friends", label: "友人" },
  { value: "family", label: "家族" },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.searchIcon} aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"
      />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${styles.icon} ${styles.areaIcon}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

function TimeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${styles.icon} ${styles.timeIcon}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7v5l3.5 2.1"
      />
    </svg>
  );
}

function DishIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${styles.icon} ${styles.dishLabelIcon}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3.8 3h1.8v6H3.8zM6.8 3h1.8v6H6.8zM9.8 3h1.8v6H9.8zM3.8 9H11.6L8.6 13H6.8ZM6.8 13h1.8v9H6.8zM18 3c-1.1 0-2 1.34-2 3v6c0 1.66.9 3 2 3v6h2V3z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className={styles.checkIcon} aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
      />
    </svg>
  );
}

function CheckBadgeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.checkBadgeIcon}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
      />
    </svg>
  );
}

type ConditionBoxProps<T> = {
  icon: ReactNode;
  label: string;
  options: { value: T; label: string }[];
  selectedValue: T | null;
  onSelect: (value: T | null) => void;
  optionsClassName?: string;
};

function ConditionBox<T extends string | number>({
  icon,
  label,
  options,
  selectedValue,
  onSelect,
  optionsClassName,
}: ConditionBoxProps<T>) {
  return (
    <div className={styles.conditionBox}>
      <div className={styles.conditionLabel}>
        {icon}
        <span>{label}</span>
      </div>
      <div className={`${styles.conditionOptions} ${optionsClassName ?? ""}`}>
        <button
          type="button"
          className={`${styles.optionButton} ${
            selectedValue === null ? styles.optionButtonSelected : ""
          }`}
          aria-pressed={selectedValue === null}
          onClick={() => onSelect(null)}
        >
          すべて
          {selectedValue === null && (
            <span className={styles.checkBadge}>
              <CheckBadgeIcon />
            </span>
          )}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.optionButton} ${
              selectedValue === option.value ? styles.optionButtonSelected : ""
            }`}
            aria-pressed={selectedValue === option.value}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
            {selectedValue === option.value && (
              <span className={styles.checkBadge}>
                <CheckBadgeIcon />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

type SearchFormProps = {
  areas: Area[];
  dishes: Dish[];
  initialAreaId: number | null;
  initialTime: TimeValue | null;
  initialScene: SceneValue | null;
  initialDishId: number | null;
};

export default function SearchForm({
  areas,
  dishes,
  initialAreaId,
  initialTime,
  initialScene,
  initialDishId,
}: SearchFormProps) {
  const router = useRouter();

  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(
    initialAreaId,
  );
  const [selectedTime, setSelectedTime] = useState<TimeValue | null>(
    initialTime,
  );
  const [selectedScene, setSelectedScene] = useState<SceneValue | null>(
    initialScene,
  );
  const [selectedDishId, setSelectedDishId] = useState<number | null>(
    initialDishId,
  );

  function handleReset() {
    setSelectedAreaId(null);
    setSelectedTime(null);
    setSelectedScene(null);
    setSelectedDishId(null);
  }

  function handleSearch() {
    router.push(
      buildSearchHref({
        areaId: selectedAreaId,
        time: selectedTime,
        scene: selectedScene,
        dishId: selectedDishId,
      }),
    );
  }

  return (
    <>
      <div className={styles.conditionList}>
        <ConditionBox
          icon={<AreaIcon />}
          label="場所から選ぶ"
          options={areas.map((area) => ({
            value: area.area_id,
            label: area.area_name,
          }))}
          selectedValue={selectedAreaId}
          onSelect={setSelectedAreaId}
          optionsClassName={styles.areaOptions}
        />

        <ConditionBox
          icon={<TimeIcon />}
          label="時間帯から選ぶ"
          options={TIME_OPTIONS}
          selectedValue={selectedTime}
          onSelect={setSelectedTime}
          optionsClassName={styles.timeOptions}
        />

        <ConditionBox
          icon={
            <Image
              src="/images/scene-icon-v4.png"
              alt=""
              width={53}
              height={43}
              className={styles.sceneIconImage}
            />
          }
          label="利用シーンから選ぶ"
          options={SCENE_OPTIONS}
          selectedValue={selectedScene}
          onSelect={setSelectedScene}
        />

        <div className={styles.dishBox}>
          <div className={`${styles.conditionLabel} ${styles.dishLabel}`}>
            <DishIcon />
            <span>食べたい料理から選ぶ</span>
          </div>
          <div className={styles.dishGrid}>
            {dishes.map((dish) => (
              <button
                key={dish.dish_id}
                type="button"
                className={`${styles.dishCard} ${
                  selectedDishId === dish.dish_id ? styles.dishCardSelected : ""
                }`}
                aria-pressed={selectedDishId === dish.dish_id}
                onClick={() => setSelectedDishId(dish.dish_id)}
              >
                <span className={styles.dishImageWrapper}>
                  {dish.search_image_url && (
                    <Image
                      src={dish.search_image_url}
                      alt={dish.dish_name}
                      fill
                      sizes="(max-width: 767px) 45vw, 220px"
                      className={styles.dishImage}
                    />
                  )}
                  {selectedDishId === dish.dish_id && (
                    <span className={styles.dishCheck}>
                      <CheckIcon />
                    </span>
                  )}
                </span>
                <span className={styles.dishName}>{dish.dish_name}</span>
                <span className={styles.dishDescription}>
                  {dish.description}
                </span>
              </button>
            ))}
            <button
              type="button"
              className={`${styles.dishCard} ${
                selectedDishId === null ? styles.dishCardSelected : ""
              }`}
              aria-pressed={selectedDishId === null}
              onClick={() => setSelectedDishId(null)}
            >
              <span className={styles.dishImageWrapper}>
                <Image
                  src={ALL_DISHES_IMAGE_URL}
                  alt="すべて"
                  fill
                  sizes="(max-width: 767px) 45vw, 220px"
                  className={styles.dishImage}
                />
                {selectedDishId === null && (
                  <span className={styles.dishCheck}>
                    <CheckIcon />
                  </span>
                )}
              </span>
              <span className={styles.dishName}>すべて</span>
              <span className={styles.dishDescription}>料理を指定しない</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.searchButton}
          onClick={handleSearch}
        >
          <SearchIcon />
          店舗を検索する
        </button>
        <button
          type="button"
          className={styles.resetLink}
          onClick={handleReset}
        >
          条件をリセット
        </button>
      </div>
    </>
  );
}
