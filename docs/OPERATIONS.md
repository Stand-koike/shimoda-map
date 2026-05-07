# 運用・デプロイ・外部サービス

---

## 1. 設定箇所（[`map/index.html`](../map/index.html)）

| 定数 | 説明 |
|------|------|
| `CONFIG.MAPBOX_TOKEN` | Mapbox アクセストークン（公開クライアント用。利用規約・ローテーションに注意） |
| `CONFIG.SHEET_ID` | Google スプレッドシート ID（URL の `/d/` と `/edit` の間） |
| `CONFIG.MAP_IMAGE` | イラスト画像の URL および四隅座標・表示範囲・オプションで bearing / pitch。本番既定は **`300.png`** と **`300.pgw`** 由来の座標。**画像を差し替えたらワールドファイルと四隅 WGS84 を再計算**（旧 `map.png` / `map.wld` に戻す場合も同様）。 |
| `CONFIG.POLL_INTERVAL` | データ再取得間隔（ミリ秒）。`0` でポーリング無効 |

---

## 2. データ更新

- **自動**: `POLL_INTERVAL` ごとに gviz で再取得。内容に変化があればマーカー等を更新。
- **強制**: URL に **`?refresh=1`** を付けて開くと、初回ハッシュをクリアして再読み込み（AppSheet 連携の Webhook からブラウザを開く用途を想定）。

---

## 3. Google スプレッドシート

- 公開設定は [SPREADSHEET.md](./SPREADSHEET.md) を参照。
- **店舗画像**は、Drive に手動で貼る運用と AppSheet の画像アップロードのどちらでもよい。手順・注意点は [SPREADSHEET.md](./SPREADSHEET.md) の「画像 URL の登録（手動・AppSheet の両方）」を参照。
- 列定義を変えた場合は `CONFIG.COLS` とドキュメントを同期すること。

---

## 4. Google Analytics

- `G-XXXXXXXXXX` はプレースホルダです。本番では GA4 の測定 ID に差し替えます。
- iframe 埋め込み時、親ページと子ページで二重計測にならないよう、運用で調整してください。

---

## 5. デプロイ

- 静的ファイル（`index.html`、イラスト画像、`300.pgw` または `map.wld` 等）を **GitHub Pages / Netlify / Vercel / 自サーバ** 等に配置。
- ルートに `map/` フォルダごと置くか、URL を `CONFIG` や `base` タグで合わせる。

---

## 6. セキュリティ・注意

- **トークン**: Mapbox トークンはクライアントに含まれるため、URL 制限（Mapbox ダッシュボード）を推奨。
- **スプレッドシート**: 公開読み取りに載せる情報の範囲を限定。
- **位置情報**: ユーザーが拒否した場合もマップは利用可能（現在地のみ非表示）。
