# セキュリティ

## 脆弱性の報告

Issue にて受け付けます（公開情報のみを含めてください）。

## 秘密情報

- **Mapbox** の `pk.*` と **Google スプレッドシート ID** は `web/secrets.local.js` にのみ記述し、**Git にコミットしない**（サンプルは `web/secrets.example.js`）。
- **LINE** のチャネルアクセストークン等は `web/gas-line-webhook.js` にはプレースホルダのみ置き、実値は Google Apps Script プロジェクトまたはローカルの `web/gas-line-webhook.local.js` で管理する。
- フロントに載る `pk` トークンは **Mapbox で URL 制限**を必ず設定すること。
- 履歴に秘密が含まれる場合はトークン **再発行**を推奨する。
