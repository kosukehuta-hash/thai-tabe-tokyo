# THAI TABE TOKYO

タイ料理初心者でも、写真を見ながら直感的にお店を探せるWebアプリです。

東京のタイ料理店を、エリア・時間帯・利用シーン・料理から検索できます。

## 公開URL

https://thai-tabe-tokyo.vercel.app

## スクリーンショット

### U01：検索条件選択

エリア・時間帯・利用シーン・料理を選択して検索できます。
料理写真を見ながら、タイ料理初心者でも直感的に選べるようにしています。

![U01 検索条件選択画面](public/images/readme/u01-search.png)

### U02：検索結果

選択した条件に合う店舗を一覧で確認できます。
店舗写真・料理写真・徒歩時間などを見ながら比較できます。

![U02 検索結果画面](public/images/readme/u02-search-results.png)

### U03：店舗詳細

店舗の外観・店内・料理写真と、営業時間やアクセスなどの詳細情報を確認できます。

![U03 店舗詳細画面](public/images/readme/u03-store-detail.png)

## Overview

THAI TABE TOKYOは、東京でタイ料理を楽しみたい人が、
希望する条件から自分に合ったお店を探せるWebアプリです。

料理写真や店舗写真を見ながらお店や料理をイメージできるため、
タイ料理に詳しくない方でも直感的に検索できます。

「タイ料理を食べたいけれど、料理名やお店をよく知らない」
という方でも、写真や条件を手がかりに、
気になるお店を見つけやすくすることを目的に作成しました。

## 主な機能（Features）

### U01：検索条件選択
- エリアから選択
- 時間帯から選択
- 利用シーンから選択
- 料理写真を見ながら食べたい料理を選択
- 複数の条件を組み合わせて店舗を検索

### U02：検索結果
- 条件に合う店舗を一覧表示
- 店舗写真・料理写真を表示
- 最寄り駅・徒歩時間・営業時間・価格帯を確認
- 利用シーンや主な料理を確認
- 店舗詳細画面へ遷移

### U03：店舗詳細
- 店舗の外観・店内イメージを表示
- 食べられる主な料理を写真付きで表示
- 営業時間・定休日・価格帯・アクセスなどを表示
- 店舗の雰囲気や利用シーンを確認
- 地図・公式サイトへのリンクを表示

### 認証（Ver2追加）
- メールアドレスとパスワードでサインアップ
- メールアドレスとパスワードでログイン
- ログアウト
- ヘッダーでログイン状態を表示

### U03：行ったお店のメモ（Ver2追加）
- ログイン中のみ、店舗ごとに「行ったお店のメモ」を登録・更新・削除
- メモは本人のみ閲覧・操作可能（他ユーザーのメモは見えません）

## 使用技術（Technology）

| カテゴリ | 技術 |
| --- | --- |
| フレームワーク | Next.js 16.3.4（App Router） |
| UIライブラリ | React 19.2.8 |
| 言語 | TypeScript 5.9.3 |
| スタイリング | CSS Modules |
| データベース | Supabase（PostgreSQL） |
| 画像ストレージ | Supabase Storage |
| APIクライアント | @supabase/supabase-js 2.116.0 |
| Lint | ESLint 9 |
| デプロイ | Vercel（Tokyo / hnd1） |

## 工夫した点・苦労した点

### タイ料理初心者でも選びやすいUI
料理名だけではイメージしにくい方でも選びやすいように、
料理写真や店舗写真を使い、エリア・時間帯・利用シーン・料理から
直感的に検索できる画面を意識しました。

### PC・スマートフォン両方で使いやすい画面設計
U01（検索条件選択）、U02（検索結果）、U03（店舗詳細）について、
PC・スマートフォンの両方で見やすく、操作しやすいレイアウトになるよう調整しました。

### 画面ごとに見やすい料理写真サイズを調整
U02（検索結果）とU03（店舗詳細）では、料理カードの役割や表示領域が異なるため、
同じ画像サイズでは見づらくなる部分がありました。

検索結果では一覧性を重視し、店舗詳細では料理写真をより分かりやすく見せるなど、
画面ごとに料理カードと写真のサイズを調整しました。

写真が大きすぎても小さすぎても見づらくなるため、
レイアウト全体とのバランスを確認しながら調整する点に苦労しました。

### 本番環境の表示速度を調査・改善
Vercelへ公開後、検索結果画面の表示に約2秒かかる問題がありました。
ブラウザのNetworkとVercel Logsを使って原因を調査したところ、
Vercel FunctionsとSupabaseの実行リージョンが離れていることが分かりました。

Vercel Functionsを東京リージョンへ変更することで、
検索結果画面の処理時間を約1.94秒から約0.38秒まで短縮しました。

## 今後の実装・改善予定

- 人気の検索条件が分かる検索ランキング機能
- 人気店舗ランキング機能
- 人気料理ランキング機能
- 店舗・料理データの拡充
- Supabaseのデータ取得処理の最適化
- UI/UXの継続的な改善
- テストの充実

