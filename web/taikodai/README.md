# 太鼓台ランディングページ

下田八幡神社例大祭の十四番太鼓台を紹介するエディトリアル型ランディングページです。

## URL

- ローカル: `http://localhost:8080/taikodai/`
- GitHub Pages: `/taikodai/`

## 画像の配置

`index.html` と同じディレクトリ（`web/taikodai/`）に、次のファイル名で JPEG を置いてください。

- `01_一番太鼓_中原町_鷹.jpg`
- `02_二番太鼓_原町_仁徳天皇.jpg`
- …（全14枚、元 HTML と同じファイル名）

## デザイン

[DESIGN.md](../../DESIGN.md)（MacBook Neo インスパイア）の原則に基づき、以下を採用しています。

- 大きなタイポグラフィと余白
- ライト / ダーク / グレー面のリズム
- 写真を主役にした横スクロールギャラリー
- 最小限の UI クローム

## ローカル確認

```bash
cd web
python -m http.server 8080
```

ブラウザで `http://localhost:8080/taikodai/` を開きます。
