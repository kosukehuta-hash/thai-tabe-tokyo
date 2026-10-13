begin;

-- THAI TABE TOKYO Ver.2 (U06 メモ一覧)
-- 平田さんの指摘 X3-15: メモ一覧もお気に入り（get_own_favorites）と同じ方式に
-- そろえ、DB関数1本の呼び出しで「メモ＋店舗情報」を取得できるようにする。
-- 既存の get_own_note_store_names()・stores・store_visit_notes のRLS・GRANTは変更しない。

-- =========================================================
-- get_own_notes
--   ログイン本人のメモを、店舗の公開・非公開を問わず1回のクエリで取得する（U06用）。
--   返すのは最小限の列（note_id／store_id／note_text／updated_at／store_name／is_published）のみ。
--   SECURITY DEFINERでstoresの権限を一時的に借りるが、本人確認(auth.uid())は
--   関数内部で必ず行う。引数を持たないため、他人のuser_idを渡す余地はない。
--   並び順は updated_at 降順。同一のupdated_atの場合のみ note_id 降順を第2キーとする。
-- =========================================================
create function public.get_own_notes()
returns table (
  note_id bigint,
  store_id bigint,
  note_text text,
  updated_at timestamptz,
  store_name text,
  is_published boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select n.note_id, n.store_id, n.note_text, n.updated_at, s.store_name, s.is_published
  from public.store_visit_notes n
  join public.stores s on s.store_id = n.store_id
  where n.user_id = (select auth.uid())
  order by n.updated_at desc, n.note_id desc;
$$;

-- 実行権限はauthenticatedにのみ付与し、anon・publicからは取り消す
revoke all on function public.get_own_notes()
  from public, anon, authenticated;

grant execute on function public.get_own_notes()
  to authenticated;

commit;
