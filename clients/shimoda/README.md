# 下田（shimoda）

| 項目 | 内容 |
|------|------|
| slug | `shimoda` |
| 案件名 | 下田 |
| ステータス | **本番運用中** |
| 公開 | GitHub Pages（`web/` = 下田設定） |

## フォルダ

| パス | 内容 |
|------|------|
| `source/map/` | 制作元データ（旧 `meta/`、`下田.tif` 等） |
| `production/` | 確定版 100.png 系 + `100.wld` + `coordinates.json` |
| `geo/` | 神輿 GeoJSON 正本 |
| `ops/` | 運用メモ（Git 除外） |

## web/ との関係

現行デプロイは `web/` が下田のまま。素材の正本は `production/`。

反映時:
1. `production/100*.png` と `100.wld` を `web/` にコピー
2. `production/coordinates.json` → `web/config.js` の `MAP_IMAGE`
3. `geo/*.geojson` → `web/public/data/`

## 設定ファイル

- [web/config.js](../../web/config.js)
- [web/secrets.local.js](../../web/secrets.local.js)（Git 除外）
