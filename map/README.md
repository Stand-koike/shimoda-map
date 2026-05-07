# map/ — アプリ本体フォルダ

このフォルダには下田マップアプリの **全リソース** が入っています（元テンプレートはデスクトップの `map` プロジェクトと同じ構成です）。  
ブラウザで `index.html` を開くか、ローカルサーバー経由でアクセスしてください。

---

## ファイル一覧

| ファイル | 説明 |
|----------|------|
| `index.html` | アプリ本体（単一 HTML・ビルド不要） |
| `300.png` | イラストマップ画像（2500×2781 px）※**現在使用中** |
| `300.pgw` | `300.png` 用のワールドファイル（EPSG:6676 / JGD2011 座標系VIII） |
| `300_original.png` | 差し替え前の 300.png バックアップ（**削除しない**） |
| `map.png` | 旧イラストマップ画像（937×755 px）※前バージョンのバックアップ |
| `map.wld` | `map.png` の地理参照ファイル（EPSG:3857） |
| `map.png.aux.xml` | GDAL メタデータ（参考情報） |

---

## 起動方法

### ローカルサーバー（推奨）

`file://` 直接開きだと WebGL テクスチャの読み込みが Chrome でブロックされる場合があります。  
Python が入っている場合は以下で簡易サーバーを立ち上げてください：

```bash
cd map
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開く。

### VS Code Live Server

VS Code の **Live Server** 拡張機能を使う場合は `index.html` を右クリック →「Open with Live Server」。

---

## 初期設定

`index.html` 冒頭の `CONFIG` オブジェクトを編集します：

```js
const CONFIG = {
    MAPBOX_TOKEN: 'pk.YOUR_TOKEN_HERE',   // Mapbox アクセストークン
    SHEET_ID:     'YOUR_SHEET_ID_HERE',   // Google スプレッドシート ID
    POLL_INTERVAL: 30000,                 // ポーリング間隔(ms)。0 で無効
    ...
};
```

スプレッドシートの列仕様は [`../docs/SPREADSHEET.md`](../docs/SPREADSHEET.md) を参照。

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

1. 新しい画像を `300.png`（または別名）として保存
2. 同名のワールドファイル（`.pgw`）を用意
3. `index.html` の `CONFIG.MAP_IMAGE.url` と `coordinates` を更新
4. ピン位置に微妙なズレがある場合は `latOffset` / `lngOffset`（度単位）で補正可能

### 元の map.png に戻す方法

`CONFIG.MAP_IMAGE` を以下のように書き換えるだけで戻せます：

```js
MAP_IMAGE: {
    url: 'map.png',
    coordinates: [
        [138.9677986, 34.6791875],  // NW
        [138.9796757, 34.6791875],  // NE
        [138.9796757, 34.6713192],  // SE
        [138.9677986, 34.6713192]   // SW
    ],
    center:    [138.9737371, 34.6752533],
    initZoom:  15, minZoom: 13, maxZoom: 18,
    maxBounds: [[138.963, 34.667], [138.984, 34.683]]
},
```

詳細は [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) を参照。
