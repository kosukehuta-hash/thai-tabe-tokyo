begin;

-- THAI TABE TOKYO Ver.1 (MVP)
-- 09_DB設計：store_photos.alt_text は「写真を登録する場合は必須」（条件付必須）
-- store_photos の各行は登録済み写真を表すため、alt_text を NOT NULL に変更する

alter table public.store_photos
  alter column alt_text set not null;

commit;
