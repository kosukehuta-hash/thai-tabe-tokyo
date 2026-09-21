"use client";

import { useActionState, useState } from "react";
import {
  saveNote,
  deleteNote,
  type SaveNoteState,
  type DeleteNoteState,
} from "@/app/store/[storeId]/actions";
import styles from "./StoreVisitNote.module.css";

const NOTE_MAX_LENGTH = 500;
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

  const [saveState, saveAction, isSaving] = useActionState(
    async (prevState: SaveNoteState, formData: FormData) => {
      const result = await saveNote(prevState, formData);
      if (!result.error && result.noteText !== null) {
        setNoteText(result.noteText);
        setHasNote(true);
      }
      return result;
    },
    initialSaveState,
  );

  const [deleteState, deleteAction, isDeleting] = useActionState(
    async (prevState: DeleteNoteState, formData: FormData) => {
      const result = await deleteNote(prevState, formData);
      if (result.deleted) {
        setNoteText("");
        setHasNote(false);
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
          onChange={(event) => setNoteText(event.target.value)}
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

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={isBusy}
          >
            {isSaving
              ? "保存中..."
              : hasNote
                ? "メモを更新"
                : "メモを登録"}
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
