import Image from "next/image";
import styles from "./page.module.css";
import type { MainDish, StorePhoto } from "@/lib/queries/store";

type StoreDishGridProps = {
  mainDishes: MainDish[];
  dishPhotoByDishId: Map<number, StorePhoto>;
  selectedDishId: number | null;
};

export default function StoreDishGrid({
  mainDishes,
  dishPhotoByDishId,
  selectedDishId,
}: StoreDishGridProps) {
  if (mainDishes.length === 0) {
    return null;
  }

  return (
    <div className={styles.dishSection}>
      <h2 className={styles.sectionHeading}>食べられる主な料理</h2>
      <div className={styles.dishGrid}>
        {mainDishes.map((dish) => {
          const dishPhoto = dishPhotoByDishId.get(dish.dish_id);
          const isMatched =
            selectedDishId !== null && dish.dish_id === selectedDishId;
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
  );
}
