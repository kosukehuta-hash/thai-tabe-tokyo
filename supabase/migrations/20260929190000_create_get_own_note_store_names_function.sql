begin;

-- THAI TABE TOKYO Ver.2 (U06 メモ一覧)
-- 08_3_U06メモ一覧・09_DB設計 7．・18_環境変数・セキュリティ ES34〜ES37 に基づく
-- 本人がメモを持つ店舗についてのみ、公開／非公開を問わず最小限の店舗情報
-- （store_id／store_name／is_published）を安全に取得するための専用関数を追加する。
-- stores・store_visit_notesの既存RLS・既存GRANTは変更しない。

-- =========================================================
-- get_own_note_store_names
--   authenticatedが呼び出し元のstore_visit_notesに紐づく店舗の
--   最小限の情報だけを返す。SECURITY DEFINERでstoresの権限を一時的に
--   借りるが、本人確認(auth.uid())は関数内部で必ず行う。
-- =========================================================
create function public.get_own_note_store_names(p_store_ids bigint[])
returns table (
  store_id bigint,
  store_name text,
  is_published boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.store_id, s.store_name, s.is_published
  from public.stores s
  where s.store_id = any (p_store_ids)
    and exists (
      select 1
      from public.store_visit_notes n
      where n.store_id = s.store_id
        and n.user_id = (select auth.uid())
    );
$$;

-- 実行権限はauthenticatedにのみ付与し、anon・publicからは取り消す
revoke all on function public.get_own_note_store_names(bigint[])
  from public, anon, authenticated;

grant execute on function public.get_own_note_store_names(bigint[])
  to authenticated;

commit;
