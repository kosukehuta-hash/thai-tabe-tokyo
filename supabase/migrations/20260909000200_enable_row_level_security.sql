begin;

-- THAI TABE TOKYO Ver.1 (MVP)
-- 18_環境変数・セキュリティ ES10〜ES16 に基づくRLS設定
-- 対象ロールは anon のみ（本アプリに認証機能はなく、Publishable keyでの利用者アクセスは anon ロールで行われる）
-- authenticated には権限を付与しない（本アプリで使用しないロールのため）
-- INSERT/UPDATE/DELETEは権限・ポリシーともに付与せず、RLS有効時のデフォルト拒否に委ねる（ES16）

-- =========================================================
-- RLS有効化（ES10：5テーブルすべてでRLSを有効にする）
-- =========================================================
alter table public.areas enable row level security;
alter table public.dishes enable row level security;
alter table public.stores enable row level security;
alter table public.store_dishes enable row level security;
alter table public.store_photos enable row level security;

-- =========================================================
-- 権限の取り消し・付与（anon・authenticatedの既存権限を取り消し、anonにSELECTだけを付与）
-- =========================================================
revoke all on public.areas from anon, authenticated;
revoke all on public.dishes from anon, authenticated;
revoke all on public.stores from anon, authenticated;
revoke all on public.store_dishes from anon, authenticated;
revoke all on public.store_photos from anon, authenticated;

grant select on public.areas to anon;
grant select on public.dishes to anon;
grant select on public.stores to anon;
grant select on public.store_dishes to anon;
grant select on public.store_photos to anon;

-- =========================================================
-- areas（ES11：is_active = TRUE の行だけ公開）
-- =========================================================
create policy areas_select_active
on public.areas
for select
to anon
using (is_active = true);

-- =========================================================
-- dishes（ES12：is_active = TRUE の行だけ公開）
-- =========================================================
create policy dishes_select_active
on public.dishes
for select
to anon
using (is_active = true);

-- =========================================================
-- stores（ES13：is_published = TRUE の行だけ公開）
-- =========================================================
create policy stores_select_published
on public.stores
for select
to anon
using (is_published = true);

-- =========================================================
-- store_dishes（ES14：is_available = TRUE かつ公開店舗・有効料理に紐づく行だけ公開）
-- =========================================================
create policy store_dishes_select_available
on public.store_dishes
for select
to anon
using (
  is_available = true
  and exists (
    select 1 from public.stores s
    where s.store_id = store_dishes.store_id
      and s.is_published = true
  )
  and exists (
    select 1 from public.dishes d
    where d.dish_id = store_dishes.dish_id
      and d.is_active = true
  )
);

-- =========================================================
-- store_photos（ES15：公開店舗に紐づく写真情報だけ公開）
-- =========================================================
create policy store_photos_select_published_store
on public.store_photos
for select
to anon
using (
  exists (
    select 1 from public.stores s
    where s.store_id = store_photos.store_id
      and s.is_published = true
  )
);

commit;
