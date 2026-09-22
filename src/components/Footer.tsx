import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        掲載写真はAI生成のイメージで、実際の店舗・料理とは異なる場合があります。
      </p>
    </footer>
  );
}
