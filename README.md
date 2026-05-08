# 下田マップ（下田MAP）

Google スプレッドシートをデータソースに、**イラスト地図**上へピンを表示するシングルページアプリです。  
静的ファイルのみ（ビルド不要）。テンプレート元: [Stand-koike/map](https://github.com/Stand-koike/map)

---

## このリポジトリに含まれるもの（公開用の最小構成）

| パス | 内容 |
|------|------|
| **`web/`** | 本番相当の静的ファイル（`index.html`・画像・`secrets.example.js`・GAS 用テンプレ `gas-line-webhook.js`） |
| **`README.md`** | 本ファイル |
| **`SECURITY.md`** | 秘密情報の扱い（GitHub セキュリティポリシー用の簡易版） |

**チーム内の設計書・スプレッドシート列の詳細は `docs/` に置き、Git には含めません**（`.gitignore` 済み）。一覧は `docs/README.md`。

---

## セットアップ（クローン後）

1. **`web/secrets.example.js` を `web/secrets.local.js` にコピー**し、`MAPBOX_TOKEN`（Mapbox 公開トークン `pk.*`）と `SHEET_ID`（スプレッドシート ID）を入れる。  
2. スプレッドシートは **「リンクを知っている全員が閲覧可」** 等、ブラウザから gviz で読める公開設定にする。  
3. 列の意味と列順は **`web/index.html` 内の `CONFIG.COLS`** を正とする（0 始まりインデックス）。  
4. イラスト画像・`MAP_IMAGE` の四隅座標などは同じく `CONFIG` で調整。

### LIVE 投稿（黒船祭マップ運用）

- GAS で `setupSheets()` を実行すると **`posts`** / **`venue_spots`** / **`bot_sessions`** などが作られます（既存 **`user_map`** は列拡張しても読み込み互換があります）。  
- マップは **`posts`** シートのみを読みます（名前は `secrets.local.js` の `POSTS_SHEET` で変更可能、既定 `posts`）。  
- **モデレーション**: `posts.isVisible` を `FALSE` にするとブラウザ側で非表示になります（行削除も可）。  
- **運営スポット**: `venue_spots` に `spotId,name,lat,lng,type` で会場ピンを登録してから、運営ロールが LINE で番号選択します。

**ローカルで試す**:

```powershell
cd web
python -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開く（別ターミナルでなくてよい）。

**デプロイ**: `web/` 以下を Netlify / S3+CloudFront / GitHub Pages（`web` をドキュメントルートに）等へそのまま配置できます。

### GitHub Pages（GitHub Actions）

1. リポジトリ **Settings → Pages** で **Build and deployment の Source を「GitHub Actions」** にする。  
2. **Settings → Secrets and variables → Actions** に Repository secrets を登録する（`.github/workflows/pages.yml` と名前を一致させる）。  
   - **`MAPBOX_PUBLIC_TOKEN`** … Mapbox 公開トークン `pk.*`  
   - **`GOOGLE_SHEET_ID`** … スプレッドシート ID（URL の `/d/` と `/edit` のあいだ）  
   - **`POSTS_SHEET`**（任意）… 既定は `posts`  
3. `main` へ push すると `.github/workflows/pages.yml` が走り、**artifact として `web/` だけ**が公開される。ワークフロー内で **`web/secrets.local.js` をシークレットから生成**するため、ローカル用ファイルを Git に含めなくてよい。既定ブランチが `main` でない場合は `pages.yml` の `on.push.branches` を合わせる。

---

## GitHub に載せないもの（`.gitignore`）

- `web/secrets.local.js`・`web/gas-line-webhook.local.js`（実トークン入り）
- `docs/`（運用・設計メモなどローカル専用）
- `.env*`

過去にトークンをコミットした場合は **Mapbox / LINE で再発行**してください。

---

## 技術スタック

- Mapbox GL JS 3.x（空白スタイル＋イラスト画像オーバーレイ）
- Google Sheets（Visualization API / JSONP）