## 動作環境（Requirements）

| 項目 | バージョン |
| --- | --- |
| Node.js | 24.18.1 |
| npm | 11.16.0 |
| Git | 2.55.0.windows.3 |

ローカル実行には、以下の環境変数が必要です。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

値はREADMEには記載せず、`.env.example` を参考に `.env.local` を作成してください。

## Getting Started

### 1. リポジトリを取得

```bash
git clone https://github.com/kosukehuta-hash/thai-tabe-tokyo.git
cd thai-tabe-tokyo
```

### 2. パッケージをインストール

```bash
npm install
```

### 3. 環境変数を設定

`.env.example` を参考に、プロジェクトルートへ
`.env.local` を作成してください。

必要な環境変数：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

※ 実際の値は公開しないでください。

### 4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで以下を開きます。

```text
http://localhost:3000
```

## Supabaseのマイグレーション・seed適用（ローカル開発）

Supabaseのデータベース構造（migration）と、動作確認用の最小データ（seed）を、**ローカルDocker環境に再現・検証する手順**です。Next.jsアプリ全体をローカルSupabaseで動かす手順ではありません（アプリの接続先については後述の「Next.jsアプリの接続先について」を参照してください）。

Node.js・npmのバージョンは「動作環境（Requirements）」を、`.env.local`の設定は「Getting Started」の「3. 環境変数を設定」を参照してください。

### 前提条件

- Docker Desktop（ローカルSupabase環境の起動に使用）
- Supabase CLI
- Node.js / npm（「動作環境（Requirements）」参照）
- `.env.local` の設定（「Getting Started」の「3. 環境変数を設定」参照）

### ローカルSupabase環境の起動

プロジェクトルートで以下を実行します。

```bash
supabase start
```

このコマンドにより、

1. `supabase/migrations/` 配下のmigrationファイルがタイムスタンプ順（ファイル名順）にすべて適用され、テーブル・RLS・Storage設定などのDB構造が作成されます
2. 続けて `supabase/seed.sql` が実行され、動作確認用の初期データが投入されます

### seedデータについて

`supabase/seed.sql` は本番データの複製ではなく、U01（検索条件選択）〜U03（店舗詳細）の基本的な画面遷移・検索動作を確認するための最小限のデータです。

| テーブル | 件数 |
| --- | --- |
| areas | 8件 |
| dishes | 6件 |
| stores | 5件 |
| store_dishes | 21件 |
| store_photos | 0件 |
| store_visit_notes | 0件 |

- Authユーザー・Storage画像は含みません
- 動作確認できるよう、店舗5件は `is_published = true` としています
- 本番Supabase Storageへの依存を避けるため、`dishes.search_image_url` はNULLにしています
- 店舗写真（`store_photos`）は投入していませんが、写真が無い場合はアプリ側に「写真準備中」の表示が用意されているため、U02・U03の画面確認に支障はありません

### DBを初期状態へ戻す

```bash
supabase db reset
```

ローカルDBを作り直し、migration → seedを再適用します。

### ローカルSupabaseの停止

```bash
supabase stop
```

### Next.jsアプリの接続先について

