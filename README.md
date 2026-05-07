# 下田マップ（下田MAP）

`C:\Users\vagab\Desktop\map` で開発していたイラストマップアプリをコピーし、下田エリア向けにカスタムするためのプロジェクトです。  
Google スプレッドシートをマスタとし、**高解像度イラストマップ**（既定: [`map/300.png`](map/300.png)）上に店舗ピンを表示するシングルページアプリです。  
Mapbox GL JS の **空白スタイル**（`empty-v9`）に画像を重ね、**世界地図を主表示にしません**。

**テンプレート元リポジトリ**: [https://github.com/Stand-koike/map](https://github.com/Stand-koike/map)

初期状態では [`map/index.html`](map/index.html) の `MAPBOX_TOKEN` と `SHEET_ID` はプレースホルダです。元のプロジェクトファイルから転記するか、新規発行してください。イラストと `MAP_IMAGE`（四隅座標・`*.pgw`）は外浦海岸向けのままです。**下田用に差し替え**してください。

---

## ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 要件定義 |
| [docs/SPREADSHEET.md](docs/SPREADSHEET.md) | **スプレッドシート列仕様（マスタ）** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | モジュール構成とデータフロー |
| [docs/EMBEDDING.md](docs/EMBEDDING.md) | 観光協会サイトへの iframe 埋め込み |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 運用・デプロイ・外部サービス |
| [map/README.md](map/README.md) | `map/` フォルダ内アセットと起動手順 |
| [docs/samples/spreadsheet-headers.csv](docs/samples/spreadsheet-headers.csv) | 新規シート用ヘッダー行 |

---

## 主な機能

- **イラストマップ**: `mapbox://styles/mapbox/empty-v9` + `CONFIG.MAP_IMAGE` で指定した画像（本番既定は **`300.png`** と四隅 WGS84 座標、**`300.pgw`** と整合）。旧解像度の **`map.png` / `map.wld`** に戻すことも可能（[`map/README.md`](map/README.md) 参照）
- **カメラ**: 初期 **bearing（方位）**・**pitch（仰角）** によりイラストを斜めから見る表示に調整可能
- **店舗データ**: Google Sheets を JSONP（gviz）で取得。住所・電話（日英）、`store_id`、カテゴリ、詳細、クーポン、ニュース、**営業時間**、**タグ**、**追加画像 URL（最大 3 枚相当のスライダー）** 等
- **UI**: カテゴリ絞り込み、**タグ絞り込み**、レイヤー表示切替（ピン / ルート / エリア枠）、カード一覧（PC では折りたたみ可能なサイドバー）、詳細モーダル（**画像スライダー**）、ニュースティッカー、日英切替、現在地（任意）
- **更新**: 既定 30 秒ポーリング、差分があれば再描画。`?refresh=1` で強制再取得
- **計測**: Google Analytics（`G-XXXXXXXXXX` を本番の GA4 測定 ID に差し替え）

---

## セットアップ

1. [`map/index.html`](map/index.html) を開き、冒頭の **`CONFIG`** を環境に合わせて設定する。
   - `MAPBOX_TOKEN` — Mapbox アクセストークン
   - `SHEET_ID` — スプレッドシート ID
   - 必要に応じて `POLL_INTERVAL`（`0` でポーリング停止）、`MAP_IMAGE`（画像 URL・四隅座標・`latOffset` / `lngOffset`・`bearing` / `pitch` 等）
2. スプレッドシートは [docs/SPREADSHEET.md](docs/SPREADSHEET.md) の列定義に合わせ、**リンクを知っている全員が閲覧可**など gviz が読める公開設定にする。
3. イラスト画像とワールドファイル（`.pgw` または `.wld`）は `map/` 内に置き、`CONFIG.MAP_IMAGE.url` とパスを一致させる。

**ローカル確認**: `file://` だと WebGL テクスチャがブロックされることがあるため、簡易 HTTP サーバーまたは Live Server の利用を推奨します。リポジトリ直下の [`serve-map.ps1`](serve-map.ps1) は `map/` を `http://localhost:8080/` で立ち上げます（`python -m http.server`、なければ `npx serve`）。

```powershell
cd "C:\Users\vagab\Desktop\下田MAP"
.\serve-map.ps1
```

ポートを変える場合: `$env:MAP_PORT=9000; .\serve-map.ps1`

静的ファイルとして任意の HTTPS ホストに配置可能です。

---

## 技術スタック

- Mapbox GL JS **3.1.0**
- Google Sheets（Visualization API / JSONP）
- ビルド不要（単一 HTML: [`map/index.html`](map/index.html)）

---

## 注意

- Mapbox・Google の利用規約・料金に従ってください。
- 公開スプレッドシートに載せる個人情報の範囲は運用で管理してください。
- Geolocation は HTTPS 推奨。
- クライアントに含まれる Mapbox トークンは URL 制限などで保護することを推奨（[docs/OPERATIONS.md](docs/OPERATIONS.md)）。
