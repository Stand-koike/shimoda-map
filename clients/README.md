# clients/ — 案件素材・設定の置き場

デジタルマップの **クライアント案件ごと** に素材とメモを整理する。

## ルール

| パス | 役割 |
|------|------|
| [`web/`](web/) | **今デプロイ中**のサイト（GitHub Pages） |
| `clients/{slug}/` | 案件ごとの素材正本 |
| `clients/_template/` | 新規案件用テンプレート |

**素材の流れ**: `clients/{slug}/production/` →（コピー）→ `web/` → デプロイ

## 案件一覧

| slug | 案件名 | ステータス | 備考 |
|------|--------|------------|------|
| `shimoda` | 下田 | 本番運用中 | 現行 `web/` は下田設定 |
| `sotoura` | 外浦 | 素材待ち | 新規案件 |

## 新規案件の作り方

```powershell
Copy-Item -Recurse clients\_template clients\{slug}
# clients/{slug}/README.md を編集
# production/ に PNG + .wld を配置
```

## 共通ワークフロー

1. **受領** — `source/map/` に tif/psd 等を保存
2. **確定** — `production/` に PNG + 同名 `.wld` をペア配置
3. **座標** — `.wld` から `coordinates.json` を作成
4. **反映** — `production/*` を `web/` にコピー、`config.js` 更新
5. **データ** — スプレッドシート + `secrets.local.js`
6. **確認** — `python -m http.server 8080`（`web/` で）
7. **公開** — commit & push

PNG + WLD の詳細: [`_template/production/README.md`](_template/production/README.md)

Agent 依頼例:

> `clients/sotoura/production/` に PNG3枚と wld を置いた。座標換算と config 更新、web への反映をお願い
