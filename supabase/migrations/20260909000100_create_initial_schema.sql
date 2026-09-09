begin;

-- THAI TABE TOKYO Ver.1 (MVP)
-- 09_DB設計 に基づく初期スキーマ作成（テーブル・制約・トリガー・最小限のインデックスのみ）
-- RLS・閲覧ポリシー・Storage設定・初期データ登録は別マイグレーションで対応する

-- =========================================================
-- 1. areas（エリアマスタ）
-- =========================================================
create table public.areas (
  area_id bigint generated always as identity primary key,
  area_name varchar(50) not null unique,
  display_order integer not null,
  is_active boolean not null default true
);

-- =========================================================
-- 2. dishes（料理マスタ）
-- 検索対象（U01検索用の5料理）かどうかは search_image_url の有無で判定する
-- =========================================================
create table public.dishes (
  dish_id bigint generated always as identity primary key,
  dish_name varchar(50) not null unique,
  description varchar(200) not null,
  search_image_url text,
  display_order integer not null,
  is_active boolean not null default true
);

-- =========================================================
-- 3. stores（店舗マスタ）
-- =========================================================
create table public.stores (
  store_id bigint generated always as identity primary key,
  area_id bigint not null references public.areas (area_id) on delete restrict,
  store_name varchar(100) not null,
  catch_copy varchar(200) not null,
  atmosphere_text text not null,
  address varchar(250) not null,
  nearest_station_name varchar(100) not null,
  walk_minutes integer not null,
  regular_holiday varchar(100),
  phone_number varchar(30),
  has_lunch boolean not null,
  lunch_hours varchar(100),
  lunch_price_from integer,
  has_dinner boolean not null,
  dinner_hours varchar(100),
  dinner_price_from integer,
  scene_solo boolean not null default false,
  scene_date boolean not null default false,
  scene_friends boolean not null default false,
  scene_family boolean not null default false,
  spice_support_text varchar(100),
  reservation_text varchar(100),
  seat_type_text varchar(200),
  map_url text not null,
  official_site_url text,
  information_source_type varchar(30) not null,
  information_source_url text not null,
  last_verified_on date not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 03_判定基準・09_DB設計 整合性ルール1：ランチ・ディナーの少なくとも一方は営業している必要がある
  constraint stores_lunch_or_dinner_check check (not is_published or has_lunch or has_dinner),
  -- has_lunch=TRUE の場合は lunch_hours / lunch_price_from を必須にする
  constraint stores_lunch_required_fields_check check (
    (not has_lunch) or (lunch_hours is not null and lunch_price_from is not null)
  ),
  -- has_dinner=TRUE の場合は dinner_hours / dinner_price_from を必須にする
  constraint stores_dinner_required_fields_check check (
    (not has_dinner) or (dinner_hours is not null and dinner_price_from is not null)
  )
);

-- 検索（エリアでの絞り込み）と並び替え（徒歩時間→store_id）に使用
create index stores_area_id_idx on public.stores (area_id);
create index stores_walk_minutes_store_id_idx on public.stores (walk_minutes, store_id);

-- updated_at 自動更新トリガー（stores のみ。09_DB設計 整合性ルール9）
create function public.set_stores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stores_set_updated_at
before update on public.stores
for each row
execute function public.set_stores_updated_at();

-- =========================================================
-- 4. store_dishes（店舗料理）
-- =========================================================
create table public.store_dishes (
  store_id bigint not null references public.stores (store_id) on delete cascade,
  dish_id bigint not null references public.dishes (dish_id) on delete restrict,
  display_order integer not null,
  is_available boolean not null,
  primary key (store_id, dish_id),
  -- 09_DB設計：店舗内で表示順の重複不可
  constraint store_dishes_store_display_order_key unique (store_id, display_order)
);

-- dish_id からの参照検索に使用
create index store_dishes_dish_id_idx on public.store_dishes (dish_id);

-- =========================================================
-- 5. store_photos（店舗写真）
-- =========================================================
create table public.store_photos (
  photo_id bigint generated always as identity primary key,
  store_id bigint not null references public.stores (store_id) on delete cascade,
  photo_type varchar(10) not null,
  dish_id bigint references public.dishes (dish_id) on delete restrict,
  photo_url text not null,
  alt_text varchar(200),
  display_order integer not null,
  -- 09_DB設計：photo_type は 外観・店内・料理 のいずれか
  constraint store_photos_photo_type_check check (photo_type in ('外観', '店内', '料理')),
  -- 09_DB設計：photo_type=料理 の場合のみ dish_id 必須、それ以外は空欄
  constraint store_photos_dish_id_required_check check (
    (photo_type = '料理' and dish_id is not null)
    or (photo_type <> '料理' and dish_id is null)
  ),
  -- 09_DB設計：同一店舗・同一種別内で表示順の重複不可
  constraint store_photos_store_type_display_order_key unique (store_id, photo_type, display_order)
);

-- store_id からの一覧取得、dish_id からの参照検索に使用
create index store_photos_store_id_idx on public.store_photos (store_id);
create index store_photos_dish_id_idx on public.store_photos (dish_id);

commit;
