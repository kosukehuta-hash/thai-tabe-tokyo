begin;

-- THAI TABE TOKYO Ver.2 (認証・店舗メモ機能)
-- Issue #32: store_visit_notes テーブルと RLS を追加する
-- 09_DB設計（Ver2） 6.店舗メモ、18_環境変数・セキュリティ ES21〜ES29 に基づく

-- =========================================================
-- 1. store_visit_notes（店舗メモ）
-- =========================================================
create table public.store_visit_notes (
  note_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id bigint not null references public.stores (store_id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_visit_notes_user_store_key
    unique (user_id, store_id),
  constraint store_visit_notes_note_text_length_check
    check (char_length(btrim(note_text)) between 1 and 500)
);

-- =========================================================
-- 2. updated_at 自動更新トリガー
--    stores専用の public.set_stores_updated_at() は流用せず、専用関数を新設する
-- =========================================================
create function public.set_store_visit_notes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger store_visit_notes_set_updated_at
before update on public.store_visit_notes
for each row
execute function public.set_store_visit_notes_updated_at();

-- =========================================================
-- 3. RLS有効化
-- =========================================================
alter table public.store_visit_notes enable row level security;

-- =========================================================
-- 4. 権限（anonには一切付与しない。authenticatedに必要最小限のみ付与）
-- =========================================================
revoke all on public.store_visit_notes from anon, authenticated;
revoke all on sequence public.store_visit_notes_note_id_seq
  from anon, authenticated;

grant select, insert, update, delete
  on public.store_visit_notes
  to authenticated;

-- =========================================================
-- 5. RLSポリシー（TO authenticated、所有者条件は (select auth.uid()) = user_id）
-- =========================================================
create policy store_visit_notes_select_own
on public.store_visit_notes
for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy store_visit_notes_insert_own
on public.store_visit_notes
for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy store_visit_notes_update_own
on public.store_visit_notes
for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create policy store_visit_notes_delete_own
on public.store_visit_notes
for delete
to authenticated
using ( (select auth.uid()) = user_id );

commit;
