"use client";

import { useActionState, useState } from "react";
import {
  saveNote,
  deleteNote,
  type SaveNoteState,
  type DeleteNoteState,
} from "@/app/store/[storeId]/actions";
import { NOTE_MAX_LENGTH } from "@/lib/note-limits";
import styles from "./StoreVisitNote.module.css";

const DELETE_CONFIRM_MESSAGE = "このメモを削除しますか？";

const initialSaveState: SaveNoteState = { error: null, noteText: null };
const initialDeleteState: DeleteNoteState = { error: null, deleted: false };

type StoreVisitNoteProps = {
  storeId: number;
  initialNoteText: string | null;
};

export function StoreVisitNote({
  storeId,
  initialNoteText,
}: StoreVisitNoteProps) {
  const [noteText, setNoteText] = useState(initialNoteText ?? "");
  const [hasNote, setHasNote] = useState(initialNoteText !== null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [saveState, saveAction, isSaving] = useActionState(
    async (prevState: SaveNoteState, formData: FormData) => {
      setSuccessMessage(null);
      const result = await saveNote(prevState, formData);
      if (!result.error && result.noteText !== null) {
        setNoteText(result.noteText);
        setHasNote(true);
        setSuccessMessage("メモを保存しました");
      }
      return result;
    },
    initialSaveState,
  );

  const [deleteState, deleteAction, isDeleting] = useActionState(
    async (prevState: DeleteNoteState, formData: FormData) => {
      setSuccessMessage(null);
      const result = await deleteNote(prevState, formData);
      if (result.deleted) {
        setNoteText("");
        setHasNote(false);
        setSuccessMessage("メモを削除しました");
      }
      return result;
    },
    initialDeleteState,
  );

  const isBusy = isSaving || isDeleting;

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.sectionHeading}>行ったお店のメモ</h2>

      <form action={saveAction} className={styles.form}>
        <input type="hidden" name="storeId" value={storeId} />
        <textarea
          name="noteText"
          value={noteText}
          onChange={(event) => {
            setNoteText(event.target.value);
            setSuccessMessage(null);
          }}
          maxLength={NOTE_MAX_LENGTH}
          rows={4}
          placeholder="このお店の感想やメモを残せます"
          className={styles.textarea}
          disabled={isBusy}
        />

        {saveState.error && (
          <p className={styles.error} role="alert">
            {saveState.error}
          </p>
        )}
        {deleteState.error && (
          <p className={styles.error} role="alert">
            {deleteState.error}
          </p>
        )}
        {successMessage && (
          <p role="status" aria-live="polite">
            {successMessage}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className={styles.saveButton} disabled={isBusy}>
            {isSaving ? "保存中..." : hasNote ? "メモを更新" : "メモを登録"}
          </button>

          {hasNote && (
            <button
              type="submit"
              formAction={deleteAction}
              className={styles.deleteButton}
              disabled={isBusy}
              onClick={(event) => {
                if (!window.confirm(DELETE_CONFIRM_MESSAGE)) {
                  event.preventDefault();
                }
              }}
            >
              {isDeleting ? "削除中..." : "メモを削除"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
