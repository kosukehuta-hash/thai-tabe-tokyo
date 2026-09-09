@AGENTS.md

# THAI TABE TOKYO Ver.1（MVP）プロジェクト固有ルール

## 仕様書
- 正式な仕様書は `docs/THAI_TABE_TOKYO_要件仕様書_Ver1_実装開始版.xlsx` とする
- Excel仕様書を変更しない
- 実装前に対象機能に関係するシートを確認する

## MVP範囲
- MVP対象はU01・U02・U03と検索・画面遷移のみ
- 仕様書にない機能や技術を独自に追加しない

## 技術構成
- 採用技術はNext.js 16.3.4、React 19.2.8、TypeScript、CSS Modules、Supabase
- Tailwind CSSや追加のUIライブラリを導入しない

## DB
- DBはareas、dishes、stores、store_dishes、store_photosの5テーブル
- walk_minutesは手入力とし、地図APIを追加しない

## 環境変数・セキュリティ
- ブラウザで使用する環境変数はNEXT_PUBLIC_SUPABASE_URLとNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEYだけ
- SUPABASE_SECRET_KEYとSUPABASE_SERVICE_ROLE_KEYはMVPで設定・使用・出力しない
- 環境変数の実値は、ローカルでは.env.local、本番ではVercel Environment Variablesだけに保存し、コード、GitHub、仕様書、README、CLAUDE.md、チャット、通常ログには記載・出力しない
- .env.localはGit管理対象外とし、.env.exampleには使用する2つの環境変数名だけを記載して実値は入れない

## 進め方
- 仕様にない判断が必要な場合は、推測せず作業を止めて確認する
- コミット、push、mainへのマージは明示的に依頼された場合だけ行う
- 実装後は関連する受け入れ条件とテスト仕様を確認する
