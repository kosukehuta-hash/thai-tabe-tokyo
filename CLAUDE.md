@AGENTS.md

# THAI TABE TOKYO Ver.1（MVP）プロジェクト固有ルール

## 仕様書
- 正式な仕様書は `docs/THAI_TABE_TOKYO_要件仕様書_Ver1_実装開始版.xlsx` とする
- 認証・店舗メモ機能（U04・U05、store_visit_notes等）は `docs/THAI_TABE_TOKYO_要件仕様書_Ver2_レビュー修正版.xlsx` を正式な仕様書とする
- Ver1・Ver2いずれのExcel仕様書も変更しない
- 実装前に対象機能に関係するシートを確認する

## MVP範囲
- MVP対象はU01〜U05と検索・画面遷移、認証（サインアップ・ログイン・ログアウト）、店舗メモCRUDとする
- 仕様書にない機能や技術を独自に追加しない

## 技術構成
- 採用技術はNext.js 16.3.4、React 19.2.8、TypeScript、CSS Modules、Supabase
- Tailwind CSSや追加のUIライブラリを導入しない
- 認証には@supabase/ssrの追加を許可する
- Next.js 16.3.4ではmiddleware.tsではなくproxy.tsを使用する

## DB
- DBはareas、dishes、stores、store_dishes、store_photosの既存5テーブルに、store_visit_notes（店舗メモ）を加えた6テーブルとする
- auth.usersはSupabaseが管理する組み込みテーブルであり、独自migrationの作成対象外とする
- walk_minutesは手入力とし、地図APIを追加しない

## 環境変数・セキュリティ
- ブラウザで使用する環境変数はNEXT_PUBLIC_SUPABASE_URLとNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYだけ
- 認証機能を追加しても、上記2つ以外の公開環境変数は追加しない
- SUPABASE_SECRET_KEYとSUPABASE_SERVICE_ROLE_KEYはMVPで設定・使用・出力しない（認証・店舗メモ機能でも同様とする）
- 環境変数の実値は、ローカルでは.env.local、本番ではVercel Environment Variablesだけに保存し、コード、GitHub、仕様書、README、CLAUDE.md、チャット、通常ログには記載・出力しない
- .env.localはGit管理対象外とし、.env.exampleには使用する2つの環境変数名だけを記載して実値は入れない

## 進め方
- 仕様にない判断が必要な場合は、推測せず作業を止めて確認する
- コミット、push、mainへのマージは明示的に依頼された場合だけ行う
- 実装後は関連する受け入れ条件とテスト仕様を確認する

## PR管理

### 通常の機能修正・コード修正
- 作業ブランチ作成
- commit
- push
- PR作成
- CI確認
- mainへmerge

### PR作成時
PR本文に必ず以下のセクションを含める。

```
## PR一覧用情報
- 主な対応内容：
- 関連Issue：―
- カテゴリ：
- 備考：
```

### 記入ルール
- 各項目は1行で記載する
- 主な対応内容は空欄にしない
- 関連Issueがなければ「―」
- カテゴリは`docs/PR一覧.md`のカテゴリ別集計に存在する名称を正確に使う
- カテゴリが複数ある場合は「、」区切り
- 備考がなければ空欄でよい
- 推測でカテゴリや内容を補完しない

### PRマージ後
通常は`docs/PR一覧.md`を手動で更新しない。GitHub Actions（`.github/workflows/update-pr-history.yml`）がPRマージ時に自動で以下を行う。
- `docs/PR一覧.md`へのPR追加
- PR総数の更新
- カテゴリ別集計の更新
- Prettierによる整形
- `github-actions[bot]`名義でのcommit
- mainへのpush

### 手動更新を使う場合
以下の場合のみ、手動で`docs/PR一覧.md`を更新する。
- update-pr-history workflowが失敗した場合
- 自動化導入前の過去PRを追記する場合
- その他、自動更新では対応できない明確な理由がある場合

### 手動更新時のルール
手動更新が必要な場合は、GitHub上の事実だけを使う。
- 推測で書かない
- PR番号、PRタイトル、主な対応内容、関連Issue、状態、マージ日、備考をGitHubで確認して反映する

### docs/PR一覧.md だけを手動更新する場合の手順
- 新しい作業ブランチやPRは作成しない
- mainを最新化した状態で更新する
- `docs/PR一覧.md`だけをcommitする
- mainへ直接pushする
- PRは作成しない
