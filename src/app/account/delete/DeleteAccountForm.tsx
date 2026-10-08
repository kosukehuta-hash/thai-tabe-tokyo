"use client";

import { useActionState, useState } from "react";
import { PROTECTED_ACCOUNT_ERROR_MESSAGE } from "@/lib/action-messages";
import { deleteAccount, type DeleteAccountState } from "./actions";
import styles from "./DeleteAccountForm.module.css";

export const CONFIRM_LABEL = "上記を理解したうえで、アカウントを削除します";
export const DELETE_BUTTON_LABEL = "アカウントを削除する";

const initialState: DeleteAccountState = { error: null };

type DeleteAccountFormViewProps = {
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  // <form action> に渡す関数（useActionStateが返す）
  formAction: (formData: FormData) => void;
  // 削除の処理中は、チェックボックスと削除ボタンを無効にして二重送信を防ぐ
  pending: boolean;
  error: string | null;
  // 保護対象（共有デモアカウント）か。判定結果の真偽値だけを受け取る（IDの実値は受け取らない）
  isProtected?: boolean;
};

// 表示だけを担当する部分（状態は持たない）。チェック前は削除ボタンを無効にする。
// 保護対象では、チェックの有無にかかわらず削除ボタンを常に無効にし、注意文を表示する
// （チェックボックス自体は操作できる）
export function DeleteAccountFormView({
  confirmed,
  onConfirmedChange,
  formAction,
  pending,
  error,
  isProtected = false,
}: DeleteAccountFormViewProps) {
  return (
    <form className={styles.form} action={formAction}>
      {isProtected && (
        <p className={styles.protectedNotice}>
          {PROTECTED_ACCOUNT_ERROR_MESSAGE}
        </p>
      )}
      <label className={styles.confirmLabel}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={confirmed}
          disabled={pending}
          onChange={(event) => onConfirmedChange(event.target.checked)}
        />
        <span>{CONFIRM_LABEL}</span>
      </label>
      <button
        type="submit"
        className={styles.deleteButton}
        disabled={!confirmed || pending || isProtected}
      >
        {DELETE_BUTTON_LABEL}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function DeleteAccountForm({
  isProtected = false,
}: {
  isProtected?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  // 削除に成功すると、Server ActionがU01へ移動する。失敗した場合だけここへ戻り、
  // エラーを同じ画面に表示する（チェック状態は保ち、再度操作できる）
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    initialState,
  );

  return (
    <DeleteAccountFormView
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      formAction={formAction}
      pending={pending}
      error={state.error}
      isProtected={isProtected}
    />
  );
}
