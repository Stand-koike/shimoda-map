# 外浦（sotoura）— 参照用（本リポ）

| 項目 | 値 |
|------|-----|
| **本番リポ** | [**Stand-koike/sotoura-map**](https://github.com/Stand-koike/sotoura-map) |
| ローカル clone | `Stand/01.案件/外浦MAP/` |
| 本リポの役割 | `production/` の座標・`.pgw` 記録（**`web/` は下田のまま触らない**） |

外浦の `web/` 反映・Pages 公開・Cursor 作業は **sotoura-map リポのみ** で行ってください。

## 素材（同期の目安）

| ファイル | 備考 |
|----------|------|
| `production/300.pgw` | Git 管理 |
| `production/coordinates.json` | `sotoura-map` の `web/config.js` と同期 |
| `production/300.png` | gitignore → `sotoura-map` の `web/300.png` にコピー |

初回セットアップ: [sotoura-map の SETUP_GITHUB.md](https://github.com/Stand-koike/sotoura-map/blob/main/SETUP_GITHUB.md)（リポ作成後）

## 履歴

- `area/sotoura` ブランチ … 単一リポでの試行。**アーカイブ**（本番は `sotoura-map` へ移行）

詳細: [production/README.md](production/README.md)
