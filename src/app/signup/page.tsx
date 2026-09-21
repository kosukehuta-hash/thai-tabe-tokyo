import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "新規登録 | THAI TABE TOKYO",
};

export default function SignupPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.heading}>新規登録</h1>
        <p className={styles.description}>
          メールアドレスとパスワードでアカウントを作成します。
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
