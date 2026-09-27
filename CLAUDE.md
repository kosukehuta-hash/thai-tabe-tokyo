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
PR本文に必ず以下の4項目を含める（`.github/pull_request_template.md`のテンプレートを使う）。

```
## 変更内容
- 実際に変更した内容を具体的に記載する

## 関連Issue
- #XX（なければ「なし」）

## テスト内容
- 実施したテストと結果を記載する（例：lint / build / Vitest / Playwright / 手動確認）

## 補足
- 注意点、未対応事項、影響範囲など（なければ「なし」）
```

PRタイトルは変更内容が分かる具体的な内容にする（悪い例：`fix: review feedback`／良い例：`fix: U03の戻る導線と検索条件保持を改善`）。

### 記入ルール
- 4項目すべての見出しを残し、テンプレートの空欄（`-`のみ）のまま提出しない
- 変更内容・テスト内容は空欄にしない
- 関連Issue・補足がなければ「なし」と明記する（空欄・`-`のみは不可）
- 推測で内容を補完しない
- PR作成・更新時にGitHub Actions（`.github/workflows/check-pr-body.yml`）が上記4項目の記載を自動チェックする。不足があればCIが失敗するので、指摘に従って修正する

### PR本文とdocs/PR一覧.mdの役割分担
- PR本文は詳細情報として記載する（4項目とも省略せず具体的に書く）
- `docs/PR一覧.md`は一覧性を優先し、PR本文の内容を短く記録する簡潔な履歴一覧とする
- `docs/PR一覧.md`へ記録する際の目安文字数
  - 変更内容：100文字程度まで
  - 関連Issue：そのまま記載
  - テスト内容：80文字程度まで
  - 備考：60文字程度まで
- 文字数を超える場合は末尾を「…」として省略する
- PR本文にない内容を推測・要約・補完して追加しない（実際にPR本文へ書かれている内容だけを使う）

### PRマージ後
通常は`docs/PR一覧.md`を手動で更新しない。GitHub Actions（`.github/workflows/update-pr-history.yml`）がPRマージ時に、PR本文の4項目から自動で以下を行う。
- `docs/PR一覧.md`へのPR追加（PR#・タイトル・変更内容・関連Issue・テスト内容・状態・マージ日・備考、上記の目安文字数で短く整形）
- PR総数の更新
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
- PR番号、PRタイトル、変更内容、関連Issue、テスト内容、状態、マージ日、備考をGitHubで確認して反映する

### docs/PR一覧.md だけを手動更新する場合の手順
- 新しい作業ブランチやPRは作成しない
- mainを最新化した状態で更新する
- `docs/PR一覧.md`だけをcommitする
- mainへ直接pushする
- PRは作成しない
