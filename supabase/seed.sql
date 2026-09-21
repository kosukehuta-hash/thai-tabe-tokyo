-- THAI TABE TOKYO Ver.1 (MVP)
-- 新規・空のSupabaseプロジェクトへの初回投入専用の最小開発・テスト用seedです。
-- 本番データの完全複製ではなく、U01（検索条件選択）・U02（検索結果）・U03（店舗詳細）の
-- 基本動作確認に必要な最小限のデータのみを、既存の supabase/seed/*.csv の値から抜粋して投入します。
--
-- 前提・注意事項:
--   - 空のデータベース（migration適用直後、他のデータが存在しない状態）への投入のみを想定しています。
--   - unique制約があるため、既にデータが存在する状態で再実行すると失敗します（再実行不可）。
--   - store_photos・store_visit_notes・authユーザーは投入しません。
--   - dishes.search_image_url は、本番Supabase Storageへの依存を避けるため、すべてNULLにしています。
--   - stores.is_published は、seed/stores.csv 上は全件falseですが、
--     U01〜U03の画面をRLS越しに確認できるよう、本seedでは true に変更しています。

begin;

-- =========================================================
-- 1. areas（seed/areas.csv の8件全件、area_idはidentityの自動採番に任せる）
-- =========================================================
insert into public.areas (area_name, display_order, is_active) values
  ('新宿・新大久保', 1, true),
  ('渋谷・原宿', 2, true),
  ('池袋・高田馬場', 3, true),
  ('上野・浅草', 4, true),
  ('東京・日本橋', 5, true),
  ('銀座・新橋', 6, true),
  ('恵比寿・目黒', 7, true),
  ('六本木・赤坂', 8, true);

-- =========================================================
-- 2. dishes（seed/dishes.csv の6件全件、dish_idはidentityの自動採番に任せる）
--    search_image_url は本番Storage依存を避けるためすべてNULL
-- =========================================================
insert into public.dishes (dish_name, description, search_image_url, display_order, is_active) values
  ('ガパオ', 'ピリ辛のひき肉バジル炒めご飯', null, 1, true),
  ('カオマンガイ', '辛くない蒸し鶏ご飯', null, 2, true),
  ('パッタイ', '甘酸っぱいタイ風焼きそば', null, 3, true),
  ('タイカレー', 'ココナッツ風味のタイカレー', null, 4, true),
  ('トムヤムクン', '辛くて酸っぱいエビのスープ', null, 5, true),
  ('ヤムウンセン', '春雨と野菜のピリ辛サラダ', null, 6, true);

-- =========================================================
-- 3. stores（seed/stores.csv のうち store_id=1,10,25,27,35 の5件のみ）
--    store_dishes.csv の紐付け（store_id）を維持するため、
--    store_id は OVERRIDING SYSTEM VALUE で元のCSV上の番号を明示指定する。
--    is_published のみ、CSV上の false から true に変更している。
-- =========================================================
insert into public.stores (
  store_id, area_id, store_name, catch_copy, atmosphere_text, address,
  nearest_station_name, walk_minutes, regular_holiday, phone_number,
  has_lunch, lunch_hours, lunch_price_from,
  has_dinner, dinner_hours, dinner_price_from,
  scene_solo, scene_date, scene_friends, scene_family,
  spice_support_text, reservation_text, seat_type_text,
  map_url, official_site_url,
  information_source_type, information_source_url, last_verified_on,
  is_published
)
overriding system value
values
  (
    1, 1, 'タイ国料理 バンタイ', '味・香り・空間でタイ文化を楽しめる老舗',
    'タイ製の家具や雑貨でまとめた、ゆったりした空間',
    '東京都新宿区歌舞伎町1-23-14 第1メトロビル3F', '新宿駅', 5, '無休', '03-3207-0068',
    true, '月～金 11:30～15:30（L.O.15:00）', 800,
    true, '月～金 17:00～23:00、土日祝 11:30～23:00（L.O.22:00）', 935,
    false, false, false, false,
    null, '予約可・ランチタイムは予約不可', '110席・個室なし・全席禁煙',
    'https://www.google.com/maps/search/?api=1&query=タイ国料理+バンタイ', 'https://ban-thai.studio.site/',
    '公式サイト・政府認定サイト', 'https://thaiselect.jp/restaurants/restaurant_46/', date '2026-09-11',
    true
  ),
  (
    10, 2, 'DADAÏ THAI VIETNAMESE DIMSUM', '渋谷駅徒歩3分、タイ・ベトナム料理と点心を楽しめるモダンアジアンレストラン',
    '巨大なアートとバーカウンターが印象的な、クラシックとモダンが融合した開放的な店内',
    '東京都渋谷区神宮前6-20-10 MIYASHITA PARK North 1階 10500', '渋谷駅', 3, 'なし', '03-6734-0888',
    true, '11:30～15:00（平日ランチメニュー）', 1150,
    true, '月～土・祝前日 17:00～23:00（料理L.O.22:00、ドリンクL.O.22:30）／日祝 17:00～22:00（料理L.O.21:00、ドリンクL.O.21:30）', 4000,
    true, true, true, true,
    null, '公式Web予約可', '166席（店内134席、テラス32席）、バーカウンターあり。未就学児同伴は17:00まで・案内席限定',
    'https://www.google.com/maps/search/?api=1&query=DADAI%20THAI%20VIETNAMESE%20DIMSUM', 'https://www.huge.co.jp/service/restaurant/modern_asian/dadai/',
    '運営会社公式サイト・施設公式サイト', 'https://www.huge.co.jp/service/restaurant/modern_asian/dadai/', date '2026-09-11',
    true
  ),
  (
    25, 5, 'タイ料理 沌（トン）丸ビル店', '東京駅徒歩1分、タイ直輸入のハーブやスパイスを使った本格タイ料理を気軽に楽しめる店',
    '丸ビル地下にある、ひとりでも立ち寄りやすいコンパクトでカジュアルな店内',
    '東京都千代田区丸の内2-4-1 丸の内ビルディングB1F', '東京駅', 1, '無休（1月1日・法定点検日を除く）', '03-6665-9161',
    true, '10:00～15:00', 1000,
    true, '平日・土曜 15:00～20:00／日曜・祝日 15:00～19:00', 1000,
    true, false, true, false,
    null, null, '10席、イートイン席、全席禁煙',
    'https://www.google.com/maps/search/?api=1&query=タイ料理%20沌%20丸ビル店', 'https://www.marunouchi.com/tenants/1259/',
    '施設公式サイト', 'https://www.marunouchi.com/tenants/1259/', date '2026-09-11',
    true
  ),
  (
    27, 6, 'QUEEN of THAILAND 銀座', '銀座一丁目駅徒歩1分、銀座の眺望と洗練された本格タイ料理を楽しめるタイ・セレクト・シグネチャー認定店',
    '白と緑を基調にタイシルクや花を配した、高級感と開放感のあるメインダイニング',
    '東京都中央区銀座2-2-14 マロニエゲート銀座1 10F', '銀座一丁目駅', 1, '年末年始、マロニエゲート銀座1の休館日', '050-3171-8349',
    true, '月～金 11:00～15:00（L.O.14:00）／土日祝 11:00～16:00（L.O.15:00）', 1600,
    true, '17:00～23:00（フードL.O.22:00、ドリンクL.O.22:30）', 4500,
    false, true, true, true,
    null, '公式Web・電話予約可', '64席、テーブル席・半個室2室あり、全席禁煙',
    'https://www.google.com/maps/search/?api=1&query=QUEEN%20of%20THAILAND%20銀座', 'https://queen-thailand-ginza.com/',
    '店舗公式サイト・施設公式サイト・タイ政府認定サイト', 'https://queen-thailand-ginza.com/', date '2026-09-12',
    true
  ),
  (
    35, 7, 'タイ料理 みもっと', '目黒駅徒歩8分、日本の旬とタイ各地の伝統料理を融合した月替わりコースを楽しめる完全予約制店',
    '季節の食材と一皿ずつ向き合える、少人数制で落ち着いたスモールレストラン',
    '東京都目黒区目黒1-24-7', '目黒駅', 8, '日曜日・月曜日・火曜日', '03-6426-6352',
    false, null, null,
    true, '水～土 17:30～／20:00～の2部制', 16500,
    false, true, true, false,
    null, 'OMAKASEからの完全予約制', '12席の少人数制',
    'https://www.google.com/maps/search/?api=1&query=タイ料理%20みもっと%20目黒', 'https://mymot.jp/',
    '店舗公式サイト・公式予約サイト', 'https://mymot.jp/', date '2026-09-12',
    true
  );

-- stores.store_id は上記で OVERRIDING SYSTEM VALUE により明示指定したため、
-- identityシーケンスの内部カウンタは自動追従しない。
-- 後続で（アプリ経由等）通常どおり store_id を自動採番させたときに
-- 既存値（最大35）と衝突しないよう、シーケンスを投入済み最大値に合わせておく。
-- シーケンス名は環境によって変わり得るため、ハードコードせず pg_get_serial_sequence() で取得する。
select setval(
  pg_get_serial_sequence('public.stores', 'store_id'),
  (select max(store_id) from public.stores)
);

-- =========================================================
-- 4. store_dishes（上記5店舗に該当する seed/store_dishes.csv の行のみ）
--    store_id=35 は seed/store_dishes.csv に該当行が無いため投入しない。
--    identity列は無し（store_id, dish_id の複合主キー）のため、シーケンス調整は不要。
-- =========================================================
insert into public.store_dishes (store_id, dish_id, display_order, is_available) values
  (1, 1, 1, true),
  (1, 2, 2, true),
  (1, 3, 3, true),
  (1, 4, 4, true),
  (1, 5, 5, true),
  (1, 6, 6, true),
  (10, 1, 1, true),
  (10, 2, 2, true),
  (10, 3, 3, true),
  (10, 4, 4, true),
  (10, 5, 5, true),
  (10, 6, 6, true),
  (25, 1, 1, true),
  (25, 3, 2, true),
  (25, 4, 3, true),
  (27, 1, 1, true),
  (27, 2, 2, true),
  (27, 3, 3, true),
  (27, 4, 4, true),
  (27, 5, 5, true),
  (27, 6, 6, true);

commit;
