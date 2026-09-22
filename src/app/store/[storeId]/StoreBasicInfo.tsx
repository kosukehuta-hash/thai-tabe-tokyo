import styles from "./page.module.css";

type StoreBasicInfoProps = {
  address: string;
  nearestStationName: string;
  walkMinutes: number;
  hasLunch: boolean;
  hasDinner: boolean;
  lunchHours: string | null;
  dinnerHours: string | null;
  regularHoliday: string | null;
  lunchPriceText: string | null;
  dinnerPriceText: string | null;
  phoneNumber: string | null;
};

export default function StoreBasicInfo({
  address,
  nearestStationName,
  walkMinutes,
  hasLunch,
  hasDinner,
  lunchHours,
  dinnerHours,
  regularHoliday,
  lunchPriceText,
  dinnerPriceText,
  phoneNumber,
}: StoreBasicInfoProps) {
  return (
    <>
      <h2 className={styles.sectionHeading}>店舗基本情報</h2>
      <dl className={styles.basicInfoList}>
        <div className={styles.basicInfoItem}>
          <dt className={styles.infoLabel}>住所</dt>
          <dd className={styles.infoValue}>{address}</dd>
        </div>

        <div className={styles.basicInfoItem}>
          <dt className={styles.infoLabel}>最寄り駅</dt>
          <dd className={styles.infoValue}>
            {nearestStationName}から徒歩{walkMinutes}分
          </dd>
        </div>

        {(hasLunch || hasDinner) && (
          <div className={styles.basicInfoItem}>
            <dt className={styles.infoLabel}>営業時間</dt>
            <dd className={styles.infoValue}>
              {hasLunch && lunchHours !== null && (
                <span className={styles.hoursLine}>
                  {hasDinner ? "ランチ " : ""}
                  {lunchHours}
                </span>
              )}
              {hasDinner && dinnerHours !== null && (
                <span className={styles.hoursLine}>
                  {hasLunch ? "ディナー " : ""}
                  {dinnerHours}
                </span>
              )}
            </dd>
          </div>
        )}

        {regularHoliday !== null && (
          <div className={styles.basicInfoItem}>
            <dt className={styles.infoLabel}>定休日</dt>
            <dd className={styles.infoValue}>{regularHoliday}</dd>
          </div>
        )}

        {(hasLunch || hasDinner) && (
          <div className={styles.basicInfoItem}>
            <dt className={styles.infoLabel}>価格帯</dt>
            <dd className={styles.infoValue}>
              {hasLunch && lunchPriceText !== null && (
                <span className={styles.hoursLine}>
                  {hasDinner ? "ランチ " : ""}
                  {lunchPriceText}
                </span>
              )}
              {hasDinner && dinnerPriceText !== null && (
                <span className={styles.hoursLine}>
                  {hasLunch ? "ディナー " : ""}
                  {dinnerPriceText}
                </span>
              )}
            </dd>
          </div>
        )}

        {phoneNumber !== null && (
          <div className={styles.basicInfoItem}>
            <dt className={styles.infoLabel}>電話番号</dt>
            <dd className={styles.infoValue}>{phoneNumber}</dd>
          </div>
        )}
      </dl>
    </>
  );
}