- `supabase start` はローカルSupabase環境を起動するコマンドであり、**Next.jsアプリの接続先を自動的に変更するものではありません**
- Next.jsアプリの接続先は、`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` ・ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` によって決まります
- 現在これらの環境変数がホスティング済みSupabaseを指している場合、`supabase start` を実行した後も、アプリは引き続きそのホスティング済みSupabaseへ接続します

（参考）ローカルSupabaseを実際にアプリから利用したい場合は、

1. `supabase status` でローカルのAPI URLとPublishable Keyを確認する
2. `.env.local` の上記2つの環境変数をローカル用の値へ変更する
3. Next.js開発サーバーを再起動する

という切り替えが必要です。本章の主目的はmigration・seedの検証であり、この切り替えは必須ではありません。

### 既知の制限（ローカルSupabaseへ接続先を切り替えた場合）

- 現在の `next.config.ts` は、Supabase Storageの画像を `https` 前提で許可しています
- ローカルSupabaseは `http` で起動するため、接続先をローカルに切り替えた場合、Storage画像は現状のコードのままでは表示できません
- `supabase/seed.sql` 自体にもStorage画像は含めていません（本章の手順はDBデータの再現のみを対象としています）

### トラブルシューティング：ポート競合

`supabase start` は `supabase/config.toml` に設定されたポート（デフォルトで`54321`番台）を使用します。別のSupabaseローカルプロジェクトが同時に起動している場合、ポートが競合して起動に失敗することがあります。その場合は `supabase/config.toml` 内の該当ポート番号を、未使用のポートへ一時的に変更してください。

### ホスティング済みSupabaseプロジェクトへの適用について

新規のホスティング済みSupabaseプロジェクトへ適用する場合は、Supabase CLIでプロジェクトをlinkした上でmigration/seedを適用できます。既存データのあるプロジェクトにはseed.sqlを再実行しないでください。

※ ホスティング済みプロジェクトへの適用手順は、本READMEでは動作検証を行っていません。検証済みなのはローカルDocker環境（`supabase start`／`supabase db reset`）での動作のみです。

### seed.sqlに関する注意事項

- `supabase/seed.sql` は、新規・空のデータベースへの初回投入を前提としています
- 同じDBに対して繰り返し実行すると、unique制約違反により失敗する可能性があります
- 本番DBへのseed投入を目的としたものではありません

## デモアカウント（レビュー用）

認証機能・店舗メモ機能をお試しいただくためのレビュー専用共有アカウントです。
個人を特定する情報は登録していません。

| 項目 | 値 |
| --- | --- |
| メールアドレス | thai-tabe-demo@example.com |
| パスワード | ThaiTabeDemo!2026 |

### 確認手順

1. [公開URL](https://thai-tabe-tokyo.vercel.app) にアクセスする
2. ヘッダーの「ログイン」から上記アカウントでログインする
3. 任意の店舗のU03（店舗詳細）画面を開く
4. 「行ったお店のメモ」欄にメモを入力し、「メモを登録」で保存する
5. ページを再読み込みし、登録したメモが表示されることを確認する
6. メモを編集し、「メモを更新」で保存内容が更新されることを確認する
7. 「メモを削除」を押し、確認ダイアログでOKを選ぶとメモが削除され、未登録状態に戻ることを確認する
8. ヘッダーの「ログアウト」でログアウトする

## ディレクトリ構成

```text
thai-tabe-tokyo/
├── src/
│   ├── app/
│   │   ├── search/           # U02：検索結果画面
│   │   ├── store/[storeId]/  # U03：店舗詳細画面
│   │   ├── page.tsx          # U01：検索条件選択（トップページ）
│   │   └── layout.tsx        # 共通レイアウト
│   └── lib/
│       └── supabase.ts       # Supabaseクライアント
├── public/
│   └── images/               # 画像アセット・README用スクリーンショット
├── supabase/
│   ├── migrations/           # DBスキーマ・RLS・Storage設定
│   └── seed/                 # 初期データ
├── docs/                     # 要件仕様書・初期登録データ
├── vercel.json               # Vercelのリージョン設定
└── .env.example              # 環境変数のテンプレート
```

## よく使うコマンド

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動する |
| `npm run build` | 本番用にアプリをビルドする |
| `npm run start` | ビルド済みアプリを本番モードで起動する |
| `npm run lint` | ESLintでコードをチェックする |

## 開発・GitHub運用

開発は `main` ブランチを直接編集せず、作業内容ごとにブランチを作成して進めています。

基本的な流れ：

1. `main` から作業ブランチを作成
2. 機能追加・修正を実施
3. commit / push
4. GitHubでPull Requestを作成
5. Checksを確認
6. `main` へマージ
7. Vercelで自動デプロイ

ブランチ名は、作業内容に応じて以下のように使い分けています。

- `feature/...`：機能追加
- `fix/...`：修正
- `docs/...`：ドキュメント更新

## 設計資料

- [THAI TABE TOKYO 要件仕様書](docs/THAI_TABE_TOKYO_要件仕様書_Ver1_実装開始版.xlsx)
  - MVP範囲
  - 検索仕様
  - U01・U02・U03の画面仕様
  - DB設計
  - 画面項目・操作イベント
  - 受け入れ条件・テスト仕様
  - 技術構成・非機能要件
  - 開発・公開手順

要件仕様書をもとに、
要件定義 → 設計 → 実装 → テストの流れを意識して開発しています。

## テスト・動作確認

現在、自動テストは未導入です。
以下の方法で品質・動作を確認しています。

- `npm run lint`：ESLintによるコード品質チェック
- `npm run build`：本番ビルドが正常に完了することを確認
- Vercel公開環境でU01 → U02 → U03の一連の画面遷移・操作を手動確認
- PC・スマートフォン向けのレスポンシブ表示を確認
- 公開後にブラウザのNetworkとVercel Logsを使って表示速度を確認

要件仕様書には「受け入れ条件」「テスト仕様」を定義しています。

今後の課題として、自動テストの導入を予定しています。

## 注意事項

本アプリで使用している店舗写真・料理写真は、
ポートフォリオ用に作成したAI生成のイメージ画像です。

実在店舗の実際の写真ではありません。

## デプロイ（Deployment）

本アプリはVercelで公開しています。

- GitHubの`main`ブランチへのマージをきっかけに自動デプロイ
- Vercel Functions：Tokyo（hnd1）
- Supabase：Tokyo（ap-northeast-1）

Vercel FunctionsとSupabaseのリージョンを東京にそろえることで、
本番環境での通信遅延を改善しています。

## Author

[kosukehuta-hash](https://github.com/kosukehuta-hash)
