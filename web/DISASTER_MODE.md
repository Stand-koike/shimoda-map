# 災害時モード（指定緊急避難場所 / 指定避難所）

下田市 **令和6年4月1日現在** の公式リストをマップに載せ、店舗情報を隠して避難施設だけを見るモードです。

## 復元ポイント（ver.1）

災害時モード実装直前の本番相当コードは Git タグで固定しています。

```bash
git checkout v1.0-pre-disaster-mode
```

通常運用へ戻す場合は `main`（または該当リリース）をチェックアウトしてください。

## データ

| 種別 | 件数 | シート名（既定） | ローカル正本 |
|------|------|------------------|--------------|
| 指定緊急避難場所 | 54 | `evacuation_places` | `web/public/data/evacuation_places.csv` / `disaster_evac.json` |
| 指定避難所 | 28 | `evacuation_shelters` | `web/public/data/evacuation_shelters.csv` / `disaster_evac.json` |

- 緊急避難場所の緯度経度・対応災害種: [静岡県オープンデータ](https://opendata.pref.shizuoka.jp/dataset/9449.html)
- 避難所の備考: 下田市 PDF。座標は同一住所の緊急避難場所と突合

## スプレッドシートへの登録

1. `web/gas-setup-disaster-sheets.js` を既存 GAS プロジェクトに追加（`gas-line-webhook.js` と同居可）
2. エディタで **`setupDisasterSheets`** を実行
3. 末尾に `evacuation_places` / `evacuation_shelters` が追加される（先頭の店舗マスタは動かさない）
4. 既存どおり「リンクを知っている全員が閲覧可」

既存シートにデータ行がある場合は **再投入しません**（ヘッダーだけ整えます）。作り直すときはシートを削除してから再実行してください。

`gas-setup-all-sheets-dummy.js` の `setupAllSheetsWithDummyData` からも、同ファイルが読み込まれていれば自動で呼ばれます。

## フロントの動き

- 左上 **「災害時」** トグル（`?disaster=1` でも起動）
- ON 時: 店舗ピン・LIVE・祭スケジュール・神輿を OFF、**国土地理院淡色地図**を背景表示（イラスト地図は非表示）、範囲を市域寄りに拡大
- フィルター: 緊急避難場所 / 避難所、災害種別チップ
- カード・詳細: 種別、住所、電話、対応災害（または避難所備考）、Google Maps 経路
- シート未作成でも `public/data/disaster_evac.json` で動作

## 設定キー

`secrets.local.js` / GitHub Actions secrets（任意）:

- `EVAC_PLACES_SHEET`（既定 `evacuation_places`）
- `EVAC_SHELTERS_SHEET`（既定 `evacuation_shelters`）
