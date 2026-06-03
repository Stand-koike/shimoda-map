# 外浦（sotoura）

| 項目 | 値 |
|------|-----|
| slug | `sotoura` |
| 表示名 | 外浦マップ |
| ステータス | **昼マップ反映済み**（ブランチ `area/sotoura`） |
| 本番 Pages | 未公開（下田 `main` は変更しない） |

## 素材

| ファイル | 役割 |
|----------|------|
| `production/300.png` | 昼イラスト（Git 除外・ローカル必須） |
| `production/300.pgw` | ワールドファイル（EPSG:6676、Git 管理） |
| `production/coordinates.json` | WGS84 四隅・`web/config.js` 転記元 |

夕・夜 PNG は未配置。追加時は `MAP_IMAGE.dayOnly` を `false` にし `urlSunset` / `urlNight` を設定。

## ブランチでの確認

```powershell
git checkout area/sotoura
Copy-Item clients\sotoura\production\300.png web\300.png   # PNG は gitignore のため手元でコピー
cd web
python -m http.server 8080
# http://localhost:8080/ — タイトル「外浦マップ」、昼 1 枚表示
```

座標の微調整: `web/config.local.js` で `MAP_IMAGE.latOffset` / `lngOffset`。

## 後日: 別 GitHub Pages 公開

1. リポジトリの **Settings → Pages → Deploy from branch** で `area/sotoura` / `root`（または外浦専用 fork）
2. `secrets.local.js` または Actions secrets に外浦用 `SHEET_ID` を設定
3. 必要なら GA 測定 ID を外浦用に差し替え

`main` へマージする場合は下田用 `config.js` と `100.png` 系を維持する別デプロイ戦略を検討すること。

## チェックリスト

```
[x] production/300.png + 300.pgw
[x] production/coordinates.json
[x] web/index.html dayOnly フォールバック
[x] area/sotoura: web/300.png + config.js（昼のみ）
[ ] 外浦用 SHEET_ID（後日）
[ ] 別 Pages 公開（後日）
[ ] 夕/夜マップ（後日）
```

詳細: [production/README.md](production/README.md)
