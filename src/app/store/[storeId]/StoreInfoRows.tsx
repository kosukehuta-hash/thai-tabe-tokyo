import Image from "next/image";
import { PersonIcon } from "@/components/SearchIcons";
import styles from "./page.module.css";

type StoreInfoRowsProps = {
  sceneLabels: string[];
  spiceSupportText: string | null;
  reservationText: string | null;
  seatTypeText: string | null;
};

export default function StoreInfoRows({
  sceneLabels,
  spiceSupportText,
  reservationText,
  seatTypeText,
}: StoreInfoRowsProps) {
  return (
    <div className={styles.infoRows}>
      {sceneLabels.length > 0 && (
        <div className={styles.infoRow}>
          <PersonIcon className={styles.infoRowIcon} />
          <span className={styles.infoRowLabel}>利用シーン</span>
          <span className={styles.infoRowValue}>{sceneLabels.join("・")}</span>
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
          {spiceSupportText?.trim() ? spiceSupportText : "未確認"}
        </span>
      </div>

      {reservationText !== null && (
        <div className={styles.infoRow}>
          <Image
            src="/images/store-reservation-icon.png"
            alt=""
            width={32}
            height={32}
            className={styles.infoRowIconImage}
          />
          <span className={styles.infoRowLabel}>予約</span>
          <span className={styles.infoRowValue}>{reservationText}</span>
        </div>
      )}

      {seatTypeText !== null && (
        <div className={styles.infoRow}>
          <Image
            src="/images/store-seat-icon.png"
            alt=""
            width={32}
            height={32}
            className={styles.infoRowIconImage}
          />
          <span className={styles.infoRowLabel}>席のタイプ</span>
          <span className={styles.infoRowValue}>{seatTypeText}</span>
        </div>
      )}
    </div>
  );
}
