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

**ローカルで試す**:

```powershell
cd web
python -m http.server 8080
```

ブラウザで `http://localhost:8080/` を開く（別ターミナルでなくてよい）。

**デプロイ**: `web/` 以下を Netlify / S3+CloudFront / GitHub Pages（`web` をドキュメントルートに）等へそのまま配置できます。

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
