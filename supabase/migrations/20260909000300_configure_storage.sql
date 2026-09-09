begin;

-- THAI TABE TOKYO Ver.1 (MVP)
-- 18_環境変数・セキュリティ ES17・ES18 に基づくStorage設定
-- バケット名「thai-tabe-images」：店舗写真とU01の料理画像を同じ公開バケットに保存する
-- 対象ロールは anon のみ（09_DB設計・18_環境変数・セキュリティに認証機能の記載なし）
-- stores/ と dishes/ はオブジェクト保存時のフォルダ名（パスのプレフィックス）として使用する。
-- Supabase Storageのフォルダはオブジェクトのパスで表現されるため、事前のフォルダ作成処理は不要であり追加しない
-- アップロード・更新・削除は権限・ポリシーともに付与せず、RLS有効時のデフォルト拒否に委ねる（ES18）

-- =========================================================
-- バケット作成（ES17：公開してよい店舗・料理画像だけを保存する前提の公開バケット）
-- =========================================================
insert into storage.buckets (id, name, public)
values ('thai-tabe-images', 'thai-tabe-images', true)
on conflict (id) do nothing;

-- =========================================================
-- 閲覧のみ許可（ES17：anonにSELECTだけを許可し、INSERT・UPDATE・DELETEポリシーは作成しない）
-- =========================================================
create policy thai_tabe_images_select
on storage.objects
for select
to anon
using (bucket_id = 'thai-tabe-images');

commit;
