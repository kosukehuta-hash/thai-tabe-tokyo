begin;

-- THAI TABE TOKYO Ver.2 (お気に入り機能 F09 / U07)
-- Issue #89: store_favorites テーブル・RLS・get_own_favorites()・登録制限トリガーを追加する
-- 09_DB設計（Ver2）8〜10、18_環境変数・セキュリティ ES38〜ES47 に基づく
-- 既存のmigration、および stores・store_visit_notes の既存RLS・既存GRANTは変更しない

-- =========================================================
-- 1. store_favorites（お気に入り）
--    更新はない（登録と削除のみ）ため updated_at は持たない
--    店舗が非公開になっても、既存のお気に入り行は削除しない
-- =========================================================
create table public.store_favorites (
  favorite_id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store_id bigint not null references public.stores (store_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint store_favorites_user_store_key
    unique (user_id, store_id)
);

-- =========================================================
-- 2. index（店舗削除時のcascadeおよび store_id 側からの参照用）
--    user_id での検索は unique (user_id, store_id) の索引が使われる
-- =========================================================
create index store_favorites_store_id_idx
on public.store_favorites (store_id);

-- =========================================================
-- 3. RLS有効化
-- =========================================================
alter table public.store_favorites enable row level security;

-- =========================================================
-- 4. 権限（anonには一切付与しない。authenticatedにはSELECT・INSERT・DELETEのみ付与し、
--    UPDATEは付与しない）
--    identity用sequenceは store_visit_notes と同じ方針（anon・authenticatedの権限を取り消すのみ）
-- =========================================================
revoke all on public.store_favorites from anon, authenticated;
revoke all on sequence public.store_favorites_favorite_id_seq
  from anon, authenticated;

grant select, insert, delete
  on public.store_favorites
  to authenticated;

-- =========================================================
-- 5. RLSポリシー（TO authenticated、所有者条件は (select auth.uid()) = user_id）
--    UPDATE用のポリシーは作らない
-- =========================================================
create policy store_favorites_select_own
on public.store_favorites
for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy store_favorites_insert_own
on public.store_favorites
for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy store_favorites_delete_own
on public.store_favorites
for delete
to authenticated
using ( (select auth.uid()) = user_id );

-- =========================================================
-- 6. 登録制限トリガー（BEFORE INSERT）
--    公開中（is_published = true）の店舗だけを新規登録できる。
--    存在しない店舗も、非公開店舗と同じ拒否扱いにする（存在有無を区別しない）。
--    INSERT時だけ検査する。登録後に店舗が非公開になっても既存行は削除・更新しない。
--    authenticatedはstoresを直接SELECTできないため、SECURITY DEFINERで検査する。
--    拒否時はSQLSTATE 'TF001'（Server Actionが error.code で判別する）。
--    トリガー関数のEXECUTE権限はトリガー作成時にのみ検査されるため、
--    public・anon・authenticatedから取り消してもトリガーは動作する。
-- =========================================================
create function public.check_store_favorites_store_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.stores s
    where s.store_id = new.store_id
      and s.is_published = true
  ) then
    raise exception 'store is not available for favorites'
      using errcode = 'TF001';
  end if;
  return new;
end;
$$;

revoke all on function public.check_store_favorites_store_published()
  from public, anon, authenticated;

create trigger store_favorites_check_store_published
before insert on public.store_favorites
for each row
execute function public.check_store_favorites_store_published();

-- =========================================================
-- 7. get_own_favorites
--    ログイン本人のお気に入りの店舗を、公開・非公開を問わず1回のクエリで取得する
--    （U07用）。返すのは最小限の列（store_id／store_name／is_published／created_at）のみ。
--    SECURITY DEFINERでstoresの権限を一時的に借りるが、本人確認(auth.uid())は
--    関数内部で必ず行う。引数を持たないため、他人のuser_idを渡す余地はない。
--    並び順は created_at 降順。同一のcreated_atの場合のみ favorite_id 降順を第2キーとする。
-- =========================================================
create function public.get_own_favorites()
returns table (
  store_id bigint,
  store_name text,
  is_published boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select s.store_id, s.store_name, s.is_published, f.created_at
  from public.store_favorites f
  join public.stores s on s.store_id = f.store_id
  where f.user_id = (select auth.uid())
  order by f.created_at desc, f.favorite_id desc;
$$;

-- 実行権限はauthenticatedにのみ付与し、anon・publicからは取り消す
revoke all on function public.get_own_favorites()
  from public, anon, authenticated;

grant execute on function public.get_own_favorites()
  to authenticated;

commit;
