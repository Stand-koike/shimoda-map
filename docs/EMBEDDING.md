# 観光協会サイトへの埋め込み

[`map/index.html`](../map/index.html) を静的ホスティングに配置し、その URL を **iframe** で埋め込む想定です。

---

## 1. 最小の iframe 例

```html
<iframe
  src="https://example.com/map/index.html"
  title="外浦海岸マップ"
  width="100%"
  height="720"
  style="border:0; display:block; max-width:100%; margin:0 auto;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

- **`height`**: 固定 px か、親ページのレイアウトに合わせて調整。スマホでは **600〜800px** 程度を目安に。
- **`width`**: `100%` で親のカラム幅に追従させやすいです。

---

## 2. 推奨属性

| 属性 | 説明 |
|------|------|
| `title` | アクセシビリティのため必須に近い |
| `loading="lazy"` | ファーストビュー外なら遅延読み込み |
| `referrerpolicy` | 計測・プライバシーポリシーに合わせて調整 |

---

## 3. 全画面・別タブ

- **没入感**: 協会サイト内に「全画面で見る」ボタンを置き、`window.open(mapUrl, '_blank')` で **新規タブ**に開く方法がシンプルです。
- **同一タブ**で専用ページに遷移する場合は、通常の `<a href="...">` で十分です。

---

## 4. 親ページとの連携（任意）

- マップの高さを **親の JS で可変**にしたい場合、`postMessage` で子（マップ）と親の高さを同期する運用が可能です（実装は別途）。現状のマップは **固定 height の iframe** 前提で動作します。

---

## 5. 注意

- **クロスオリジン**: マップを別ドメインでホストする場合、Cookie・GA の扱いは協会サイト側のポリシーに合わせてください。
- **HTTPS**: 位置情報（Geolocation）は **HTTPS** または `localhost` でないと制限されることがあります。
