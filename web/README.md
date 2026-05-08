# `web/` — ブラウザ向け静的ファイル

このフォルダには **マップ画面の HTML・画像・秘密設定のサンプル** が入ります（ルートの「地図アプリ」とは別で、**Web サイト用アセット置き場**という意味の名前です）。  
元テンプレートはデスクトップの別プロジェクト `map` から流用しています。  
ブラウザで `index.html` を開くか、ルートの [`serve-map.ps1`](../serve-map.ps1) 経由でアクセスしてください。

---

## ファイル一覧

| ファイル | 説明 |
|----------|------|
| `index.html` | アプリ本体（単一 HTML・ビルド不要） |
| `shimodamap.png` | **現在使用中**のイラストマップ画像（`CONFIG.MAP_IMAGE.url` と一致） |
| `shimodamap.wld` | 上記ラスタのワールドファイル（EPSG:6676）。ブラウザは読まないが、画像差し替え時に四隅座標を再計算する際に利用 |
| `secrets.example.js` | サンプル（**コミットする**）。`secrets.local.js` として複製して編集 |
| `secrets.local.js` | Mapbox トークン・`SHEET_ID`（**コミットしない**）。`index.html` が先に読み込む |
| `gas-line-webhook.js` | GAS 用テンプレート（**プレースホルダのみ**コミット）。LINE シークレットは GAS 側で設定 |
| `gas-line-webhook.local.js` | 任意：ローカルに実値入りの全文を保存して GAS へ貼り付け用（**コミットしない**） |

---

## 起動方法

### ローカルサーバー（推奨）

`file://` 直接開きだと WebGL テクスチャの読み込みが Chrome でブロックされる場合があります。  
Python が入っている場合は以下で簡易サーバーを立ち上げてください：

```bash
cd web
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開く。

### VS Code Live Server

VS Code の **Live Server** 拡張機能を使う場合は `index.html` を右クリック →「Open with Live Server」。

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
