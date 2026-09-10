begin;

-- THAI TABE TOKYO Ver.1 (MVP)
-- Supabase Security Advisorの警告4件を解消するための修正
-- 001〜003で作成した関数・ポリシー・権限のうち、本ファイルで明示した対象のみを変更する

-- =========================================================
-- 1. public.set_stores_updated_at() の search_path を固定する
--    （search_path未固定によるオブジェクト解決の不確実性を防ぐ）
-- =========================================================
alter function public.set_stores_updated_at() set search_path = '';

-- =========================================================
-- 2. storage.objects の thai_tabe_images_select ポリシーを削除する
--    バケット thai-tabe-images は public のままとし、公開URL経由の画像取得は維持する。
--    ポリシー削除により、anon による storage.objects の一覧取得（APIでのSELECT）は許可しない
-- =========================================================
drop policy if exists thai_tabe_images_select on storage.objects;

-- =========================================================
-- 3. public.rls_auto_enable() が存在する場合だけ、
--    public・anon・authenticated からEXECUTE権限を取り消す。
--    関数本体・イベントトリガーは削除しないため、新規テーブルのRLS自動有効化は維持される
-- =========================================================
do $$
declare
  target_function regprocedure;
begin
  select p.oid::regprocedure into target_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'rls_auto_enable'
  limit 1;

  if target_function is not null then
    execute format(
      'revoke execute on function %s from public, anon, authenticated;',
      target_function
    );
  end if;
end;
$$;

commit;
