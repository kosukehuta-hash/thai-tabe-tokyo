import Image from "next/image";
import styles from "./page.module.css";
import type { PhotoFetchResult, StorePhoto } from "@/lib/queries/store";

type StorePhotoGalleryProps = {
  exteriorPhoto: PhotoFetchResult;
  interiorPhotos: StorePhoto[];
};

export default function StorePhotoGallery({
  exteriorPhoto,
  interiorPhotos,
}: StorePhotoGalleryProps) {
  return (
    <div className={styles.photoRow}>
      <div className={styles.photoArea}>
        {exteriorPhoto.status === "found" ? (
          <Image
            src={exteriorPhoto.photo.photo_url}
            alt={exteriorPhoto.photo.alt_text}
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
  );
}
