# `web/` — ブラウザ向け静的ファイル

このフォルダには **マップ画面の HTML・画像・秘密設定のサンプル** が入ります。**Web 用アセット置き場**という意味で `web/` と名付けています。  
元テンプレートはデスクトップの別プロジェクト `map` から流用しています。  

**ローカルプレビュー**（このフォルダで）:

```bash
python -m http.server 8080
```

→ `http://localhost:8080/` で `index.html` が開く（`secrets.local.js` が要る）。`file://` で直接開くと WebGL がブロックされることがあります。

VS Code の **Live Server** で `index.html` を開いてもよい。

---

| ファイル | 説明 |
|----------|------|
| `index.html` | アプリ本体（単一 HTML・ビルド不要） |
| `shimodamap.png` | **現在使用中**のイラストマップ画像（`CONFIG.MAP_IMAGE.url` と一致） |
| `shimodamap.wld` | 上記ラスタのワールドファイル（EPSG:6676）。ブラウザは読まないが、画像差し替え時に四隅座標を再計算する際に利用 |
| `secrets.example.js` | サンプル（**コミットする**）。`secrets.local.js` として複製して編集 |
| `secrets.local.js` | Mapbox トークン・`SHEET_ID`（**コミットしない**）。`index.html` が先に読み込む |
| `gas-line-webhook.js` | GAS 用テンプレート（**プレースホルダのみ**コミット）。LINE シークレットは GAS 側で設定 |
| `gas-line-webhook.local.js` | 任意：ローカルに実値入りの全文を保存して GAS へ貼り付け用（**コミットしない**） |
| `mikoshi/index.html` | 神輿ルート単体デモ（Mapbox + Turf）。**メイン index でもレイヤーパネル「神輿ルート」から同じデータを表示可** — 手順は [mikoshi/README.md](mikoshi/README.md) |

**神輿（メイン地図）**: レイヤーパネルで **「神輿ルート」ON** かつ **`checkpoints.geojson` の `arrival_time` で囲まれた時間帯内**のみ表示・移動します。日付が合わないときの動作確認は URL に  
`?mikoshiPreview=1` を付ける（先頭通過を **今** に合わせてシフト。**数秒後**にしたいときだけ `mikoshiLeadSec=30` 等を追加）。**プレビューだけ**スケジュール時刻を **約120倍**の速さで進めます（体感で進む。さらに速くは `mikoshiSpeed=300` など **1〜4000**）。**本番当日・プレビュー無し**のときは従来どおり実時間です。

---

## 初期設定

1. `secrets.example.js` を `secrets.local.js` にコピーし、`MAPBOX_TOKEN` と `SHEET_ID` を設定する。  
2. `index.html` 内の `CONFIG` で `MAP_IMAGE`・ポーリング等を必要に応じて編集する。

列の対応関係は **`index.html` の `CONFIG.COLS`** を正とする。詳細な運用仕様は開発者がローカルで保持する `docs/`（Git 対象外）を参照。

---

## UI 機能（PC）

| 機能 | 操作 |
|------|------|
| カードパネル折りたたみ | パネル右端の `‹ ›` ボタンをクリック |
| カテゴリ絞り込み | 左上「絞り込み」ボタン |
| レイヤー切替 | 左上「レイヤー」ボタン |
| 詳細表示 | カードまたはピンをクリック |
| 言語切替（日/英） | 左上「JP」ボタン |
| 現在地表示 | 右下の GPS ボタン |

---

## 画像の差し替え

1. TIFF を出力する場合は PNG に変換し（ブラウザは TIFF を直接読み込めないことが多い）、**`-co WORLDFILE=YES`** などで **`.wld` または `.pgw`** を生成する  
2. `shimodamap.png`（または別名）をこのフォルダに置き、`CONFIG.MAP_IMAGE.url` と一致させる  
3. ワールドファイルから四隅を **WGS84（経度・緯度）** に換算し、`CONFIG.MAP_IMAGE.coordinates`・`center`・`maxBounds` を更新する（`.wld` はアプリが読むわけではない）  
4. ピンと画像のずれは `latOffset` / `lngOffset`（度単位）で微調整可能  
