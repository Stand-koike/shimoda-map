# clients/ — 案件素材・設定の置き場

**このリポジトリ（shimoda-map）** は **下田本番** 専用です。`web/` は下田のみデプロイします。

## 2リポ構成

| リポ | `web/` | `clients/` | GitHub Pages |
|------|--------|------------|--------------|
| [shimoda-map](https://github.com/Stand-koike/shimoda-map)（本リポ） | 下田（`100.png` 系） | `shimoda/`, `_template/` | 既存 URL（変更しない） |
| [sotoura-map](https://github.com/Stand-koike/sotoura-map) | 外浦（`300.png`） | `sotoura/` のみ | 別 URL |

外浦の作業・公開は **`外浦MAP/` ローカル clone（sotoura-map）** で行う。本リポの `clients/sotoura/` は参照用のコピー（座標・pgw の記録）。

## ルール（下田）

| パス | 役割 |
|------|------|
| [`web/`](../web/) | **下田**のデプロイ正本 |
| `clients/shimoda/` | 下田素材正本 |
| `clients/_template/` | 新規案件テンプレート |

**素材の流れ**: `clients/shimoda/production/` → `web/` → push `main` → Pages

## 案件一覧

| slug | 案件名 | 公開 |
|------|--------|------|
| `shimoda` | 下田 | 本リポ `main` → Pages |
| `sotoura` | 外浦 | [**sotoura-map** リポ](https://github.com/Stand-koike/sotoura-map) |

## Cursor で作業を始めるとき（下田）

1. **下田MAP** フォルダ（本リポ）だけを Workspace で開く
2. `git branch` → **`main`**
3. `web/config.js` → `APP_TITLE: '下田マップ'`
4. 詳細: [`.cursor/rules/project.md`](../.cursor/rules/project.md)

Agent 依頼例:

```
【案件】下田 / リポ shimoda-map / main
【触らない】sotoura-map、外浦の 300.png
```

## 新規案件

```powershell
Copy-Item -Recurse clients\_template clients\{slug}
```

外浦のように **別 Pages が必要な案件** は、素材確定後に **専用リポ** を切る（`sotoura-map` を参照）。
