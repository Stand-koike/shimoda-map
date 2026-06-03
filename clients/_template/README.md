# 案件テンプレート

新規クライアント案件はこのフォルダをコピーして `{slug}/` を作成する。

```powershell
# 例: 外浦 → clients/sotoura/
Copy-Item -Recurse clients\_template clients\sotoura
```

## チェックリスト

```
[ ] README.md に案件名・slug・ステータスを記入
[ ] source/map/ にクライアント受領データ（tif/psd 等）を保存
[ ] production/ に確定 PNG + 同名 .wld をペアで配置
[ ] production/coordinates.json を作成（WGS84 四隅）
[ ] geo/ に神輿 GeoJSON（必要な場合）
[ ] ops/ にスプレッドシート URL・納品メモ（Git 除外）
[ ] production/* を web/ にコピー
[ ] web/config.js を更新
[ ] secrets.local.js に SHEET_ID を設定
[ ] localhost で動作確認
```

## フォルダ役割

| フォルダ | Git | 用途 |
|----------|-----|------|
| `source/` | 除外 | クライアントから受け取った生データ |
| `production/` | PNG/TIF 除外 | 確定版イラスト + .wld + coordinates.json |
| `geo/` | 可 | 神輿ルート GeoJSON の正本 |
| `ops/` | 除外 | 運用メモ・シート URL |

詳細: [production/README.md](production/README.md)
